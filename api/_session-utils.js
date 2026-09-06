/**
 * Shared session utilities for ERP serverless functions.
 * Handles encrypt/decrypt for both session tokens and persistent credential tokens.
 * Auto-refresh logic: try ERP call → on session failure → re-login → retry.
 */

const crypto = require('crypto');
const {
    loginLegacy,
    verifyOtpLegacy,
    encodeForm,
} = require('./_erp-provider');

const ERP_BASE    = process.env.ERP_BASE_URL;
const SCHOOL_CODE = process.env.ERP_SCHOOL_CODE || '800002';
const SECRET      = process.env.ENCRYPTION_SECRET;

// ── Encryption secret validation ──────────────────────────────────────
// Fail fast at module load — a weak or missing secret is a critical misconfiguration.
if (!SECRET || SECRET.length < 32) {
    throw new Error('ENCRYPTION_SECRET must be set and at least 32 characters long');
}

// Separate salts so the token types are cryptographically independent
const SESSION_SALT    = 'presence-erp-salt';
const PERSISTENT_SALT = 'presence-persistent-salt';
const OTP_TICKET_SALT = 'presence-otp-ticket-salt';

// ── Key derivation at module load — NOT per-request ───────────────────
// scryptSync is intentionally slow (KDF). Calling it per-request blocks the
// event loop for 50–200ms. Derive once at startup and reuse.
const SESSION_KEY    = crypto.scryptSync(SECRET, SESSION_SALT,    32);
const PERSISTENT_KEY = crypto.scryptSync(SECRET, PERSISTENT_SALT, 32);
const OTP_TICKET_KEY = crypto.scryptSync(SECRET, OTP_TICKET_SALT, 32);

const MOBILE_HEADERS = {
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Origin': 'null',
};

/**
 * Generate a deterministic Apple-style UUID from a username.
 * This produces a consistent, unique "device fingerprint" per user so the ERP
 * treats every login from our app as a trusted mobile device.
 *
 * Format: XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX (uppercase)
 */
function generateDeviceUUID(username) {
    const hash = crypto.createHash('md5')
        .update(`presence-device-${username}`)
        .digest('hex');
    return [
        hash.slice(0, 8),
        hash.slice(8, 12),
        hash.slice(12, 16),
        hash.slice(16, 20),
        hash.slice(20, 32),
    ].join('-').toUpperCase();
}


function _encrypt(data, key) {
    const iv     = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let enc = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    enc += cipher.final('hex');
    return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${enc}`;
}

function _decrypt(token, key) {
    const [ivHex, tagHex, enc] = token.split(':');
    if (!ivHex || !tagHex || !enc) throw new Error('Malformed token');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    let dec = decipher.update(enc, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return JSON.parse(dec);
}

/** Encrypt a session (userId/sessionId/roleId/apiKey) — no expiry */
function encryptSession(session) {
    return _encrypt(session, SESSION_KEY);
}

/** Decrypt a session token */
function decryptSession(token) {
    return _decrypt(token, SESSION_KEY);
}

/**
 * Extract the roll number embedded in a session token, or null if the token is
 * missing/forged/tampered. This is the trust anchor for admin authorization:
 * the token is AES-256-GCM sealed with a server-only secret, so a client cannot
 * forge one without completing a real ERP login. Never trust a roll number sent
 * in plaintext by the client — decode it from here instead.
 */
function decodeSessionRollNumber(token) {
    if (!token || typeof token !== 'string') return null;
    try {
        const roll = decryptSession(token).rollNumber;
        return roll ? String(roll).trim() : null;
    } catch {
        return null;
    }
}

/** Encrypt persistent credentials (username/password) — no expiry */
function encryptPersistent(creds) {
    return _encrypt(creds, PERSISTENT_KEY);
}

/** Decrypt persistent credentials */
function decryptPersistent(token) {
    return _decrypt(token, PERSISTENT_KEY);
}

// ── OTP tickets: bind authUserId to the username it was issued for ────
// The ERP's OTP-verify response proves "this OTP belongs to *some* real account"
// but never echoes back WHICH roll number that is. So the roll can only be known
// at login time, where we sent the username ourselves.
//
// Passing authUserId and username to /api/erp-verify-otp as two independent
// client fields let a caller complete their OWN OTP while claiming someone
// else's roll — including the admin's — because nothing tied the two together.
// Sealing them into one AES-GCM ticket at login makes that pairing unforgeable:
// the client hands the ticket straight back and cannot alter half of it.
const OTP_TICKET_MAX_AGE_MS = 15 * 60 * 1000;   // OTPs die long before this

function sealOtpTicket(authUserId, username) {
    return _encrypt({
        authUserId: String(authUserId),
        username:   String(username).trim(),
        iat:        Date.now(),
    }, OTP_TICKET_KEY);
}

/**
 * Open an OTP ticket.
 * @returns {{ authUserId: string, username: string } | null} null if the ticket is
 *          missing, forged, tampered with, or older than OTP_TICKET_MAX_AGE_MS.
 */
function openOtpTicket(ticket) {
    if (!ticket || typeof ticket !== 'string') return null;

    let data;
    try {
        data = _decrypt(ticket, OTP_TICKET_KEY);
    } catch {
        return null;    // forged, tampered, or minted under a different secret
    }

    const username = data.username ? String(data.username).trim() : '';
    if (!data.authUserId || !username) return null;
    if (!Number.isFinite(data.iat) || Date.now() - data.iat > OTP_TICKET_MAX_AGE_MS) return null;

    return { authUserId: String(data.authUserId), username };
}

/**
 * Verify an OTP with ERP and return the raw session data.
 * Shared by erp-verify-otp.js and erp-session.js to avoid duplication.
 *
 * @returns {{ userId, sessionId, roleId, apiKey, studentId, studentName }}
 * @throws on network failure or invalid OTP
 */
async function verifyOtpWithERP(authUserId, otp, deviceIdUUID = '') {
    // Forward deviceIdUUID so the ERP binds this device (trusted → future logins skip OTP)
    // and so the returned session carries it for /mobilev2/* auth.
    return verifyOtpLegacy(authUserId, otp, deviceIdUUID);
}

/**
 * Re-login to ERP using stored credentials.
 * Without OTP:
 *   - Trusted device (ERP status 1): returns { session, authUserId } — a full session,
 *     no OTP round-trip needed (the "silent refresh" path).
 *   - OTP demanded (status 4): returns { needsOtp: true, authUserId }.
 * With OTP: completes full flow, returns the session object directly.
 *
 * deviceIdUUID is derived deterministically from the username so the same "device" is
 * presented every time (the basis of the ERP's trusted-device / OTP-exemption behavior).
 */
async function reloginERP(username, password, otp = null) {
    const deviceIdUUID = generateDeviceUUID(username);
    const login = await loginLegacy(username, password, deviceIdUUID);

    if (otp) {
        return verifyOtpWithERP(String(login.authUserId), otp, deviceIdUUID);
    }

    // sessionId + apiKey only exist on a status-1 (trusted device) response;
    // an MFA challenge (status 4) parses without them.
    const s = login.session;
    if (s && s.sessionId && s.apiKey) {
        return { session: s, authUserId: login.authUserId };
    }
    return { needsOtp: true, authUserId: login.authUserId };
}

/**
 * Seal a full ERP session into a client token — the one shape used everywhere
 * (erp-verify-otp, erp-session refresh, and silent refresh in the data handlers).
 */
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

/**
 * Detect whether an ERP API response indicates a dead/invalid session.
 * ERP doesn't return HTTP 401 — it returns 200 with an error payload or
 * an empty/login-redirect HTML body.
 *
 * IMPORTANT: status === '0' alone is NOT a session error — ERP uses it for
 * many non-session failures (wrong OTP, bad input, etc.). Only treat it as
 * a session error when combined with session/login keywords.
 */
function isSessionDead(responseData, htmlBody = '') {
    if (!responseData && !htmlBody) return false;

    if (responseData) {
        const str = JSON.stringify(responseData).toLowerCase();
        if (
            // Session-specific error keywords
            (str.includes('session') && (str.includes('invalid') || str.includes('expired') || str.includes('logout'))) ||
            str.includes('please login') ||
            str.includes('unauthorized') ||
            // status '0' is only a session error when paired with session/login context
            (responseData.status === '0' && (str.includes('session') || str.includes('login'))) ||
            responseData.status === 'error'
        ) return true;
    }

    // HTML body that looks like a login redirect
    if (htmlBody && (
        (htmlBody.toLowerCase().includes('login') && htmlBody.length < 2000) ||
        htmlBody.toLowerCase().includes('session expired')
    )) return true;

    return false;
}

/**
 * Authoritative session-liveness probe — the exact call the official mobile app uses.
 * POSTs /mobilev2/checkUserStatusMobileApp; the ERP replies with the literal "1" while the
 * session is alive, or a JSON { message: "...session..." } once it is genuinely dead.
 * (Verified against real app traffic 2026-07-20: the app never re-logs-in in the background —
 * it just runs this probe and reuses one securityToken for the whole session.)
 *
 * Returns: true (alive) | false (confirmed dead) | null (ambiguous / network error).
 *
 * Callers MUST NOT trigger reloginERP (which emails an OTP) unless this returns exactly false.
 * Our HTML heuristics (isSessionDead) false-positive on transient/partial responses, and a full
 * re-login on this ERP ALWAYS demands a fresh OTP (there is no silent trusted-device refresh).
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
        if (body === '1') return true;                                  // definitively alive
        if (/session|login|expired|logout|unauthor/i.test(body)) return false; // definitively dead
        return null;                                                    // ambiguous — don't act
    } catch {
        return null;                                                    // network error — don't force re-login
    }
}

/**
 * Set CORS headers on a response.
 * Uses ALLOWED_ORIGIN env var if set, otherwise defaults to '*'.
 * Never throws — a missing env var should not crash the API.
 */
function setCorsHeaders(res) {
    const origin = process.env.ALLOWED_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin',  origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = {
    encryptSession,
    decryptSession,
    decodeSessionRollNumber,
    encryptPersistent,
    decryptPersistent,
    sealOtpTicket,
    openOtpTicket,
    reloginERP,
    mintSessionToken,
    verifyOtpWithERP,
    isSessionDead,
    checkSessionAlive,
    setCorsHeaders,
    encodeForm,
    generateDeviceUUID,
    MOBILE_HEADERS,
    ERP_BASE,
};
