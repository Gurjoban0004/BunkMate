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
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
};

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
async function verifyOtpWithERP(authUserId, otp) {
    const otpRes = await fetch(`${ERP_BASE}/mobile/verifyOtp`, {
        method: 'POST',
        headers: MOBILE_HEADERS,
        body: encodeForm({ authUserId, OTPText: otp }),
    });

    if (!otpRes.ok) throw new Error('OTP verification request failed');
    const otpData = await otpRes.json();

    if (otpData.error || otpData.status === '0' || otpData.status === 'error' || otpData.status === 'fail') {
        throw Object.assign(new Error(otpData.message || 'Invalid OTP'), { code: 'INVALID_OTP' });
    }

    const firstUser = Array.isArray(otpData.data) ? otpData.data[0] : otpData.data;
    if (!firstUser) throw new Error('Unexpected ERP OTP response');

    return {
        userId:      String(firstUser.userId      || otpData.userId      || ''),
        sessionId:   String(firstUser.sessionId   || otpData.sessionId   || ''),
        roleId:      String(firstUser.roleId      || otpData.roleId      || ''),
        apiKey:      String(firstUser.apiKey      || firstUser.appKey    || otpData.apiKey || ''),
        studentId:   String(firstUser.studentId   || firstUser.id        || ''),
        studentName: String(firstUser.name        || firstUser.profileName || ''),
        studentPhoto: String(firstUser.photo      || ''),
    };
}

/**
 * Re-login to ERP using stored credentials.
 * Without OTP: initiates login, returns { needsOtp: true, authUserId }.
 * With OTP: completes full flow, returns session object.
 */
async function reloginERP(username, password, otp = null) {
    // Step 1: init client (non-critical)
    await fetch(`${ERP_BASE}/mobile/getClientDetails`, {
        method: 'POST',
        headers: MOBILE_HEADERS,
        body: encodeForm({ schoolCode: SCHOOL_CODE }),
    }).catch(() => {});

    // Step 2: authenticate
    const loginRes  = await fetch(`${ERP_BASE}/mobile/appLoginAuthV2`, {
        method: 'POST',
        headers: MOBILE_HEADERS,
        body: encodeForm({ txtUsername: username, txtPassword: password }),
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

    // Step 3: verify OTP using shared helper
    return verifyOtpWithERP(String(authUserId), otp);
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
 * Set CORS headers on a response. Enforces ALLOWED_ORIGIN in production.
 * Falls back to '*' only in non-production environments.
 */
function setCorsHeaders(res) {
    const origin = process.env.ALLOWED_ORIGIN;
    if (!origin && process.env.NODE_ENV === 'production') {
        // Hard fail — misconfigured production deployment
        throw new Error('ALLOWED_ORIGIN must be set in production');
    }
    res.setHeader('Access-Control-Allow-Origin',  origin || '*');
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
    MOBILE_HEADERS,
    ERP_BASE,
};
