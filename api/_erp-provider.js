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

    // ── PROBE 1: commonPageId 80 (competitor uses this, unknown purpose) ──
    try {
        const cp80 = await postLegacy('/mobile/commonPage', {
            commonPageId: '80',
            device: 'android',
            userId: session.userId,
            sessionId: session.sessionId,
            roleId: session.roleId,
        });
        const cp80Html = cp80.payload?.content || '';
        const cp80IsReg = isRegisterTable(cp80Html);
        logStep('commonPage-80', {
            status: cp80.response.status,
            ok: cp80.response.ok,
            htmlLen: cp80Html.length,
            isRegisterTable: cp80IsReg,
            preview: cp80Html.slice(0, 300) || 'EMPTY',
            title: cp80.payload?.title || 'NO_TITLE',
        });
        if (cp80.response.ok && cp80Html && cp80IsReg) {
            cp80._regDiag = _regDiag;
            cp80._source = 'commonPage-80';
            return cp80;
        }
    } catch (err) {
        logStep('commonPage-80', { error: err.message });
    }

    // ── PROBE 2: showAttendance with prevNext values ──
    // prevNext=0 returned "No Records Found" for May.
    // Try previous months (-1, -2, -3) to see if they contain data.
    for (const prevNext of ['-1', '-2', '-3', '0']) {
        try {
            const sa = await postLegacy('/mobile/showAttendance', {
                prevNext,
                userId: session.userId,
                sessionId: session.sessionId,
                apiKey: session.apiKey,
                roleId: session.roleId,
                month: '',
            });
            const saHtml = sa.payload?.html || sa.payload?.content || JSON.stringify(sa.payload);
            const isNotEmpty = saHtml && !saHtml.includes('No Records Found');
            logStep(`showAttendance-prevNext${prevNext}`, {
                status: sa.response.status,
                ok: sa.response.ok,
                htmlLen: saHtml.length,
                hasRecords: isNotEmpty,
                preview: saHtml.slice(0, 300) || 'EMPTY',
            });
            // If showAttendance returns register-like data, use it
            if (sa.response.ok && isNotEmpty && isRegisterTable(saHtml)) {
                sa._regDiag = _regDiag;
                sa._source = `showAttendance-prevNext${prevNext}`;
                return sa;
            }
        } catch (err) {
            logStep(`showAttendance-prevNext${prevNext}`, { error: err.message });
        }
    }

    // ── PROBE 3: mobilev2 showAttendance (different endpoint variant) ──
    try {
        const mv2 = await fetch(`${ERP_BASE}/mobilev2/showAttendance`, {
            method: 'POST',
            headers: LEGACY_HEADERS,
            body: encodeForm({
                prevNext: '0',
                userId: session.userId,
                sessionId: session.sessionId,
                roleId: session.roleId,
                appKey: session.apiKey,
                deviceIdUUID: session.deviceIdUUID || '',
                month: '',
            }),
        });
        const mv2Payload = await readErpPayload(mv2);
        const mv2Html = mv2Payload?.html || mv2Payload?.content || JSON.stringify(mv2Payload);
        logStep('mobilev2-showAttendance', {
            status: mv2.status,
            ok: mv2.ok,
            htmlLen: mv2Html.length,
            preview: mv2Html.slice(0, 300) || 'EMPTY',
        });
    } catch (err) {
        logStep('mobilev2-showAttendance', { error: err.message });
    }

    // ── PROBE 4: commonPageId 28 (attendance summary with tt-box-new cards) ──
    // This contains per-subject totals (Delivered/Attended/Absent/Percentage)
    // which we can use for Insights even if we can't get day-by-day register.
    try {
        const cp28 = await postLegacy('/mobile/commonPage', {
            commonPageId: '28',
            device: 'android',
            userId: session.userId,
            sessionId: session.sessionId,
            roleId: session.roleId,
        });
        const cp28Html = cp28.payload?.content || '';
        const hasSubjectCards = cp28Html.includes('tt-box-new');
        logStep('commonPage-28', {
            status: cp28.response.status,
            ok: cp28.response.ok,
            htmlLen: cp28Html.length,
            hasSubjectCards,
            title: cp28.payload?.title || 'NO_TITLE',
            preview: cp28Html.slice(0, 300) || 'EMPTY',
        });
        // Return the commonPageId 28 data — it has attendance totals
        // that can populate the Insights page even without the register.
        if (cp28.response.ok && cp28Html && hasSubjectCards) {
            cp28._regDiag = _regDiag;
            cp28._source = 'commonPage-28-summary';
            return cp28;
        }
    } catch (err) {
        logStep('commonPage-28', { error: err.message });
    }

    logStep('fallback', { reason: 'no mobile endpoint returned register table' });

    // ── ULTIMATE FALLBACK: commonPageId 85 (timetable) ──
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
