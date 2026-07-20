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

    // roleId==2 (parent) acts on the child's userId (APK-FINDINGS.md §2b).
    if (session.roleId === '2' && firstUser.fatherUserId) {
        session.userId = String(firstUser.fatherUserId);
    }

    if (!session.userId) return null;
    return session;
}

function assertNotLoginFailure(payload) {
    const status = String(payload?.status || '').toLowerCase();
    if (payload?.error || status === '0' || status === 'error' || status === 'fail') {
        const err = new Error(payload?.message || payload?.mobileString || 'ERP credentials rejected');
        err.code = 'ERP_REJECTED';
        throw err;
    }
}

async function postLegacy(path, body) {
    const response = await fetch(`${ERP_BASE}${path}`, {
        method: 'POST',
        headers: LEGACY_HEADERS,
        body: encodeForm(body),
    });
    const payload = await readErpPayload(response);
    return { response, payload };
}

// Dev-only mock login. MUST stay off in production: otherwise anyone can mint a
// session for ANY roll number (including the admin) with the bypass password,
// with no real ERP authentication. Enable only by setting ALLOW_MOCK_LOGIN=1.
const MOCK_LOGIN_ENABLED = process.env.ALLOW_MOCK_LOGIN === '1';

async function loginLegacy(username, password, deviceIdUUID = '') {
    if (MOCK_LOGIN_ENABLED && ((username && username.toLowerCase().startsWith('mock')) || password === 'presence-mock-bypass')) {
        return {
            authUserId: 'mock-auth-user-id',
            otpHint: 'Sent to Mock Phone (XXXXXX1234)',
            session: {
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
            }
        };
    }

    // Mobile login (APK-FINDINGS.md §2b): a device that has completed MFA once is trusted and
    // returns status==1 (session + token) with NO OTP. deviceIdUUID identifies that device.
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

    // Verified live 2026-07-17 (HANDOFF-erp-mobile.md): the real fresh-device OTP-verify
    // endpoint is /mobilev2/verifyOtp (NOT /mobile/verifyOtp — that was the bug that blocked
    // the whole mobile flow). It returns status:1 with res.data.token = the securityToken,
    // which parseLegacySession reads. deviceIdUUID is forwarded to bind/trust the device.
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

async function fetchSummaryLegacy(session) {
    return postLegacy('/mobile/commonPage', {
        commonPageId: '28',
        device: 'android',
        userId: session.userId,
        sessionId: session.sessionId,
        roleId: session.roleId,
    });
}

// Extract Set-Cookie names=values from a response (handles the several ways runtimes expose them).
function extractCookies(resp) {
    const cookies = [];
    const add = (c) => { const name = c.split(';')[0]; if (name && !cookies.includes(name)) cookies.push(name); };
    try { if (typeof resp.headers.getSetCookie === 'function') resp.headers.getSetCookie().forEach(add); } catch { /* ignore */ }
    try { if (typeof resp.headers.raw === 'function') (resp.headers.raw()['set-cookie'] || []).forEach(add); } catch { /* ignore */ }
    try { const single = resp.headers.get('set-cookie'); if (single) single.split(/,(?=[^;]*=)/).forEach(add); } catch { /* ignore */ }
    return cookies.join('; ');
}

// Attendance summary via mobilev2 WITH the showAttendance warmup + cookies. The ERP binds the
// server session on the warmup and sets PHPSESSID/ci_session; commonPage/28 then reads as a live
// session. Without the warmup (the old fetchSummaryLegacy path) the ERP treats the session as dead
// → "Session expired". This mirrors fetchRegisterLegacy and the official app / Attendly capture.
async function fetchSummaryV2(session) {
    const sessionForm = {
        userId: session.userId,
        sessionId: session.sessionId,
        roleId: session.roleId,
        apiKey: session.apiKey,
        securityToken: session.securityToken || '',
        deviceIdUUID: session.deviceIdUUID || '',
    };

    let cookies = '';
    try {
        const warmup = await fetch(`${ERP_BASE}/mobilev2/showAttendance`, {
            method: 'POST',
            headers: LEGACY_HEADERS,
            redirect: 'manual',
            body: encodeForm({ prevNext: '0', month: '', ...sessionForm }),
        });
        cookies = extractCookies(warmup);
        await warmup.text(); // drain
    } catch { /* warmup failure is non-fatal — try the data call anyway */ }

    const response = await fetch(`${ERP_BASE}/mobilev2/commonPage`, {
        method: 'POST',
        headers: { ...LEGACY_HEADERS, ...(cookies ? { Cookie: cookies } : {}) },
        body: encodeForm({ commonPageId: '28', device: 'android', ...sessionForm }),
    });
    const payload = await readErpPayload(response);
    return { response, payload };
}

// Real weekly timetable via mobilev2 commonPage id 99 — the full published grid (all subjects,
// real times), the SAME table the web /display page shows, but served over the plain mobile
// session (verified live via the official app's own traffic, 2026-07-20). No Turnstile / web
// session / capture needed. Mirrors fetchSummaryV2's warmup+cookie pattern.
async function fetchTimetableV2(session) {
    const sessionForm = {
        userId: session.userId,
        sessionId: session.sessionId,
        roleId: session.roleId,
        apiKey: session.apiKey,
        securityToken: session.securityToken || '',
        deviceIdUUID: session.deviceIdUUID || '',
    };

    let cookies = '';
    try {
        const warmup = await fetch(`${ERP_BASE}/mobilev2/showAttendance`, {
            method: 'POST',
            headers: LEGACY_HEADERS,
            redirect: 'manual',
            body: encodeForm({ prevNext: '0', month: '', ...sessionForm }),
        });
        cookies = extractCookies(warmup);
        await warmup.text();
    } catch { /* warmup non-fatal */ }

    const response = await fetch(`${ERP_BASE}/mobilev2/commonPage`, {
        method: 'POST',
        headers: { ...LEGACY_HEADERS, ...(cookies ? { Cookie: cookies } : {}) },
        body: encodeForm({ commonObj: '', commonPageId: '99', device: '', ...sessionForm }),
    });
    const payload = await readErpPayload(response);
    return { response, payload };
}

async function fetchRegisterLegacy(session) {
    // Helper: check if HTML contains the register table structure
    function isRegisterTable(html) {
        return html && /id=['"]subject_\d+['"]/.test(html) && html.includes('<thead');
    }

    // Helper: extract ALL cookies from a response (multiple Set-Cookie headers)
    function extractAllCookies(resp) {
        const cookies = [];
        try {
            if (typeof resp.headers.getSetCookie === 'function') {
                for (const c of resp.headers.getSetCookie()) {
                    const name = c.split(';')[0];
                    if (name) cookies.push(name);
                }
            }
        } catch (e) { /* ignore */ }
        try {
            if (typeof resp.headers.raw === 'function') {
                for (const c of (resp.headers.raw()['set-cookie'] || [])) {
                    const name = c.split(';')[0];
                    if (name && !cookies.includes(name)) cookies.push(name);
                }
            }
        } catch (e) { /* ignore */ }
        try {
            const single = resp.headers.get('set-cookie');
            if (single) {
                for (const c of single.split(/,(?=[^;]*=)/)) {
                    const name = c.trim().split(';')[0];
                    if (name && !cookies.includes(name)) cookies.push(name);
                }
            }
        } catch (e) { /* ignore */ }
        return cookies.join('; ');
    }

    const registerBody = {
        studentId: session.studentId,
        sessionId: session.sessionId,
        userId: session.userId,
        apiKey: session.apiKey,
        roleId: session.roleId,
        securityToken: session.securityToken || '',
        deviceIdUUID: session.deviceIdUUID || '',
    };

    // Step 1: Warmup — establishes server session needed for chalkpadpro.
    // Must hit /mobilev2/showAttendance WITH securityToken + deviceIdUUID (matches the official
    // app and Attendly's capture); the old /mobile/showAttendance warmup no longer binds a session.
    let allCookies = '';
    try {
        const warmupResp = await fetch(`${ERP_BASE}/mobilev2/showAttendance`, {
            method: 'POST',
            headers: LEGACY_HEADERS,
            redirect: 'manual',
            body: encodeForm({
                prevNext: '0',
                userId: session.userId,
                sessionId: session.sessionId,
                apiKey: session.apiKey,
                roleId: session.roleId,
                securityToken: session.securityToken || '',
                deviceIdUUID: session.deviceIdUUID || '',
                month: '',
            }),
        });
        allCookies = extractAllCookies(warmupResp);
        await warmupResp.text(); // drain body
    } catch (err) { /* warmup failure is non-fatal */ }

    // Step 2: Try register with warmup cookies
    try {
        const regResp = await fetch(
            `${ERP_BASE}/chalkpadpro/studentDetails/getAttendanceRegister`,
            {
                method: 'POST',
                headers: { ...LEGACY_HEADERS, ...(allCookies ? { Cookie: allCookies } : {}) },
                body: encodeForm(registerBody),
            }
        );
        const regText = await regResp.text();
        if (regResp.ok && isRegisterTable(regText)) {
            return { response: regResp, payload: { content: regText } };
        }
    } catch (err) { /* try next */ }

    // Step 3: Try register without cookies
    try {
        const regResp2 = await fetch(
            `${ERP_BASE}/chalkpadpro/studentDetails/getAttendanceRegister`,
            { method: 'POST', headers: LEGACY_HEADERS, body: encodeForm(registerBody) }
        );
        const regText2 = await regResp2.text();
        if (regResp2.ok && isRegisterTable(regText2)) {
            return { response: regResp2, payload: { content: regText2 } };
        }
    } catch (err) { /* try next */ }

    // Step 4: Try studentId only
    try {
        const regResp3 = await fetch(
            `${ERP_BASE}/chalkpadpro/studentDetails/getAttendanceRegister`,
            {
                method: 'POST',
                headers: { ...LEGACY_HEADERS, ...(allCookies ? { Cookie: allCookies } : {}) },
                body: encodeForm({ studentId: session.studentId }),
            }
        );
        const regText3 = await regResp3.text();
        if (regResp3.ok && isRegisterTable(regText3)) {
            return { response: regResp3, payload: { content: regText3 } };
        }
    } catch (err) { /* fall through to summary fallback */ }

    // Fallback: commonPageId 28 (summary cards with per-subject totals)
    try {
        return await postLegacy('/mobile/commonPage', {
            commonPageId: '28',
            device: 'android',
            userId: session.userId,
            sessionId: session.sessionId,
            roleId: session.roleId,
        });
    } catch (err) { /* ultimate fallback */ }

    // Ultimate fallback: commonPageId 85
    return postLegacy('/mobile/commonPage', {
        commonPageId: '85',
        device: 'android',
        userId: session.userId,
        sessionId: session.sessionId,
        roleId: session.roleId,
    });
}

async function fetchTimetableLegacy(session) {
    function extractAllCookies(resp) {
        const cookies = [];
        try {
            if (typeof resp.headers.getSetCookie === 'function') {
                for (const c of resp.headers.getSetCookie()) {
                    const name = c.split(';')[0];
                    if (name) cookies.push(name);
                }
            }
        } catch (e) { /* ignore */ }
        try {
            if (typeof resp.headers.raw === 'function') {
                for (const c of (resp.headers.raw()['set-cookie'] || [])) {
                    const name = c.split(';')[0];
                    if (name && !cookies.includes(name)) cookies.push(name);
                }
            }
        } catch (e) { /* ignore */ }
        try {
            const single = resp.headers.get('set-cookie');
            if (single) {
                for (const c of single.split(/,(?=[^;]*=)/)) {
                    const name = c.trim().split(';')[0];
                    if (name && !cookies.includes(name)) cookies.push(name);
                }
            }
        } catch (e) { /* ignore */ }
        return cookies.join('; ');
    }

    function isTimetableContent(html) {
        if (!html || html.length < 100) return false;
        const lower = html.toLowerCase();
        const hasDayKeywords = /\b(monday|tuesday|wednesday|thursday|friday|saturday|mon|tue|wed|thu|fri|sat)\b/i.test(html);
        const hasPeriodIndicator = /\b(period|slot|lecture)\b/i.test(html) ||
            /\d{1,2}[:.]\d{2}\s*[-–]\s*\d{1,2}[:.]\d{2}/.test(html);
        const hasSubjectContent = /\d{2}[A-Z]{2,}\d{4}/.test(html) || lower.includes('subject');
        // Must NOT be just the attendance register
        const isRegister = /id=['"]subject_\d+['"]/.test(html) && html.includes('<thead');
        return hasDayKeywords && (hasPeriodIndicator || hasSubjectContent) && !isRegister;
    }

    const baseBody = {
        studentId: session.studentId,
        sessionId: session.sessionId,
        userId: session.userId,
        apiKey: session.apiKey,
        roleId: session.roleId,
        securityToken: session.securityToken || '',
        deviceIdUUID: session.deviceIdUUID || '',
    };

    const _diag = { triedEndpoints: [], source: null };

    // Step 1: Warmup — establish server session cookies via /mobilev2/showAttendance + tokens.
    let allCookies = '';
    try {
        const warmupResp = await fetch(`${ERP_BASE}/mobilev2/showAttendance`, {
            method: 'POST',
            headers: LEGACY_HEADERS,
            redirect: 'manual',
            body: encodeForm({
                prevNext: '0',
                userId: session.userId,
                sessionId: session.sessionId,
                apiKey: session.apiKey,
                roleId: session.roleId,
                securityToken: session.securityToken || '',
                deviceIdUUID: session.deviceIdUUID || '',
                month: '',
            }),
        });
        allCookies = extractAllCookies(warmupResp);
        await warmupResp.text();
    } catch (err) { /* warmup failure non-fatal */ }

    // Candidate endpoints to try. The web My-Info page (GET /display, cookie-authed, no body)
    // is the real timetable source — verified live 2026-07-18 via HTTP Toolkit capture: the
    // PHPSESSID set by the mobilev2/showAttendance warmup authorizes it, and its HTML embeds the
    // weekly grid (rowheading / Days-Periods / dataFont) the parser below already reads. The old
    // POST-with-mobile-body candidates never returned a grid; keep them only as fallbacks.
    const candidates = [
        { path: '/chalkpadpro/studentDetails/display', method: 'GET' },
        { path: '/chalkpadpro/studentDetails/studentTimeTable', method: 'POST' },
        { path: '/chalkpadpro/studentDetails/getTimeTable', method: 'POST' },
        { path: '/chalkpadpro/studentDetails/getStudentTimeTable', method: 'POST' },
        { path: '/chalkpadpro/studentDetails/display', method: 'POST' },
    ];

    // Try each candidate with cookies first, then without
    for (const candidate of candidates) {
        _diag.triedEndpoints.push(candidate.path);
        try {
            const resp = await fetch(`${ERP_BASE}${candidate.path}`, {
                method: candidate.method,
                headers: { ...LEGACY_HEADERS, ...(allCookies ? { Cookie: allCookies } : {}) },
                ...(candidate.method === 'GET' ? {} : { body: encodeForm(baseBody) }),
            });
            const text = await resp.text();
            if (resp.ok && isTimetableContent(text)) {
                _diag.source = candidate.path;
                return { response: resp, payload: { content: text }, _diag };
            }
        } catch (err) { /* try next */ }
    }

    // Try commonPageId values that might return timetable
    const timetablePageIds = ['30', '31', '45', '50', '60', '70', '80', '90'];
    for (const pageId of timetablePageIds) {
        _diag.triedEndpoints.push(`/mobile/commonPage?id=${pageId}`);
        try {
            const { response, payload } = await postLegacy('/mobile/commonPage', {
                commonPageId: pageId,
                device: 'android',
                userId: session.userId,
                sessionId: session.sessionId,
                roleId: session.roleId,
            });
            const content = payload?.content || '';
            if (response.ok && isTimetableContent(content)) {
                _diag.source = `/mobile/commonPage:${pageId}`;
                return { response, payload, _diag };
            }
        } catch (err) { /* try next */ }
    }

    // Last resort: try /display without timetable detection (return whatever it gives)
    try {
        const resp = await fetch(`${ERP_BASE}/chalkpadpro/studentDetails/display`, {
            method: 'POST',
            headers: { ...LEGACY_HEADERS, ...(allCookies ? { Cookie: allCookies } : {}) },
            body: encodeForm(baseBody),
        });
        const text = await resp.text();
        if (resp.ok && text.length > 500) {
            _diag.source = '/chalkpadpro/studentDetails/display (fallback)';
            return { response: resp, payload: { content: text }, _diag };
        }
    } catch (err) { /* fall through */ }

    _diag.source = null;
    return { response: { ok: false }, payload: { content: '' }, _diag };
}

module.exports = {
    LEGACY_HEADERS,
    encodeForm,
    readErpPayload,
    parseLegacySession,
    loginLegacy,
    verifyOtpLegacy,
    fetchSummaryLegacy,
    fetchSummaryV2,
    fetchTimetableV2,
    fetchRegisterLegacy,
    fetchTimetableLegacy,
};
