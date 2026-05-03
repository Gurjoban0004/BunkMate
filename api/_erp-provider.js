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

    // Helper: check if HTML contains the register table structure
    function isRegisterTable(html) {
        return html && /id=['"]subject_\d+['"]/.test(html) && html.includes('<thead');
    }

    // Helper: extract ALL cookies from a response (multiple Set-Cookie headers)
    function extractAllCookies(resp) {
        const cookies = [];
        try {
            // Method 1: getSetCookie (Node 18.14+)
            if (typeof resp.headers.getSetCookie === 'function') {
                const sc = resp.headers.getSetCookie();
                if (sc && sc.length > 0) {
                    for (const c of sc) {
                        const name = c.split(';')[0];
                        if (name) cookies.push(name);
                    }
                }
            }
        } catch (e) { /* ignore */ }

        try {
            // Method 2: raw() for node-fetch
            if (typeof resp.headers.raw === 'function') {
                const raw = resp.headers.raw();
                const setCookies = raw['set-cookie'] || [];
                for (const c of setCookies) {
                    const name = c.split(';')[0];
                    if (name && !cookies.includes(name)) cookies.push(name);
                }
            }
        } catch (e) { /* ignore */ }

        try {
            // Method 3: get('set-cookie') may return comma-joined or single
            const single = resp.headers.get('set-cookie');
            if (single) {
                // Some implementations join multiple Set-Cookie headers with comma
                const parts = single.split(/,(?=[^;]*=)/);
                for (const c of parts) {
                    const name = c.trim().split(';')[0];
                    if (name && !cookies.includes(name)) cookies.push(name);
                }
            }
        } catch (e) { /* ignore */ }

        return cookies.join('; ');
    }

    // ══════════════════════════════════════════════════════════════════
    // STEP 1: WARMUP — Hit /mobile/showAttendance to establish server session
    // This is REQUIRED before hitting chalkpadpro. The competitor does this
    // via x-warmup-url/x-warmup-body headers in their proxy.
    // ══════════════════════════════════════════════════════════════════
    let allCookies = '';
    try {
        const warmupResp = await fetch(`${ERP_BASE}/mobile/showAttendance`, {
            method: 'POST',
            headers: LEGACY_HEADERS,
            redirect: 'manual', // Don't follow redirects, capture cookies
            body: encodeForm({
                prevNext: '0',
                userId: session.userId,
                sessionId: session.sessionId,
                apiKey: session.apiKey,
                roleId: session.roleId,
                month: '',
            }),
        });
        allCookies = extractAllCookies(warmupResp);
        const warmupText = await warmupResp.text();
        logStep('warmup', {
            status: warmupResp.status,
            ok: warmupResp.ok,
            cookieCount: allCookies ? allCookies.split(';').length : 0,
            cookies: allCookies ? allCookies.slice(0, 200) : 'NONE',
            bodyLen: warmupText.length,
            preview: warmupText.slice(0, 200),
        });
    } catch (err) {
        logStep('warmup', { error: err.message });
    }

    // ══════════════════════════════════════════════════════════════════
    // STEP 2: HIT THE REGISTER — Exact same call as the competitor
    // URL: /chalkpadpro/studentDetails/getAttendanceRegister
    // Body: studentId + sessionId + userId + apiKey + roleId
    // Cookies from warmup forwarded
    // ══════════════════════════════════════════════════════════════════
    const registerBody = {
        studentId: session.studentId,
        sessionId: session.sessionId,
        userId: session.userId,
        apiKey: session.apiKey,
        roleId: session.roleId,
    };

    // Try with warmup cookies
    try {
        const regHeaders = {
            ...LEGACY_HEADERS,
            ...(allCookies ? { Cookie: allCookies } : {}),
        };
        const regResp = await fetch(
            `${ERP_BASE}/chalkpadpro/studentDetails/getAttendanceRegister`,
            {
                method: 'POST',
                headers: regHeaders,
                body: encodeForm(registerBody),
            }
        );

        // Capture any additional cookies from the register response
        const regCookies = extractAllCookies(regResp);
        const regText = await regResp.text();
        const isReg = isRegisterTable(regText);

        logStep('register-with-cookies', {
            status: regResp.status,
            ok: regResp.ok,
            htmlLen: regText.length,
            isRegisterTable: isReg,
            preview: regText.slice(0, 300) || 'EMPTY',
            cookiesSent: allCookies ? allCookies.slice(0, 100) : 'NONE',
            newCookies: regCookies ? regCookies.slice(0, 100) : 'NONE',
        });

        if (regResp.ok && regText && isReg) {
            const payload = { content: regText };
            return { response: regResp, payload, _regDiag, _source: 'chalkpadpro-register' };
        }
    } catch (err) {
        logStep('register-with-cookies', { error: err.message });
    }

    // Try WITHOUT cookies (in case warmup cookies aren't needed)
    try {
        const regResp2 = await fetch(
            `${ERP_BASE}/chalkpadpro/studentDetails/getAttendanceRegister`,
            {
                method: 'POST',
                headers: LEGACY_HEADERS,
                body: encodeForm(registerBody),
            }
        );
        const regText2 = await regResp2.text();
        const isReg2 = isRegisterTable(regText2);

        logStep('register-no-cookies', {
            status: regResp2.status,
            ok: regResp2.ok,
            htmlLen: regText2.length,
            isRegisterTable: isReg2,
            preview: regText2.slice(0, 300) || 'EMPTY',
        });

        if (regResp2.ok && regText2 && isReg2) {
            const payload = { content: regText2 };
            return { response: regResp2, payload, _regDiag, _source: 'chalkpadpro-register-no-cookies' };
        }
    } catch (err) {
        logStep('register-no-cookies', { error: err.message });
    }

    // Try studentId ONLY (minimal payload)
    try {
        const regResp3 = await fetch(
            `${ERP_BASE}/chalkpadpro/studentDetails/getAttendanceRegister`,
            {
                method: 'POST',
                headers: {
                    ...LEGACY_HEADERS,
                    ...(allCookies ? { Cookie: allCookies } : {}),
                },
                body: encodeForm({ studentId: session.studentId }),
            }
        );
        const regText3 = await regResp3.text();
        const isReg3 = isRegisterTable(regText3);

        logStep('register-studentId-only', {
            status: regResp3.status,
            ok: regResp3.ok,
            htmlLen: regText3.length,
            isRegisterTable: isReg3,
            preview: regText3.slice(0, 300) || 'EMPTY',
        });

        if (regResp3.ok && regText3 && isReg3) {
            const payload = { content: regText3 };
            return { response: regResp3, payload, _regDiag, _source: 'chalkpadpro-register-studentOnly' };
        }
    } catch (err) {
        logStep('register-studentId-only', { error: err.message });
    }

    logStep('register-failed', { reason: 'all register attempts failed, falling back to summary cards' });

    // ══════════════════════════════════════════════════════════════════
    // FALLBACK: commonPageId 28 (summary cards with per-subject totals)
    // ══════════════════════════════════════════════════════════════════
    try {
        const cp28 = await postLegacy('/mobile/commonPage', {
            commonPageId: '28',
            device: 'android',
            userId: session.userId,
            sessionId: session.sessionId,
            roleId: session.roleId,
        });
        const cp28Html = cp28.payload?.content || '';
        logStep('commonPage-28-fallback', {
            status: cp28.response.status,
            ok: cp28.response.ok,
            htmlLen: cp28Html.length,
            hasSubjectCards: cp28Html.includes('tt-box-new'),
        });
        cp28._regDiag = _regDiag;
        cp28._source = 'commonPage-28-summary';
        return cp28;
    } catch (err) {
        logStep('commonPage-28-fallback', { error: err.message });
    }

    // Ultimate fallback
    const fallback = await postLegacy('/mobile/commonPage', {
        commonPageId: '85',
        device: 'android',
        userId: session.userId,
        sessionId: session.sessionId,
        roleId: session.roleId,
    });
    fallback._regDiag = _regDiag;
    fallback._source = 'commonPage-85-timetable';
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
