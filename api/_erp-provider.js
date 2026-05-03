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
    const _regDiag = { steps: [] };

    function logStep(name, data) {
        _regDiag.steps.push({ name, ...data });
        console.log(`[CAL-REG] ${name}:`, JSON.stringify(data));
    }

    const allParams = {
        studentId: session.studentId,
        sessionId: session.sessionId,
        userId: session.userId,
        apiKey: session.apiKey,
        roleId: session.roleId,
    };

    const warmupBody = {
        prevNext: '0',
        userId: session.userId,
        sessionId: session.sessionId,
        apiKey: session.apiKey,
        roleId: session.roleId,
        month: '',
    };

    // Helper: check if HTML contains the register table structure
    function isRegisterTable(html) {
        return html && /id=['"]subject_\d+['"]/.test(html) && html.includes('<thead');
    }

    // Helper: attempt a register call and check result
    async function tryRegister(label, url, body, extraHeaders = {}) {
        try {
            const resp = await fetch(url, {
                method: 'POST',
                headers: { ...LEGACY_HEADERS, ...extraHeaders },
                body: encodeForm(body),
            });
            const payload = await readErpPayload(resp);
            const html = payload?.content || '';
            const isTable = isRegisterTable(html);

            logStep(label, {
                status: resp.status,
                ok: resp.ok,
                hasContent: !!html,
                htmlLen: html.length,
                isRegisterTable: isTable,
                preview: html ? html.slice(0, 200) : 'EMPTY',
            });

            if (resp.ok && html && isTable) {
                return { response: resp, payload, _regDiag, _source: label };
            }
            return null;
        } catch (err) {
            logStep(label, { error: err.message });
            return null;
        }
    }

    // ── STEP 1: WARMUP ──
    let warmupCookies = '';
    try {
        const warmupResp = await fetch(`${ERP_BASE}/mobile/showAttendance`, {
            method: 'POST',
            headers: LEGACY_HEADERS,
            body: encodeForm(warmupBody),
        });
        warmupCookies = warmupResp.headers.get('set-cookie') || '';
        const warmupText = await warmupResp.text();
        logStep('warmup', {
            status: warmupResp.status,
            ok: warmupResp.ok,
            cookies: warmupCookies ? 'YES' : 'NONE',
            bodyLen: warmupText.length,
            preview: warmupText.slice(0, 200),
        });
    } catch (err) {
        logStep('warmup', { error: err.message });
    }

    const cookieHeaders = warmupCookies ? { Cookie: warmupCookies } : {};

    // ── STEP 2: Register with correct casing + studentId only + cookies ──
    let result = await tryRegister(
        'register-capitalP-studentOnly',
        `${ERP_BASE}/chalkpadPro/studentDetails/getattendanceRegister`,
        { studentId: session.studentId },
        cookieHeaders
    );
    if (result) return result;

    // ── STEP 3: Register with correct casing + ALL params + cookies ──
    result = await tryRegister(
        'register-capitalP-allParams',
        `${ERP_BASE}/chalkpadPro/studentDetails/getattendanceRegister`,
        allParams,
        cookieHeaders
    );
    if (result) return result;

    // ── STEP 4: Register with lowercase casing + ALL params + cookies ──
    result = await tryRegister(
        'register-lowercaseP-allParams',
        `${ERP_BASE}/chalkpadpro/studentDetails/getAttendanceRegister`,
        allParams,
        cookieHeaders
    );
    if (result) return result;

    // ── STEP 5: Register with lowercase casing + studentId only (no warmup cookies) ──
    result = await tryRegister(
        'register-lowercaseP-studentOnly-noCookies',
        `${ERP_BASE}/chalkpadpro/studentDetails/getAttendanceRegister`,
        { studentId: session.studentId },
        {}
    );
    if (result) return result;

    // ── STEP 6: Register with lowercase + ALL params (no warmup cookies) ──
    result = await tryRegister(
        'register-lowercaseP-allParams-noCookies',
        `${ERP_BASE}/chalkpadpro/studentDetails/getAttendanceRegister`,
        allParams,
        {}
    );
    if (result) return result;

    logStep('fallback', { reason: 'all register attempts returned non-register HTML' });

    // ── FALLBACK: /mobile/commonPage ──
    const fallback = await postLegacy('/mobile/commonPage', {
        commonPageId: '85',
        device: 'android',
        userId: session.userId,
        sessionId: session.sessionId,
        roleId: session.roleId,
    });
    fallback._regDiag = _regDiag;
    fallback._source = 'commonPage-fallback';
    return fallback;
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
