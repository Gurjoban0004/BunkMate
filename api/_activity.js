/**
 * The server-side activity ledger — who signed in, when, and who is using the
 * app right now.
 *
 * WHY THIS EXISTS
 * The admin panel used to read only what the *client* wrote to Firestore
 * (users/{roll}, telemetry/{roll}/syncs). Every one of those writes
 * sits behind a chain the student's phone has to complete: mint a custom token
 * → Firebase sign-in → pass the security rules. Any broken link in that chain
 * and the panel is silently empty, which is exactly what it was: a friend
 * signed in and nothing showed up.
 *
 * This module writes from the serverless function instead, with the Admin SDK.
 * It bypasses rules, needs no client sign-in, and runs on the one code path a
 * student cannot avoid — the call that talks to the college. If a login
 * happened, it is recorded here.
 *
 * WHAT IT STORES  (admin/activity/**, server-only — see firestore.rules)
 *   students/{rollNumber}  the roster: first seen, last login, last seen,
 *                          counters, device ids, app version
 *   logins/{autoId}        one event per sign-in attempt, success or not
 *
 * PRIVACY: no passwords, no session tokens, and no raw IP addresses — an IP is
 * stored only as a truncated keyed hash, enough to tell "same network" apart
 * from "different network" and not enough to recover the address.
 *
 * Every function here is fire-and-forget: telemetry must never fail a login.
 */

const crypto = require('crypto');
const { adminDb } = require('./_firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

// Roll numbers become document ids, so they must be a single safe path segment.
const ROLL_RE = /^[A-Za-z0-9_-]{1,64}$/;
const safeRoll = (roll) => {
    const s = String(roll || '').trim();
    return ROLL_RE.test(s) ? s : null;
};

const studentRef = (roll) => adminDb.doc(`admin/activity/students/${roll}`);
const loginsCol  = () => adminDb.collection('admin/activity/logins');

// Login events are a rolling window, not an archive. `expiresAt` is what a
// Firestore TTL policy reaps on (same pattern as telemetry syncs).
const LOGIN_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

// An IP is a rate-limit key elsewhere; here it is only ever a coarse
// "same network?" signal, so it is keyed-hashed and truncated. Without a
// secret this returns null rather than storing anything identifying.
const IP_SALT = process.env.ENCRYPTION_SECRET || '';
function hashIp(ip) {
    if (!IP_SALT || !ip || ip === 'unknown') return null;
    return crypto.createHmac('sha256', IP_SALT).update(String(ip)).digest('hex').slice(0, 12);
}

/** Bounded, trimmed string or null — these values come from the network. */
const trim = (v, max) => {
    if (typeof v !== 'string') return null;
    const s = v.trim();
    return s ? s.slice(0, max) : null;
};

/**
 * Record one sign-in attempt and update the student's roster entry.
 *
 * @param {Object} p
 * @param {string} p.rollNumber  college id the attempt was for
 * @param {'trusted'|'otp-sent'|'otp-verified'|'rejected'|'error'} p.outcome
 * @param {string} [p.method]    which endpoint: 'password' | 'otp'
 * @param {string} [p.studentName]
 * @param {string} [p.deviceId]
 * @param {string} [p.ip]
 * @param {string} [p.userAgent]
 * @param {string} [p.appVersion]
 * @param {string} [p.platform]
 * @param {boolean} [p.isMock]
 */
async function recordLogin({
    rollNumber, outcome, method = 'password', studentName = null, deviceId = null,
    ip = null, userAgent = null, appVersion = null, platform = null, isMock = false,
}) {
    const roll = safeRoll(rollNumber);
    if (!roll) return;

    const now = FieldValue.serverTimestamp();
    const ipHash = hashIp(ip);
    // A failed attempt is a real signal (wrong password, revoked, college down)
    // but it is not a sign-in: only a success advances the roster's counters.
    const succeeded = outcome === 'trusted' || outcome === 'otp-verified';

    const event = {
        rollNumber: roll,
        outcome,
        method,
        at: now,
        expiresAt: new Date(Date.now() + LOGIN_RETENTION_MS),
        ...(deviceId ? { deviceId } : {}),
        ...(ipHash ? { ipHash } : {}),
        ...(trim(userAgent, 200) ? { userAgent: trim(userAgent, 200) } : {}),
        ...(trim(appVersion, 32) ? { appVersion: trim(appVersion, 32) } : {}),
        ...(trim(platform, 32) ? { platform: trim(platform, 32) } : {}),
        ...(isMock ? { isMock: true } : {}),
    };

    const roster = {
        rollNumber: roll,
        lastLoginAt: now,
        lastLoginOutcome: outcome,
        lastSeenAt: now,
        createdAt: now,                                  // only lands on create (see below)
        loginAttempts: FieldValue.increment(1),
        ...(succeeded ? { loginCount: FieldValue.increment(1), lastSuccessAt: now } : {}),
        ...(trim(studentName, 120) ? { studentName: trim(studentName, 120) } : {}),
        ...(trim(appVersion, 32) ? { appVersion: trim(appVersion, 32) } : {}),
        ...(trim(platform, 32) ? { platform: trim(platform, 32) } : {}),
        ...(ipHash ? { lastIpHash: ipHash } : {}),
        ...(deviceId ? { deviceIds: FieldValue.arrayUnion(deviceId) } : {}),
        ...(isMock ? { isMock: true } : {}),
    };

    try {
        // `createdAt` must mean *first* seen. A merge would overwrite it on every
        // login, so it is stripped unless this is genuinely a new roster entry.
        const ref = studentRef(roll);
        const existing = await ref.get();
        if (existing.exists) delete roster.createdAt;

        await Promise.all([
            ref.set(roster, { merge: true }),
            loginsCol().add(event),
        ]);
    } catch (err) {
        console.warn('[ACTIVITY] login record failed (non-critical):', err.message);
    }
}

// ── Liveness ─────────────────────────────────────────────────────────
// "Who has the app open right now" is answered by a heartbeat on the data
// endpoints: the app syncs every 3 minutes while it is in the foreground, so a
// student seen inside the last 5 minutes is a student with the app open.
//
// One Firestore write per sync per student would be pure waste, so a warm
// lambda remembers who it has already stamped. This is per-instance, so a cold
// start writes once more than strictly needed — which is the correct trade:
// the alternative is a read before every write.
// ponytail: in-memory throttle, per-instance. Move to a shared counter only if
// the write volume ever actually shows up on the bill.
const HEARTBEAT_THROTTLE_MS = 60 * 1000;
const lastStamped = new Map();

function stampedRecently(roll) {
    const at = lastStamped.get(roll);
    if (at && Date.now() - at < HEARTBEAT_THROTTLE_MS) return true;
    lastStamped.set(roll, Date.now());
    // The map is keyed by roll number and a lambda is short-lived, but a long
    // running instance should not grow forever.
    if (lastStamped.size > 5000) lastStamped.clear();
    return false;
}

/**
 * Mark a student as active now. Called from the shared session opener, so it
 * fires on every attendance/calendar/timetable/session request.
 * Never awaited by callers — it must not add latency to a sync.
 */
function touchActive(rollNumber, { appVersion = null, platform = null, ip = null } = {}) {
    const roll = safeRoll(rollNumber);
    if (!roll || stampedRecently(roll)) return;

    // try/catch, not just .catch(): building the ref and the field values can
    // throw synchronously (a misconfigured Admin SDK does exactly that), and a
    // heartbeat is never allowed to take a student's sync down with it.
    try {
        const ipHash = hashIp(ip);
        studentRef(roll).set({
            rollNumber: roll,
            lastSeenAt: FieldValue.serverTimestamp(),
            syncCount: FieldValue.increment(1),
            ...(trim(appVersion, 32) ? { appVersion: trim(appVersion, 32) } : {}),
            ...(trim(platform, 32) ? { platform: trim(platform, 32) } : {}),
            ...(ipHash ? { lastIpHash: ipHash } : {}),
        }, { merge: true }).catch((err) => {
            console.warn('[ACTIVITY] heartbeat failed (non-critical):', err.message);
        });
    } catch (err) {
        console.warn('[ACTIVITY] heartbeat unavailable (non-critical):', err.message);
    }
}

/** Client build info, as the app reports it in headers. Untrusted, bounded. */
function clientMeta(req) {
    const h = (req && req.headers) || {};
    const body = (req && req.body) || {};
    return {
        appVersion: trim(h['x-presence-version'] || body.appVersion, 32),
        platform: trim(h['x-presence-platform'] || body.platform, 32),
        userAgent: trim(h['user-agent'], 200),
    };
}

module.exports = { recordLogin, touchActive, clientMeta, safeRoll, hashIp };
