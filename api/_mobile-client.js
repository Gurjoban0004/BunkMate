/**
 * Chalkpad Mobile API client (`/mobilev2/*`).
 *
 * This mirrors the official Chalkpad Pro app (Apache Cordova) as reverse-engineered
 * from the decompiled APK — see APK-FINDINGS.md. It is the single source of truth for
 * how Presence talks to the ERP, replacing the fragile `/mobile/*` + `/chalkpadpro/*`
 * scraping the old provider used.
 *
 * Design goals (the "bulletproof" part):
 *   - ONE token chokepoint: `mobilePost` injects securityToken + deviceIdUUID into every
 *     call, exactly like the app's `$.ajaxPrefilter` (init-app.js:5-77). No caller ever
 *     has to remember the tokens, so they can never be silently dropped (audit Bug 1).
 *   - Server-issued securityToken: login returns `res.token`; we persist it in the session
 *     so all data calls are authenticated (audit Bug 2).
 *   - Full login status handling (1/0/3/4/5) so the caller gets precise outcomes.
 *
 * Pure functions (interpretLogin, parseMobileSession, extractHtml) are exported for unit
 * tests; the fetch-backed functions accept an injectable `fetchImpl` for the same reason.
 */

'use strict';

const ERP_BASE = process.env.ERP_BASE_URL;

// School-code → base URL directory (only needed for multi-college; CUIET uses ERP_BASE).
const CLIENT_DIRECTORY_URL = 'https://gdemo.schoolpad.in/mobilev2/getClientDetails';

// Matches the app's WebView UA (init-app.js / Cordava Dalvik client).
const MOBILE_HEADERS = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 10; SM-G960F)',
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
};

// Login/OTP/logout/static endpoints must NOT receive the token (init-app.js:9).
const TOKEN_EXEMPT = [
    'getClientDetails', 'appLoginAuthV2', 'check_update_token', 'generateSendParentOTP',
    'Generateotp', 'verifyOtp', 'multiFactorAuth', 'logout_app', 'logout_appV2',
    'forgotPassword', 'saveRegId',
];

function encodeForm(obj) {
    return Object.entries(obj)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
}

/** Read an ERP response body as JSON, tolerating the leading whitespace the ERP prepends. */
async function readJson(response) {
    let text = '';
    if (typeof response.text === 'function') text = await response.text();
    else if (typeof response.json === 'function') return response.json();
    text = (text || '').trim();
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch {
        const start = Math.min(
            ...['{', '['].map((ch) => {
                const i = text.indexOf(ch);
                return i === -1 ? Number.POSITIVE_INFINITY : i;
            })
        );
        if (Number.isFinite(start)) {
            try { return JSON.parse(text.slice(start)); } catch { /* raw */ }
        }
        return { content: text };
    }
}

/** The app stores login `data` sometimes as an object, sometimes as `data[0]`. Normalize. */
function firstData(data) {
    if (Array.isArray(data)) return data[0] || {};
    return data || {};
}

/** Attendance/timetable payloads carry the fragment under `html`; commonPage under `content`. */
function extractHtml(payload) {
    if (!payload) return '';
    return payload.html || payload.content || payload.data?.content || '';
}

const isTokenExempt = (path) => TOKEN_EXEMPT.some((p) => path.includes(p));

/**
 * The `$.ajaxPrefilter` equivalent: every non-exempt call gets securityToken + deviceIdUUID.
 * `session.baseUrl` overrides the env base (multi-college); falls back to ERP_BASE.
 */
async function mobilePost(path, session, body, fetchImpl = fetch) {
    const base = (session && session.baseUrl) || ERP_BASE;
    const withTokens = isTokenExempt(path)
        ? body
        : { ...body, securityToken: session?.securityToken || '', deviceIdUUID: session?.deviceIdUUID || '' };

    const response = await fetchImpl(`${base}/${path}`, {
        method: 'POST',
        headers: MOBILE_HEADERS,
        body: encodeForm(withTokens),
    });
    const payload = await readJson(response);
    return { response, payload };
}

/**
 * Normalize a successful (`status==1`) login response into Presence's session shape.
 * securityToken comes from the top-level `token` (init-app.js:12038/12484).
 */
function parseMobileSession(payload, deviceIdUUID = '') {
    const d = firstData(payload.data);
    const session = {
        userId:        String(d.userId || payload.userId || ''),
        sessionId:     String(d.sessionId || payload.sessionId || ''),
        roleId:        String(d.roleId || payload.roleId || ''),
        apiKey:        String(d.apiKey || d.appKey || payload.apiKey || ''),
        securityToken: String(payload.token || d.token || ''),
        deviceIdUUID:  String(deviceIdUUID || d.deviceIdUUID || ''),
        studentId:     String(d.studentId || d.userId || payload.studentId || ''),
        studentName:   String(d.name || d.profileName || payload.name || ''),
        studentPhoto:  String(d.photo || payload.photo || ''),
    };
    // roleId==2 (parent) acts on the child's userId.
    if (String(session.roleId) === '2' && d.fatherUserId) session.userId = String(d.fatherUserId);
    return session;
}

/**
 * Turn a raw appLoginAuthV2 payload into a discriminated outcome.
 * Pure (no I/O) so it can be unit-tested against captured payloads.
 *   → { outcome: 'ok', session }
 *   → { outcome: 'mfa', authUserId, otpHint }
 *   → throws Error{code} on 0/3/5/validation/inactive
 */
function interpretLogin(payload, deviceIdUUID = '') {
    const status = String(payload?.status ?? '');

    if (status === '1') {
        return { outcome: 'ok', session: parseMobileSession(payload, deviceIdUUID) };
    }

    if (status === '4') {
        const d = firstData(payload.data);
        const authUserId = String(String(d.roleId) === '2' ? d.fatherUserId : d.userId);
        return { outcome: 'mfa', authUserId, otpHint: payload.mobileString || '' };
    }

    if (String(payload?.verificationStatus ?? '') === '8') {
        const err = new Error(payload.validation || 'Validation error');
        err.code = 'ERP_REJECTED';
        throw err;
    }

    const messages = {
        '0': 'Invalid username or password',
        '3': 'No phone number on file with your institute — cannot send OTP.',
        '5': 'No email on file with your institute — cannot send OTP.',
    };
    const err = new Error(messages[status] || 'User is inactive. Please contact your institute admin.');
    err.code = status === '0' ? 'ERP_REJECTED' : 'ERP_LOGIN_BLOCKED';
    throw err;
}

/**
 * Perform the mobile login. Returns interpretLogin's outcome.
 * `device` is the platform string ("android"/"ios"). Mock creds short-circuit for dev.
 */
async function appLogin({ username, password, deviceIdUUID, device = 'android', baseUrl = ERP_BASE }, fetchImpl = fetch) {
    const response = await fetchImpl(`${baseUrl}/mobilev2/appLoginAuthV2`, {
        method: 'POST',
        headers: MOBILE_HEADERS,
        body: encodeForm({ txtUsername: username, txtPassword: password, deviceIdUUID, device }),
    });
    if (!response.ok) throw new Error('ERP login request failed');
    const payload = await readJson(response);
    return interpretLogin(payload, deviceIdUUID);
}

/**
 * Resolve a school's base URL via the gdemo directory. Optional — CUIET uses ERP_BASE.
 * Returns e.g. "https://cuiet.codebrigade.in" (no trailing slash, to match ERP_BASE).
 */
async function resolveBaseUrl(schoolCode, fetchImpl = fetch) {
    const response = await fetchImpl(CLIENT_DIRECTORY_URL, {
        method: 'POST',
        headers: MOBILE_HEADERS,
        body: encodeForm({ schoolCode }),
    });
    const payload = await readJson(response);
    const row = Array.isArray(payload) ? payload[0] : firstData(payload);
    if (!row || !row.client_abbr || !row.baseUrl) return null;
    return `https://${row.client_abbr}.${row.baseUrl}`.replace(/\/$/, '');
}

// ── Core data endpoints (see APK-FINDINGS.md §4) ─────────────────────────────

/**
 * Monthly day-by-day attendance. `month` = "July 2026" (empty = current month).
 * prevNext: 0=current, -1=prev, 1=next. Returns { response, payload, html }.
 */
async function fetchAttendanceMonth(session, { month = '', prevNext = '0' } = {}, fetchImpl = fetch) {
    const { response, payload } = await mobilePost('mobilev2/showAttendance', session, {
        prevNext: String(prevNext),
        userId: session.userId,
        sessionId: session.sessionId,
        apiKey: session.apiKey,
        roleId: session.roleId,
        month,
    }, fetchImpl);
    return { response, payload, html: extractHtml(payload) };
}

/** One weekday of timetable. day: 1=Mon … 6=Sat. Returns { response, payload, html }. */
async function fetchTimetableDay(session, day, fetchImpl = fetch) {
    const { response, payload } = await mobilePost('mobilev2/getClassTimeTable', session, {
        userId: session.userId,
        sessionId: session.sessionId,
        apiKey: session.apiKey,
        day: String(day),
        roleId: session.roleId,
    }, fetchImpl);
    return { response, payload, html: extractHtml(payload) };
}

module.exports = {
    ERP_BASE,
    MOBILE_HEADERS,
    encodeForm,
    readJson,
    extractHtml,
    firstData,
    mobilePost,
    parseMobileSession,
    interpretLogin,
    appLogin,
    resolveBaseUrl,
    fetchAttendanceMonth,
    fetchTimetableDay,
};
