/**
 * Server-side revocation enforcement.
 *
 * The client-side RevokedGate is cosmetic — it only runs at app launch and a
 * revoked user who never restarts (or who tampers with the bundle) keeps
 * syncing. This is the real gate: every endpoint that decrypts a session token
 * checks here, so revoking access actually stops data flowing.
 *
 * Fails OPEN on infrastructure errors. A Firestore outage or a missing service
 * account must never lock every student out of their own attendance — the
 * blast radius of failing closed is far worse than a revoked user getting a
 * few extra syncs.
 */

// Lazy + guarded: erp-* endpoints did not previously depend on the Admin SDK.
// If it cannot initialise, revocation is skipped rather than 500-ing every sync.
let adminDb = null;
let adminDbInitFailed = false;

function getDb() {
    if (adminDb || adminDbInitFailed) return adminDb;
    try {
        adminDb = require('./_firebase-admin').adminDb;
    } catch (err) {
        adminDbInitFailed = true;
        console.error('Revocation checks disabled — Admin SDK unavailable:', err.message);
    }
    return adminDb;
}

// A revocation read that hangs (cold Firestore, credential discovery, a blip)
// must not stall every sync for the function's whole budget. Past this the
// lookup counts as an infrastructure error — fail open, like any other error.
const LOOKUP_TIMEOUT_MS = 4000;
const withTimeout = (promise, ms) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms).unref?.()),
]);

// Serverless instances are reused, so this cache spares a Firestore read on
// every attendance/calendar/timetable call. A revoke takes effect within the
// TTL; syncs are 3 min apart, so the lag is not observable in practice.
const TTL_MS = 60 * 1000;
const cache = new Map();

// Lazy for the same reason as getDb(): an eager require here defeats the guard
// above — a throwing Admin SDK takes down every endpoint that imports this file
// at module load, before any handler code can turn it into a JSON error.
function isAdminRoll(roll) {
    try {
        return require('./_firebase-admin').isAdminRoll(roll);
    } catch {
        return false;   // SDK down → getDb() returns null anyway, so nobody is revoked
    }
}

/** @returns {Promise<Object|null>} the revocation record, or null if not revoked */
async function getRevocation(rollNumber) {
    if (!rollNumber) return null;
    const roll = String(rollNumber).trim();
    if (!roll || isAdminRoll(roll)) return null;   // an admin is never revoked

    const hit = cache.get(roll);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.revocation;

    const db = getDb();
    if (!db) return null;

    let revocation;
    try {
        const snap = await withTimeout(db.doc(`admin/revokedUsers/items/${roll}`).get(), LOOKUP_TIMEOUT_MS);
        revocation = snap.exists ? (snap.data() || {}) : null;
    } catch (err) {
        console.error('Revocation lookup failed:', err.message);
        return hit ? hit.revocation : null;   // serve stale rather than fail closed
    }

    cache.set(roll, { at: Date.now(), revocation });
    return revocation;
}

/**
 * Sends a 403 and returns true if the roll number is revoked.
 * Usage: `if (await blockIfRevoked(res, session.rollNumber)) return;`
 */
async function blockIfRevoked(res, rollNumber) {
    const revocation = await getRevocation(rollNumber);
    if (!revocation) return false;
    res.status(403).json({
        error: revocation.reason || 'Your access to Presence has been revoked.',
        revoked: true,
    });
    return true;
}

/** Test seam — drops the TTL cache. */
function _clearRevocationCache() {
    cache.clear();
}

module.exports = { getRevocation, blockIfRevoked, _clearRevocationCache };
