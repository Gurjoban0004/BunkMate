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
 *   days/{YYYY-MM-DD}      one college day (IST): screen views, all students
 *   days/{day}/students/{rollNumber}
 *                          that student's day: a beat per minute the app
 *                          talked to us, and which screens they opened
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
        ...(trim(studentName, 120) ? { studentName: trim(studentName, 120) } : {}),
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

// ── Daily usage ──────────────────────────────────────────────────────
// "Who opened the app today, at what time, for how long, and what did they
// use" is stored as one document per student per college day holding a beat —
// the epoch minute — for every minute the app talked to us. Sessions are
// derived from the beats when the panel reads them, so a write never needs a
// read first, and APKs that predate the usage ping still leave beats through
// their three-minute syncs and the session check on launch.

const TZ = 'Asia/Kolkata';   // the college's day, not the server's (UTC)
const DAY_MS = 24 * 60 * 60 * 1000;
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
/** 'YYYY-MM-DD' of the college day containing `ms`. */
const dayKey = (ms = Date.now()) => dayFmt.format(new Date(ms));
/** Epoch ms of IST midnight starting that day. */
const dayStartMs = (day) => Date.parse(`${day}T00:00:00+05:30`);

const DAY_RETENTION_MS = 120 * DAY_MS;

// A foreground app pings every two minutes and syncs every three, so beats
// further apart than this are two separate openings.
const SESSION_GAP_MIN = 5;

/** Beats (epoch minutes) → [{ start, end, minutes }], oldest first. */
function sessionsFromBeats(beats) {
    const mins = [...new Set((beats || []).map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
    const runs = [];
    for (const m of mins) {
        const last = runs[runs.length - 1];
        if (last && m - last[1] <= SESSION_GAP_MIN) last[1] = m;
        else runs.push([m, m]);
    }
    return runs.map(([first, lastMin]) => ({
        start: first * 60000,
        end: (lastMin + 1) * 60000,
        minutes: lastMin - first + 1,
    }));
}

// Screens the app reports. A whitelist, because these become map keys in a
// document a student's own token can write to.
const SCREENS = new Set([
    'TodayMain', 'SubjectsList', 'SubjectDetail', 'SubjectPlanner', 'Insights', 'InsightsMain',
    'Settings', 'EditTimetable', 'EditSubjects', 'ERPConnect', 'AdminMain',
]);
const MAX_VIEWS_PER_PING = 50;

function pickScreens(screens) {
    const out = {};
    if (!screens || typeof screens !== 'object') return out;
    for (const name of SCREENS) {
        const n = Math.min(Math.floor(Number(screens[name])), MAX_VIEWS_PER_PING);
        if (n > 0) out[name] = n;
    }
    return out;
}

/** One beat (and any screen views) into today's documents. May throw synchronously. */
function writeDay(roll, meta, screens = {}) {
    const now = Date.now();
    const day = dayKey(now);
    const expiresAt = new Date(now + DAY_RETENTION_MS);
    const views = Object.fromEntries(Object.entries(screens).map(([k, n]) => [k, FieldValue.increment(n)]));
    const hasViews = Object.keys(views).length > 0;

    const writes = [adminDb.doc(`admin/activity/days/${day}/students/${roll}`).set({
        rollNumber: roll,
        lastSeenAt: FieldValue.serverTimestamp(),
        beats: FieldValue.arrayUnion(Math.floor(now / 60000)),
        expiresAt,
        ...(meta.studentName ? { studentName: meta.studentName } : {}),
        ...(meta.appVersion ? { appVersion: meta.appVersion } : {}),
        ...(meta.platform ? { platform: meta.platform } : {}),
        ...(hasViews ? { screens: views } : {}),
    }, { merge: true })];
    if (hasViews) {
        writes.push(adminDb.doc(`admin/activity/days/${day}`).set({ day, screens: views, expiresAt }, { merge: true }));
    }
    return Promise.all(writes);
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
const PING_FLOOR_MS = 20 * 1000;
const lastStamped = new Map();
const lastPinged = new Map();

function stampedRecently(map, roll, windowMs) {
    const at = map.get(roll);
    if (at && Date.now() - at < windowMs) return true;
    map.set(roll, Date.now());
    // The map is keyed by roll number and a lambda is short-lived, but a long
    // running instance should not grow forever.
    if (map.size > 5000) map.clear();
    return false;
}

const cleanMeta = ({ studentName = null, appVersion = null, platform = null } = {}) => ({
    studentName: trim(studentName, 120),
    appVersion: trim(appVersion, 32),
    platform: trim(platform, 32),
});

const warn = (what) => (err) => console.warn(`[ACTIVITY] ${what} failed (non-critical):`, err.message);

/**
 * Mark a student as active now. Called from the shared session opener, so it
 * fires on every attendance/calendar/timetable/session request, and from the
 * launch-time session check.
 * Resolves once written, never rejects. Data endpoints do not await it — it
 * must not add latency to a sync — but a handler that answers straight away
 * must, or the lambda freezes before the write leaves.
 */
function touchActive(rollNumber, { ip = null, isMock = false, ...rest } = {}) {
    const roll = safeRoll(rollNumber);
    if (!roll || isMock || stampedRecently(lastStamped, roll, HEARTBEAT_THROTTLE_MS)) return Promise.resolve();

    // try/catch, not just .catch(): building the ref and the field values can
    // throw synchronously (a misconfigured Admin SDK does exactly that), and a
    // heartbeat is never allowed to take a student's sync down with it.
    try {
        const meta = cleanMeta(rest);
        const ipHash = hashIp(ip);
        return Promise.all([
            studentRef(roll).set({
                rollNumber: roll,
                lastSeenAt: FieldValue.serverTimestamp(),
                syncCount: FieldValue.increment(1),
                ...(meta.studentName ? { studentName: meta.studentName } : {}),
                ...(meta.appVersion ? { appVersion: meta.appVersion } : {}),
                ...(meta.platform ? { platform: meta.platform } : {}),
                ...(ipHash ? { lastIpHash: ipHash } : {}),
            }, { merge: true }),
            writeDay(roll, meta),
        ]).then(() => {}, warn('heartbeat'));
    } catch (err) {
        warn('heartbeat')(err);
        return Promise.resolve();
    }
}

/**
 * The app's usage ping: it is open (a beat), plus the screens opened since the
 * last ping. Resolves true when recorded; false tells the app to keep the
 * screen counts and send them next time. Never rejects.
 */
async function recordPing(rollNumber, { isMock = false, ...rest } = {}, screens = null) {
    const roll = safeRoll(rollNumber);
    if (!roll || isMock || stampedRecently(lastPinged, roll, PING_FLOOR_MS)) return false;
    try {
        await writeDay(roll, cleanMeta(rest), pickScreens(screens));
        return true;
    } catch (err) {
        warn('usage ping')(err);
        return false;
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

module.exports = {
    recordLogin, touchActive, recordPing, clientMeta, safeRoll, hashIp,
    dayKey, dayStartMs, sessionsFromBeats, pickScreens, SCREENS, TZ,
};
