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
        studentId: String(firstUser.studentId || firstUser.id || payload?.studentId || ''),
        studentName: String(firstUser.name || firstUser.profileName || payload?.name || ''),
        studentPhoto: String(firstUser.photo || payload?.photo || ''),
        otpHint: String(payload?.mobileString || ''),
    };

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

async function loginLegacy(username, password) {
    const { response, payload } = await postLegacy('/mobile/appLoginAuthV2', {
        txtUsername: username,
        txtPassword: password,
    });
    if (!response.ok) throw new Error('ERP login request failed');
    assertNotLoginFailure(payload);

    const session = parseLegacySession(payload);
    const authUserId = payload.authUserId || session?.userId || payload.userId;
    if (!authUserId) throw new Error('No authUserId in ERP login response');

    return {
        authUserId: String(authUserId),
        otpHint: payload.mobileString || '',
        session,
    };
}

async function verifyOtpLegacy(authUserId, otp) {
    const { response, payload } = await postLegacy('/mobile/verifyOtp', {
        authUserId,
        OTPText: otp,
    });
    if (!response.ok) throw new Error('OTP verification request failed');
    assertNotLoginFailure(payload);

    const session = parseLegacySession(payload);
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

async function fetchRegisterLegacy(session) {
    // ── STEP 1: WARMUP — required by the ERP to set session context ──
    // The competitor's proxy sends these as X-Warmup-Url / X-Warmup-Body headers.
    // The proxy first hits showAttendance, THEN getattendanceRegister.
    // Without this warmup, the ERP returns a generic timetable page.
    const warmupBody = {
        prevNext: '0',
        userId: session.userId,
        sessionId: session.sessionId,
        apiKey: session.apiKey,
        roleId: session.roleId,
        month: '',
    };

    try {
        const warmupResp = await fetch(`${ERP_BASE}/mobile/showAttendance`, {
            method: 'POST',
            headers: LEGACY_HEADERS,
            body: encodeForm(warmupBody),
        });
        // Extract cookies from warmup response to forward to register call
        const warmupCookies = warmupResp.headers.get('set-cookie') || '';
        console.log('[CAL-WARMUP] showAttendance status:', warmupResp.status, 'cookies:', warmupCookies ? 'YES' : 'NONE');

        // ── STEP 2: REGISTER — with session context established ──
        // Try correct casing first: chalkpadPro (capital P), getattendanceRegister (lowercase a)
        const registerHeaders = { ...LEGACY_HEADERS };
        if (warmupCookies) {
            registerHeaders['Cookie'] = warmupCookies;
        }

        const registerResp = await fetch(`${ERP_BASE}/chalkpadPro/studentDetails/getattendanceRegister`, {
            method: 'POST',
            headers: registerHeaders,
            body: encodeForm({ studentId: session.studentId }),
        });

        const payload = await readErpPayload(registerResp);
        if (registerResp.ok && payload?.content) {
            return { response: registerResp, payload };
        }

        // Try alternate casing as fallback
        const altResp = await fetch(`${ERP_BASE}/chalkpadpro/studentDetails/getAttendanceRegister`, {
            method: 'POST',
            headers: registerHeaders,
            body: encodeForm({ studentId: session.studentId }),
        });
        const altPayload = await readErpPayload(altResp);
        if (altResp.ok && altPayload?.content) {
            return { response: altResp, payload: altPayload };
        }

        console.log('[CAL-WARMUP] Both register casings failed, falling back to commonPage');
    } catch (err) {
        console.error('[CAL-WARMUP] Warmup+register failed:', err.message);
    }

    // FALLBACK: /mobile/commonPage with commonPageId 85
    return postLegacy('/mobile/commonPage', {
        commonPageId: '85',
        device: 'android',
        userId: session.userId,
        sessionId: session.sessionId,
        roleId: session.roleId,
    });
}

module.exports = {
    LEGACY_HEADERS,
    encodeForm,
    readErpPayload,
    parseLegacySession,
    loginLegacy,
    verifyOtpLegacy,
    fetchSummaryLegacy,
    fetchRegisterLegacy,
};
