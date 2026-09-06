/**
 * ERP provider — every HTTP round-trip to the university portal lives here.
 *
 * Only paths verified live against this ERP remain (2026-07-17 → 2026-07-20 captures):
 *   /mobilev2/appLoginAuthV2                       login (status 1 trusted, 4 = OTP sent)
 *   /mobilev2/verifyOtp                            OTP verify → session + securityToken
 *   /mobilev2/showAttendance                       warm-up that binds the server session (cookies)
 *   /chalkpadpro/studentDetails/getAttendanceRegister   the day-wise register (primary data source)
 *   /mobilev2/commonPage 28 / 99                   attendance summary cards / weekly timetable grid
 *
 * The old /mobile/* (no securityToken) and speculative timetable endpoints were
 * removed: none returned data on this ERP, and a miss fanned out into a dozen
 * requests per sync — exactly the traffic pattern that gets an egress IP blocked.
 */

const ERP_BASE = process.env.ERP_BASE_URL;

const LEGACY_HEADERS = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 10; SM-G960F)',
    'Accept': '*/*',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
};

function encodeForm(obj) {
    return Object.entries(obj)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');
}

async function readErpText(response) {
    if (typeof response.text === 'function') return response.text();
    if (typeof response.json === 'function') return JSON.stringify(await response.json());
    return '';
}

async function readErpPayload(response) {
    const text = (await readErpText(response)).trim();
    if (!text) return {};

    try {
        return JSON.parse(text);
    } catch {
        const jsonStart = Math.min(
            ...['{', '['].map(ch => {
                const idx = text.indexOf(ch);
                return idx === -1 ? Number.POSITIVE_INFINITY : idx;
            })
        );
        if (Number.isFinite(jsonStart)) {
            try {
                return JSON.parse(text.slice(jsonStart));
            } catch {
                // Fall through to raw HTML.
            }
        }
    }

    return { content: text };
}

function firstDataItem(data) {
    if (Array.isArray(data)) return data[0] || null;
    return data || null;
}

function parseLegacySession(payload) {
    const firstUser = firstDataItem(payload?.data) || payload || {};
    const session = {
        userId: String(firstUser.userId || payload?.userId || ''),
        sessionId: String(firstUser.sessionId || payload?.sessionId || ''),
        roleId: String(firstUser.roleId || payload?.roleId || ''),
        apiKey: String(firstUser.apiKey || firstUser.appKey || payload?.apiKey || ''),
        // securityToken is server-issued at login (top-level `token`); required by /mobilev2/*.
        securityToken: String(payload?.token || firstUser.token || ''),
        studentId: String(firstUser.studentId || firstUser.id || payload?.studentId || ''),
        studentName: String(firstUser.name || firstUser.profileName || payload?.name || ''),
        studentPhoto: String(firstUser.photo || payload?.photo || ''),
        otpHint: String(payload?.mobileString || ''),
    };

    // roleId==2 (parent) acts on the child's userId.
    if (session.roleId === '2' && firstUser.fatherUserId) {
        session.userId = String(firstUser.fatherUserId);
    }

    if (!session.userId) return null;
    return session;
}

/**
 * Reject a login payload that the ERP treated as a failure.
 *
 * The MFA challenge is status 4 and is NOT a failure — it means the credentials were
 * accepted and an OTP was sent. Only an explicit failure marker counts.
 *
 * The thrown error carries `erpShape`: the payload's keys and its status/error/message
 * fields, never a credential, so a rejected login is diagnosable from the logs.
 */
function assertNotLoginFailure(payload) {
    const status = String(payload?.status ?? '').toLowerCase();
    // `error` is only a failure when it carries something. Some ERP responses include
    // the key set to '', '0', false or null on a perfectly good challenge.
    const errorField = payload?.error;
    const hasError = errorField !== undefined && errorField !== null
        && errorField !== '' && errorField !== false
        && String(errorField).toLowerCase() !== '0' && String(errorField).toLowerCase() !== 'false';

    if (hasError || status === '0' || status === 'error' || status === 'fail') {
        const err = new Error(payload?.message || payload?.mobileString || 'ERP credentials rejected');
        err.code = 'ERP_REJECTED';
        err.erpShape = {
            keys: payload && typeof payload === 'object' ? Object.keys(payload) : typeof payload,
            status: payload?.status,
            error: errorField,
            message: payload?.message,
            hasAuthUserId: Boolean(payload?.authUserId),
        };
        throw err;
    }
}

async function postLegacy(path, body, extraHeaders = {}) {
    const response = await fetch(`${ERP_BASE}${path}`, {
        method: 'POST',
        headers: { ...LEGACY_HEADERS, ...extraHeaders },
        body: encodeForm(body),
    });
    const payload = await readErpPayload(response);
    return { response, payload };
}

// Dev-only mock login. MUST stay off in production: otherwise anyone can mint a
// session for ANY roll number (including the admin) with the bypass password,
// with no real ERP authentication. Enable only by setting ALLOW_MOCK_LOGIN=1.
const MOCK_LOGIN_ENABLED = process.env.ALLOW_MOCK_LOGIN === '1';

function mockSession(deviceIdUUID) {
    return {
        userId: 'mock-user-id',
        sessionId: 'mock-session-id',
        roleId: 'mock-role-id',
        apiKey: 'mock-api-key',
        securityToken: 'mock-security-token',
        deviceIdUUID,
        studentId: 'mock-student-id',
        studentName: 'Mock Student',
        studentPhoto: '',
        isMock: true,
    };
}

async function loginLegacy(username, password, deviceIdUUID = '') {
    if (MOCK_LOGIN_ENABLED && ((username && username.toLowerCase().startsWith('mock')) || password === 'presence-mock-bypass')) {
        return {
            authUserId: 'mock-auth-user-id',
            otpHint: 'Sent to Mock Phone (XXXXXX1234)',
            session: mockSession(deviceIdUUID),
        };
    }

    // A device that has completed MFA once is trusted and returns status==1
    // (session + token) with NO OTP. deviceIdUUID identifies that device.
    const { response, payload } = await postLegacy('/mobilev2/appLoginAuthV2', {
        txtUsername: username,
        txtPassword: password,
        deviceIdUUID,
        device: 'android',
    });
    if (!response.ok) throw new Error('ERP login request failed');
    assertNotLoginFailure(payload);

    const session = parseLegacySession(payload);
    if (session) session.deviceIdUUID = deviceIdUUID;
    const authUserId = payload.authUserId || session?.userId || payload.userId;
    if (!authUserId) throw new Error('No authUserId in ERP login response');

    return {
        authUserId: String(authUserId),
        otpHint: payload.mobileString || '',
        session,
    };
}

async function verifyOtpLegacy(authUserId, otp, deviceIdUUID = '') {
    if (MOCK_LOGIN_ENABLED && (authUserId === 'mock-auth-user-id' || (authUserId && authUserId.startsWith('mock')))) {
        return mockSession(deviceIdUUID);
    }

    // Verified live 2026-07-17: the fresh-device OTP-verify endpoint is /mobilev2/verifyOtp.
    // It returns status:1 with res.data.token = the securityToken, which parseLegacySession reads.
    const { response, payload } = await postLegacy('/mobilev2/verifyOtp', {
        deviceIdUUID,
        OTPText: otp,
        authUserId,
    });
    if (!response.ok) throw new Error('OTP verification request failed');
    assertNotLoginFailure(payload);

    const session = parseLegacySession(payload);
    if (session) session.deviceIdUUID = deviceIdUUID;
    if (!session?.userId || !session.sessionId) {
        const err = new Error('Unexpected ERP OTP response');
        err.code = 'INVALID_OTP';
        throw err;
    }
    return session;
}

// ── Session-bound data calls ──────────────────────────────────────────

function sessionForm(session) {
    return {
        userId: session.userId,
        sessionId: session.sessionId,
        roleId: session.roleId,
        apiKey: session.apiKey,
        securityToken: session.securityToken || '',
        deviceIdUUID: session.deviceIdUUID || '',
    };
}

// Set-Cookie name=value pairs from a response, across the ways runtimes expose them.
function extractCookies(resp) {
    const cookies = [];
    const add = (c) => {
        const name = String(c || '').trim().split(';')[0];
        if (name && !cookies.includes(name)) cookies.push(name);
    };
    try { if (typeof resp.headers.getSetCookie === 'function') resp.headers.getSetCookie().forEach(add); } catch { /* ignore */ }
    try { if (typeof resp.headers.raw === 'function') (resp.headers.raw()['set-cookie'] || []).forEach(add); } catch { /* ignore */ }
    try { const single = resp.headers.get('set-cookie'); if (single) single.split(/,(?=[^;]*=)/).forEach(add); } catch { /* ignore */ }
    return cookies.join('; ');
}

/**
 * The ERP binds its server-side session on /mobilev2/showAttendance and hands back
 * PHPSESSID/ci_session. Every data call needs those cookies or it reads as a dead
 * session. Failure here is non-fatal — the data call is still attempted.
 */
async function warmup(session) {
    try {
        const resp = await fetch(`${ERP_BASE}/mobilev2/showAttendance`, {
            method: 'POST',
            headers: LEGACY_HEADERS,
            redirect: 'manual',
            body: encodeForm({ prevNext: '0', month: '', ...sessionForm(session) }),
        });
        const cookies = extractCookies(resp);
        await resp.text(); // drain
        return cookies;
    } catch {
        return '';
    }
}

const withCookies = (cookies) => (cookies ? { Cookie: cookies } : {});

/** Attendance summary cards (commonPage 28). Fallback when the register is unavailable. */
async function fetchSummaryV2(session) {
    const cookies = await warmup(session);
    return postLegacy('/mobilev2/commonPage',
        { commonPageId: '28', device: 'android', ...sessionForm(session) },
        withCookies(cookies));
}

/** The full published weekly timetable grid (commonPage 99) — verified live 2026-07-20. */
async function fetchTimetableV2(session) {
    const cookies = await warmup(session);
    return postLegacy('/mobilev2/commonPage',
        { commonObj: '', commonPageId: '99', device: '', ...sessionForm(session) },
        withCookies(cookies));
}

function isRegisterTable(html) {
    return !!html && /id=['"]subject_\d+['"]/.test(html) && html.includes('<thead');
}

/**
 * The day-wise attendance register — the primary data source. Tried with the
 * warm-up cookies first, then bare; both are real observed-working shapes.
 * Returns { response, payload: { content } } with content '' when neither yields a table.
 */
async function fetchRegisterLegacy(session) {
    const body = { studentId: session.studentId, ...sessionForm(session) };
    const cookies = await warmup(session);
    let last = null;

    for (const headers of [withCookies(cookies), {}]) {
        try {
            const resp = await fetch(`${ERP_BASE}/chalkpadpro/studentDetails/getAttendanceRegister`, {
                method: 'POST',
                headers: { ...LEGACY_HEADERS, ...headers },
                body: encodeForm(body),
            });
            const text = await resp.text();
            last = { response: resp, payload: { content: text } };
            if (resp.ok && isRegisterTable(text)) return last;
        } catch { /* try the next shape */ }
    }

    return last || { response: { ok: false, status: 0 }, payload: { content: '' } };
}

module.exports = {
    LEGACY_HEADERS,
    assertNotLoginFailure,
    encodeForm,
    readErpPayload,
    parseLegacySession,
    loginLegacy,
    verifyOtpLegacy,
    fetchSummaryV2,
    fetchTimetableV2,
    fetchRegisterLegacy,
    isRegisterTable,
};
