/**
 * Shared session utilities for ERP serverless functions.
 * Handles encrypt/decrypt for both session tokens and persistent credential tokens.
 * Auto-refresh logic: try ERP call → on session failure → re-login → retry.
 */

const crypto = require('crypto');

const ERP_BASE    = process.env.ERP_BASE_URL;
const SCHOOL_CODE = process.env.ERP_SCHOOL_CODE || '800002';
const SECRET      = process.env.ENCRYPTION_SECRET;

// ── Encryption secret validation ──────────────────────────────────────
// Fail fast at module load — a weak or missing secret is a critical misconfiguration.
if (!SECRET || SECRET.length < 32) {
    throw new Error('ENCRYPTION_SECRET must be set and at least 32 characters long');
}

// Two separate salts so the two token types are cryptographically independent
const SESSION_SALT    = 'presence-erp-salt';
const PERSISTENT_SALT = 'presence-persistent-salt';

// ── Key derivation at module load — NOT per-request ───────────────────
// scryptSync is intentionally slow (KDF). Calling it per-request blocks the
// event loop for 50–200ms. Derive once at startup and reuse.
const SESSION_KEY    = crypto.scryptSync(SECRET, SESSION_SALT,    32);
const PERSISTENT_KEY = crypto.scryptSync(SECRET, PERSISTENT_SALT, 32);

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

function encodeForm(obj) {
    return Object.entries(obj)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
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

/** Encrypt persistent credentials (username/password) — no expiry */
function encryptPersistent(creds) {
    return _encrypt(creds, PERSISTENT_KEY);
}

/** Decrypt persistent credentials */
function decryptPersistent(token) {
    return _decrypt(token, PERSISTENT_KEY);
}

/**
 * Verify an OTP with ERP and return the raw session data.
 * Shared by erp-verify-otp.js and erp-session.js to avoid duplication.
 *
 * @returns {{ userId, sessionId, roleId, apiKey, studentId, studentName }}
 * @throws on network failure or invalid OTP
 */
async function verifyOtpWithERP(authUserId, otp, deviceIdUUID = '') {
    const otpRes = await fetch(`${ERP_BASE}/mobilev2/verifyOtp`, {
        method: 'POST',
        headers: MOBILE_HEADERS,
        body: encodeForm({
            deviceIdUUID: deviceIdUUID,
            OTPText:      otp,
            authUserId:   authUserId,
        }),
    });

    if (!otpRes.ok) throw new Error('OTP verification request failed');
    const otpData = await otpRes.json();

    if (otpData.error || otpData.status === '0' || otpData.status === 'error' || otpData.status === 'fail') {
        throw Object.assign(new Error(otpData.message || 'Invalid OTP'), { code: 'INVALID_OTP' });
    }

    const firstUser = Array.isArray(otpData.data) ? otpData.data[0] : otpData.data;
    if (!firstUser) throw new Error('Unexpected ERP OTP response');

    return {
        userId:       String(firstUser.userId      || otpData.userId      || ''),
        sessionId:    String(firstUser.sessionId   || otpData.sessionId   || ''),
        roleId:       String(firstUser.roleId      || otpData.roleId      || ''),
        apiKey:       String(firstUser.apiKey      || firstUser.appKey    || otpData.apiKey || ''),
        studentId:    String(firstUser.studentId   || firstUser.id        || ''),
        studentName:  String(firstUser.name        || firstUser.profileName || ''),
        studentPhoto: String(firstUser.photo       || ''),
        securityToken: String(firstUser.token      || otpData.token       || ''),
    };
}

/**
 * Re-login to ERP using stored credentials.
 * Without OTP: initiates login, returns { needsOtp: true, authUserId }.
 * With OTP: completes full flow, returns session object.
 */
async function reloginERP(username, password, otp = null) {
    const deviceIdUUID = generateDeviceUUID(username);

    // Step 1: authenticate via mobilev2 (no getClientDetails needed)
    const loginRes = await fetch(`${ERP_BASE}/mobilev2/appLoginAuthV2`, {
        method: 'POST',
        headers: MOBILE_HEADERS,
        body: encodeForm({
            deviceIdUUID,
            device:      'iOS',
            txtUsername: username,
            txtPassword: password,
        }),
    });
    if (!loginRes.ok) throw new Error('ERP login request failed');
    const loginData = await loginRes.json();

    if (loginData.status === '0' || loginData.error) {
        throw new Error(loginData.message || 'ERP credentials rejected — password may have changed');
    }

    const firstLoginUser = Array.isArray(loginData.data) ? loginData.data[0] : loginData.data;
    const authUserId     = loginData.authUserId || firstLoginUser?.userId || loginData.userId;
    if (!authUserId) throw new Error('No authUserId in ERP login response');

    if (!otp) {
        return { needsOtp: true, authUserId: String(authUserId) };
    }

    // Step 2: verify OTP using shared helper (with deviceIdUUID)
    return verifyOtpWithERP(String(authUserId), otp, deviceIdUUID);
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
 * Set CORS headers on a response.
 * Uses ALLOWED_ORIGIN env var if set, otherwise defaults to '*'.
 * Never throws — a missing env var should not crash the API.
 */
function setCorsHeaders(res) {
    const origin = process.env.ALLOWED_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin',  origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = {
    encryptSession,
    decryptSession,
    encryptPersistent,
    decryptPersistent,
    reloginERP,
    verifyOtpWithERP,
    isSessionDead,
    setCorsHeaders,
    encodeForm,
    generateDeviceUUID,
    MOBILE_HEADERS,
    ERP_BASE,
};
