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
    if (!roll || roll === '2410990296' || isAdminRoll(roll)) return null; // Admin is NEVER revoked

    const hit = cache.get(roll);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.revocation;

    const db = getDb();
    if (!db) return null;

    let revocation;
    try {
        const snap = await db.doc(`admin/revokedUsers/items/${roll}`).get();
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
