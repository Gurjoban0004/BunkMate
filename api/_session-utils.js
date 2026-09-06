/**
 * Shared session utilities for ERP serverless functions.
 *
 * Three sealed blobs cross the client boundary, all AES-256-GCM under a
 * server-only secret with independent derived keys:
 *   session token     — the live ERP session (userId/sessionId/apiKey/…)
 *   persistent token  — the credentials + device id used for silent re-login
 *   OTP ticket        — authUserId + username + password + device id, bound at login
 *
 * Every blob carries `iat`. Sessions go stale after SESSION_MAX_AGE_MS (the data
 * handlers then re-login instead of using it), persistent tokens die after
 * PERSISTENT_MAX_AGE_MS (the student signs in again), OTP tickets after 15 min.
 */

const crypto = require('crypto');
const { loginLegacy, verifyOtpLegacy, encodeForm } = require('./_erp-provider');

const ERP_BASE = process.env.ERP_BASE_URL;
const SECRET   = process.env.ENCRYPTION_SECRET;

// Fail fast at module load — a weak or missing secret is a critical misconfiguration.
if (!SECRET || SECRET.length < 32) {
    throw new Error('ENCRYPTION_SECRET must be set and at least 32 characters long');
}

// Separate salts so the token types are cryptographically independent.
const SESSION_SALT    = 'presence-erp-salt';
const PERSISTENT_SALT = 'presence-persistent-salt';
const OTP_TICKET_SALT = 'presence-otp-ticket-salt';

// scryptSync is intentionally slow. Derive once at module load, never per request.
const SESSION_KEY    = crypto.scryptSync(SECRET, SESSION_SALT,    32);
const PERSISTENT_KEY = crypto.scryptSync(SECRET, PERSISTENT_SALT, 32);
const OTP_TICKET_KEY = crypto.scryptSync(SECRET, OTP_TICKET_SALT, 32);

const SESSION_MAX_AGE_MS    = 30  * 24 * 60 * 60 * 1000;   // M3: a leaked session token stops working
const PERSISTENT_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;   // one semester of "remember me"
const OTP_TICKET_MAX_AGE_MS = 15  * 60 * 1000;             // OTPs die long before this

const MOBILE_HEADERS = {
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Origin': 'null',
};

// ── Device identity (audit C1) ────────────────────────────────────────
// The ERP's trusted-device exemption is keyed on deviceIdUUID. It used to be
// md5(username), which anyone could compute from a public roll number, turning
// the university's OTP into single-factor auth. Now the device id is a random
// UUID minted per install on the client (or here, if the client sent none) and
// sealed into the persistent token, so the same install keeps its trust and a
// new device correctly meets an OTP.
const DEVICE_ID_RE = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;

/** First candidate that is a well-formed UUID (uppercased), else a fresh random one. */
function resolveDeviceId(...candidates) {
    for (const c of candidates) {
        if (typeof c === 'string' && DEVICE_ID_RE.test(c.trim())) return c.trim().toUpperCase();
    }
    return crypto.randomUUID().toUpperCase();
}

// ── Input hygiene at the trust boundary ───────────────────────────────
/** Coerce an untrusted value to a trimmed string of bounded length ('' if not a string). */
function cleanString(value, max) {
    if (typeof value !== 'string') return '';
    const s = value.trim();
    return s.length > max ? '' : s;
}

/** Client IP as Vercel reports it. Never trusted for auth — only for rate-limit keys. */
function getClientIp(req) {
    const xff = String((req.headers && req.headers['x-forwarded-for']) || '');
    return xff.split(',')[0].trim() || 'unknown';
}

// ── Sealing ───────────────────────────────────────────────────────────
function _encrypt(data, key) {
    const iv     = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let enc = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    enc += cipher.final('hex');
    return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${enc}`;
}

function _decrypt(token, key) {
    if (typeof token !== 'string' || token.length > 16384) throw new Error('Malformed token');
    const [ivHex, tagHex, enc] = token.split(':');
    if (!ivHex || !tagHex || !enc) throw new Error('Malformed token');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    let dec = decipher.update(enc, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return JSON.parse(dec);
}

const ageOf = (data) => (Number.isFinite(data?.iat) ? Date.now() - data.iat : Infinity);

/** Seal a session. Callers go through mintSessionToken; this is the raw primitive. */
function encryptSession(session) {
    return _encrypt({ ...session, iat: Date.now() }, SESSION_KEY);
}

/** Open a session token. Throws on forgery/tampering. Staleness is a separate check. */
function decryptSession(token) {
    return _decrypt(token, SESSION_KEY);
}

/**
 * A session minted before the expiry policy existed has no iat; treat it as
 * stale so the next sync re-logs-in and mints a dated one.
 */
function isSessionStale(session) {
    return ageOf(session) > SESSION_MAX_AGE_MS;
}

/**
 * The roll number sealed inside a session token, or null if the token is
 * missing, forged, tampered with, or stale. This is the trust anchor for admin
 * authorization: never trust a roll number sent in plaintext by the client.
 */
function decodeSessionRollNumber(token) {
    if (!token || typeof token !== 'string') return null;
    try {
        const session = decryptSession(token);
        if (isSessionStale(session)) return null;
        const roll = session.rollNumber;
        return roll ? String(roll).trim() : null;
    } catch {
        return null;
    }
}

/** Seal credentials (+ device id) for silent re-login. */
function encryptPersistent(creds) {
    return _encrypt({ ...creds, iat: Date.now() }, PERSISTENT_KEY);
}

/**
 * Open a persistent token. Throws on forgery, and throws `PERSISTENT_EXPIRED`
 * once it is older than PERSISTENT_MAX_AGE_MS so the caller can ask for a
 * fresh sign-in rather than replaying semester-old credentials forever.
 */
function decryptPersistent(token) {
    const creds = _decrypt(token, PERSISTENT_KEY);
    if (ageOf(creds) > PERSISTENT_MAX_AGE_MS) {
        const err = new Error('Persistent token expired');
        err.code = 'PERSISTENT_EXPIRED';
        throw err;
    }
    return creds;
}

// ── OTP tickets ───────────────────────────────────────────────────────
// The ERP's OTP-verify response proves "this OTP belongs to *some* account" but
// never says which. Only the login step knows the username, password and device
// id the challenge was issued for, so all four are sealed together here and the
// client hands the ticket straight back. Nothing in it can be swapped.
function sealOtpTicket(authUserId, username, { password = '', deviceId = '' } = {}) {
    return _encrypt({
        authUserId: String(authUserId),
        username:   String(username).trim(),
        password:   String(password),
        deviceId:   String(deviceId),
        iat:        Date.now(),
    }, OTP_TICKET_KEY);
}

/**
 * @returns {{ authUserId, username, password, deviceId } | null}
 *   null if missing, forged, tampered with, or older than 15 minutes.
 */
function openOtpTicket(ticket) {
    if (!ticket || typeof ticket !== 'string') return null;
    let data;
    try {
        data = _decrypt(ticket, OTP_TICKET_KEY);
    } catch {
        return null;
    }
    const username = data.username ? String(data.username).trim() : '';
    if (!data.authUserId || !username) return null;
    if (ageOf(data) > OTP_TICKET_MAX_AGE_MS) return null;
    return {
        authUserId: String(data.authUserId),
        username,
        password: typeof data.password === 'string' ? data.password : '',
        deviceId: typeof data.deviceId === 'string' ? data.deviceId : '',
    };
}

/** A stable, non-reversible handle for a ticket — used as the OTP attempt-counter key. */
function ticketFingerprint(ticket) {
    return crypto.createHash('sha256').update(String(ticket)).digest('hex').slice(0, 32);
}

// ── ERP round-trips ───────────────────────────────────────────────────
async function verifyOtpWithERP(authUserId, otp, deviceIdUUID) {
    return verifyOtpLegacy(authUserId, otp, deviceIdUUID);
}

/**
 * Re-login to ERP with stored credentials, presenting `deviceId`.
 *   - trusted device (ERP status 1) → { session, authUserId }
 *   - OTP demanded   (ERP status 4) → { needsOtp: true, authUserId }
 * With `otp` set, completes the full flow and returns the session directly.
 */
async function reloginERP(username, password, otp, deviceId) {
    const deviceIdUUID = resolveDeviceId(deviceId);
    const login = await loginLegacy(username, password, deviceIdUUID);

    if (otp) return verifyOtpWithERP(String(login.authUserId), otp, deviceIdUUID);

    // sessionId + apiKey only exist on a status-1 (trusted device) response;
    // an MFA challenge (status 4) parses without them.
    const s = login.session;
    if (s && s.sessionId && s.apiKey) return { session: s, authUserId: login.authUserId, deviceId: deviceIdUUID };
    return { needsOtp: true, authUserId: login.authUserId, deviceId: deviceIdUUID };
}

/** Seal a full ERP session into a client token — the one shape used everywhere. */
function mintSessionToken(session, { username = '', studentName = '', isMock = false } = {}) {
    return encryptSession({
        rollNumber:    username ? String(username).trim() : '',
        userId:        session.userId,
        sessionId:     session.sessionId,
        roleId:        session.roleId,
        apiKey:        session.apiKey,
        securityToken: session.securityToken || '',
        deviceIdUUID:  session.deviceIdUUID || '',
        studentId:     session.studentId,
        studentName:   session.studentName || studentName || '',
        studentPhoto:  session.studentPhoto || '',
        isMock:        session.isMock || isMock || false,
    });
}

/** Seal credentials for silent re-login. Always carries the device id (C1). */
function mintPersistentToken({ username, password, deviceId, studentName = '', isMock = false }) {
    return encryptPersistent({
        username:    String(username).trim(),
        password:    String(password),
        deviceId:    resolveDeviceId(deviceId),
        studentName: studentName || '',
        isMock:      !!isMock,
    });
}

/**
 * Detect whether an ERP API response indicates a dead/invalid session.
 * ERP doesn't return HTTP 401 — it returns 200 with an error payload or
 * an empty/login-redirect HTML body.
 *
 * status === '0' alone is NOT a session error — ERP uses it for many
 * non-session failures. Only treat it as one alongside session/login keywords.
 */
function isSessionDead(responseData, htmlBody = '') {
    if (!responseData && !htmlBody) return false;

    if (responseData) {
        const str = JSON.stringify(responseData).toLowerCase();
        if (
            (str.includes('session') && (str.includes('invalid') || str.includes('expired') || str.includes('logout'))) ||
            str.includes('please login') ||
            str.includes('unauthorized') ||
            (responseData.status === '0' && (str.includes('session') || str.includes('login'))) ||
            responseData.status === 'error'
        ) return true;
    }

    if (htmlBody && (
        (htmlBody.toLowerCase().includes('login') && htmlBody.length < 2000) ||
        htmlBody.toLowerCase().includes('session expired')
    )) return true;

    return false;
}

/**
 * Authoritative session-liveness probe — the exact call the official mobile app uses.
 * Returns true (alive) | false (confirmed dead) | null (ambiguous / network error).
 *
 * Callers MUST NOT trigger reloginERP (which emails an OTP) unless this returns exactly false.
 */
async function checkSessionAlive(session) {
    if (!ERP_BASE || !session?.userId) return null;
    try {
        const res = await fetch(`${ERP_BASE}/mobilev2/checkUserStatusMobileApp`, {
            method: 'POST',
            headers: MOBILE_HEADERS,
            body: encodeForm({
                userId:        session.userId,
                roleId:        session.roleId,
                securityToken: session.securityToken || '',
                deviceIdUUID:  session.deviceIdUUID || '',
            }),
        });
        const body = (await res.text()).replace(/\s/g, '');
        if (body === '1') return true;
        if (/session|login|expired|logout|unauthor/i.test(body)) return false;
        return null;
    } catch {
        return null;
    }
}

// ── CORS (Check 21/22) ────────────────────────────────────────────────
// The PWA calls /api/* same-origin and native apps send no Origin header, so no
// legitimate caller needs CORS at all. Browsers on other origins only get a
// permissive header if ALLOWED_ORIGIN lists them (comma-separated). A literal
// "*" is honoured for local development only.
function setCorsHeaders(res, req) {
    const origin = String((req && req.headers && req.headers.origin) || '');
    const allowed = String(process.env.ALLOWED_ORIGIN || '')
        .split(',').map(s => s.trim()).filter(Boolean);

    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '600');

    if (!origin) return;
    if (allowed.includes('*') || allowed.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
}

module.exports = {
    encryptSession,
    decryptSession,
    isSessionStale,
    decodeSessionRollNumber,
    encryptPersistent,
    decryptPersistent,
    sealOtpTicket,
    openOtpTicket,
    ticketFingerprint,
    reloginERP,
    mintSessionToken,
    mintPersistentToken,
    verifyOtpWithERP,
    isSessionDead,
    checkSessionAlive,
    setCorsHeaders,
    resolveDeviceId,
    cleanString,
    getClientIp,
    encodeForm,
    MOBILE_HEADERS,
    ERP_BASE,
    SESSION_MAX_AGE_MS,
    PERSISTENT_MAX_AGE_MS,
};
