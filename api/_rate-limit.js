/**
 * Fixed-window rate limiter backed by Firestore (audit C2, C4, M1; Check 1).
 *
 * One document per (scope, key) at rateLimits/{hash}. Serverless instances share
 * nothing, so an in-memory counter would reset on every cold start and could be
 * sidestepped by spreading requests across instances; Firestore is the only
 * state the functions already have.
 *
 * Fails OPEN on infrastructure errors: a Firestore outage must not turn into a
 * login outage. It never fails open on a *policy* decision — a counter that
 * reads over the limit always denies.
 *
 * Costs one transaction per guarded request, so it guards the low-volume,
 * high-value endpoints (login, OTP, admin, token minting) and not the
 * three-minute data syncs. ponytail: if abuse of the data endpoints ever
 * matters, add an in-memory per-instance limiter there rather than paying a
 * Firestore write per sync.
 */

const crypto = require('crypto');

let adminDb = null;
let initFailed = false;
function getDb() {
    if (adminDb || initFailed) return adminDb;
    try {
        adminDb = require('./_firebase-admin').adminDb;
    } catch (err) {
        initFailed = true;
        console.error('Rate limiting disabled — Admin SDK unavailable:', err.message);
    }
    return adminDb;
}

// Bounded wait: a limiter that stalls is worse than one that fails open.
const TX_TIMEOUT_MS = 4000;
const withTimeout = (promise, ms) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms).unref?.()),
]);

function docId(scope, key) {
    return crypto.createHash('sha256').update(`${scope}:${key}`).digest('hex').slice(0, 32);
}

/**
 * Consume one attempt. Resolves true if the request may proceed.
 * @param {string} scope   e.g. 'erp-login-ip'
 * @param {string} key     e.g. the client IP or a ticket fingerprint
 * @param {{ max: number, windowMs: number }} policy
 */
async function allowAttempt(scope, key, { max, windowMs }) {
    const db = getDb();
    if (!db) return true;
    const ref = db.doc(`rateLimits/${docId(scope, key)}`);
    const now = Date.now();
    try {
        return await withTimeout(db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            const data = snap.exists ? snap.data() : null;
            if (!data || now - (data.windowStart || 0) > windowMs) {
                tx.set(ref, { scope, windowStart: now, count: 1, expiresAt: new Date(now + 2 * windowMs) });
                return true;
            }
            if ((data.count || 0) >= max) return false;
            tx.update(ref, { count: (data.count || 0) + 1 });
            return true;
        }), TX_TIMEOUT_MS);
    } catch (err) {
        console.error('Rate limiter error (failing open):', err.message);
        return true;
    }
}

/**
 * Guard a handler: sends 429 and resolves true if the caller is over the limit.
 * Usage: `if (await tooManyAttempts(res, 'erp-login-ip', ip, POLICY)) return;`
 */
async function tooManyAttempts(res, scope, key, policy) {
    if (await allowAttempt(scope, key, policy)) return false;
    res.setHeader('Retry-After', String(Math.ceil(policy.windowMs / 1000)));
    res.status(429).json({ error: 'Too many attempts. Please try again in a few minutes.' });
    return true;
}

module.exports = { allowAttempt, tooManyAttempts };
