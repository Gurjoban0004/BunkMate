/**
 * Vercel Serverless Function: Admin Analytics
 *
 * POST /api/admin-analytics
 * Body: { token, metric, forceRefresh? }
 *
 * Every number here is computed from Firestore on request (cached briefly) and
 * every read is bounded. A failing metric returns 500 with the reason — it
 * never invents figures.
 *
 * "Student" means a user document with a real roll number, i.e. someone who
 * connected their college account — which, since the account id IS the roll
 * number, is now every document api/auth-token can create. Leftovers from the
 * old PRES-XXXXXXX login codes, test accounts and mock logins have no roll
 * number and are reported separately as `unfinishedSignups`, never mixed in.
 *
 * Two independent sources feed this file:
 *   1. What the APP writes (users/, semesters/, telemetry syncs). Rich, but it
 *      only lands if the phone completed a Firebase sign-in and passed rules.
 *   2. The server-side ledger written by api/_activity.js from inside the
 *      login and data endpoints. Always lands. This is `live` / `loginEvents`
 *      and the first block of `overview`.
 *
 * Metrics:
 *   live              — who has the app open right now (cheap: reads only them)
 *   daily             — { day? } one college day: who opened the app, when, for
 *                       how long, and which screens they used
 *   usage             — the last 14 days: students per day and screen views
 *   student           — { roll } everything known about one student
 *   loginEvents       — every sign-in attempt against the college, success or not
 *   overview          — attendance and sync health across students
 *   userRoster        — every student the server has seen, merged with what
 *                       their phone wrote; unfinished = legacy login-code docs
 *   sessionEvents     — who was asked to sign in again in the last 7 days, and why
 *   subjectDifficulty — aggregate attendance per subject across students
 *   bunkCulture       — day-of-week miss rates from the register
 *   batchDistribution — cohort breakdown
 *   endpointHealth    — 24h endpoint success/fail rates
 *   parserFailures    — recent parser errors
 *   downtime          — live college outages inferred from sync telemetry
 */

const { setCorsHeaders, decodeSessionRollNumber, getClientIp } = require('./_session-utils');
const { tooManyAttempts } = require('./_rate-limit');
const { adminDb, isAdminRoll } = require('./_firebase-admin');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const { dayKey, dayStartMs, sessionsFromBeats, safeRoll } = require('./_activity');

const IP_POLICY = { max: 120, windowMs: 10 * 60 * 1000 };

// Ceilings, not targets (audit H3).
const MAX_USERS     = 5000;
const MAX_SEMESTERS = 10000;
const MAX_SYNCS     = 20000;
const MAX_ACTIVITY  = 5000;
const MAX_LOGINS    = 500;

// Live panels refresh often; the heavy aggregates less so.
const TTL_MS = {
    live: 20 * 1000,
    daily: 60 * 1000,
    usage: 5 * 60 * 1000,
    student: 60 * 1000,
    loginEvents: 60 * 1000,
    overview: 60 * 1000,
    userRoster: 2 * 60 * 1000,
    sessionEvents: 2 * 60 * 1000,
    endpointHealth: 5 * 60 * 1000,
    downtime: 2 * 60 * 1000,
    parserFailures: 5 * 60 * 1000,
    subjectDifficulty: 30 * 60 * 1000,
    bunkCulture: 30 * 60 * 1000,
    batchDistribution: 30 * 60 * 1000,
};

const DAY = 86400000;
const HOUR = 3600000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const USAGE_DAYS = 14;
const STUDENT_DAYS = 30;
const REAL_ROLL = /^\d{6,}$/;
const isRealRoll = (roll) => !!roll && REAL_ROLL.test(String(roll).trim());

const millis = (v) => (v && typeof v.toMillis === 'function') ? v.toMillis()
    : (typeof v === 'string' || typeof v === 'number') ? new Date(v).getTime() : 0;
const finiteMillis = (v) => { const m = millis(v); return Number.isFinite(m) && m > 0 ? m : null; };
const sum = (values) => values.reduce((a, b) => a + (Number(b) || 0), 0);
const countOf = async (query) => (await query.count().get()).data().count;

/** 'Batch 2024' from a roll number that starts with the admission year. */
function batchOf(roll) {
    const prefix = String(roll).substring(0, 2);
    return `Batch ${parseInt(prefix, 10) >= 50 ? '19' : '20'}${prefix}`;
}

// ── Cache: one doc per metric ────────────────────────────────────────
// Parameterised metrics (a day, a student) cache under `${metric}-${param}`.
const cacheRef = (key) => adminDb.doc(`admin/analyticsCache/metrics/${key}`);

async function getCached(key, metric) {
    try {
        const snap = await cacheRef(key).get();
        if (!snap.exists) return null;
        const entry = snap.data();
        if (!entry || !entry.cachedAt) return null;
        const age = Date.now() - millis(entry.cachedAt);
        if (age > (TTL_MS[metric] || 5 * 60 * 1000)) return null;
        return { data: entry.data, cachedAt: millis(entry.cachedAt) };
    } catch {
        return null;
    }
}

async function setCache(key, data) {
    try {
        await cacheRef(key).set({ data, cachedAt: FieldValue.serverTimestamp() });
    } catch (e) {
        console.warn(`Cache write failed for ${key}:`, e.message);
    }
}

// ── Bounded reads ────────────────────────────────────────────────────
const allUsers     = () => adminDb.collection('users').limit(MAX_USERS).get();
const allSemesters = () => adminDb.collectionGroup('semesters').limit(MAX_SEMESTERS).get();

async function recentSyncs(sinceMs) {
    const since = Timestamp.fromMillis(sinceMs);
    try {
        return await adminDb.collectionGroup('syncs').where('timestamp', '>=', since).limit(MAX_SYNCS).get();
    } catch (err) {
        console.warn('[ANALYTICS] syncs timestamp index missing — bounded fallback scan:', err.message);
        return await adminDb.collectionGroup('syncs').limit(MAX_SYNCS).get();
    }
}

const syncMillis = (data) => millis(data && data.timestamp);
const ownerOf = (docSnap) => docSnap.ref.path.split('/')[1] || null;

/**
 * Users split into real students and legacy docs, plus each student's
 * current-semester summary. One users read + one semesters read, joined here.
 *
 * The document id is the roll number: api/auth-token only ever creates a user
 * doc from a sealed ERP session, so every id is one the college vouched for.
 * erpRollNumber is still honoured because it is what the older PRES-XXXXXXX
 * documents carry — anything with neither is a leftover from the login-code
 * era and lands in `unfinished`, which is what the purge action clears.
 */
async function loadPeople() {
    const [usersSnap, semestersSnap] = await Promise.all([allUsers(), allSemesters()]);

    const students = new Map();   // userId → { doc data }
    const unfinished = [];
    usersSnap.forEach((d) => {
        const data = d.data() || {};
        const roll = isRealRoll(d.id) ? d.id : (isRealRoll(data.erpRollNumber) ? String(data.erpRollNumber).trim() : null);
        if (roll) students.set(d.id, { id: d.id, erpRollNumber: roll, ...data });
        else unfinished.push({ id: d.id, lastActive: finiteMillis(data.lastActive) || finiteMillis(data.createdAt) });
    });

    // Newest semester doc per student (by _lastModified), plus a count.
    const semesters = new Map(); // userId → { count, latest }
    semestersSnap.forEach((semDoc) => {
        const userId = semDoc.ref.parent.parent?.id;
        if (!userId || !students.has(userId)) return;
        const data = semDoc.data() || {};
        if (data._deleted) return;
        const entry = semesters.get(userId) || { count: 0, latest: null, latestAt: 0 };
        entry.count++;
        const at = finiteMillis(data._lastModified) || 0;
        if (!entry.latest || at >= entry.latestAt) { entry.latest = data; entry.latestAt = at; }
        semesters.set(userId, entry);
    });

    return { students, unfinished, semesters };
}

/** Per-student attendance summary from their latest semester document. */
function summarise(semester) {
    const subjects = Array.isArray(semester?.subjects) ? semester.subjects : [];
    const goal = Number(semester?.settings?.dangerThreshold) || 75;
    let attended = 0, total = 0, below = 0;
    const rows = [];
    for (const s of subjects) {
        const t = Number(s.initialTotal) || 0;
        const a = Math.min(Number(s.initialAttended) || 0, t);
        if (t <= 0) continue;
        const target = Number(s.target) || goal;
        attended += a;
        total += t;
        if (100 * a < target * t) below++;
        rows.push({ name: s.name || s.id || 'Unknown', code: s.code || '', attended: a, total: t, target, pct: (a * 100) / t });
    }
    return {
        subjects: rows,
        totalAttended: attended,
        totalClasses: total,
        belowGoal: below,
        overallAttendancePct: total > 0 ? Math.round((attended * 1000) / total) / 10 : null,
        goal,
        setupComplete: !!semester?.setupComplete,
        erpConnected: !!semester?.settings?.erpConnected,
        userName: semester?.userName || '',
        latestErpDate: semester?.latestErpDate || semester?.settings?.latestErpDate || null,
        lastErpSync: semester?.settings?.lastErpSync || null,
    };
}


// ── The server-side activity ledger ──────────────────────────────────
// Written by api/_activity.js from inside the login and data endpoints, with
// the Admin SDK. Unlike everything above it, it does not depend on the
// student's phone completing a Firebase sign-in and passing security rules —
// which is why it is the section that is actually populated.

const ONLINE_WINDOW_MS = 5 * 60 * 1000;      // the app syncs every 3 minutes

const activityCol = () => adminDb.collection('admin/activity/students');
const loginsCol   = () => adminDb.collection('admin/activity/logins');
const dayStudents = (day) => adminDb.collection(`admin/activity/days/${day}/students`);

function ledgerRow(d) {
    const v = d.data() || {};
    return {
        rollNumber: v.rollNumber || d.id,
        studentName: v.studentName || null,
        firstSeen: finiteMillis(v.createdAt),
        lastLoginAt: finiteMillis(v.lastLoginAt),
        lastSuccessAt: finiteMillis(v.lastSuccessAt),
        lastSeenAt: finiteMillis(v.lastSeenAt),
        lastLoginOutcome: v.lastLoginOutcome || null,
        loginCount: Number(v.loginCount) || 0,
        loginAttempts: Number(v.loginAttempts) || 0,
        syncCount: Number(v.syncCount) || 0,
        devices: Array.isArray(v.deviceIds) ? v.deviceIds.length : 0,
        appVersion: v.appVersion || null,
        platform: v.platform || null,
        isMock: !!v.isMock,
    };
}

/** Every roster row the ledger holds. One bounded read. */
async function loadLedger() {
    const snap = await activityCol().limit(MAX_ACTIVITY).get();
    const rows = [];
    snap.forEach((d) => rows.push(ledgerRow(d)));
    return rows.filter((r) => !r.isMock);
}

/**
 * Who has the app open right now. A range query, so it reads only the students
 * seen in the last five minutes — the panel polls this, and reading the whole
 * roster every tick is what would eat the daily read quota.
 */
async function computeLive() {
    const now = Date.now();
    const snap = await activityCol()
        .where('lastSeenAt', '>=', Timestamp.fromMillis(now - ONLINE_WINDOW_MS))
        .limit(MAX_ACTIVITY).get();
    const online = [];
    snap.forEach((d) => {
        const r = ledgerRow(d);
        if (r.isMock || !r.lastSeenAt || now - r.lastSeenAt > ONLINE_WINDOW_MS) return;
        online.push({ rollNumber: r.rollNumber, studentName: r.studentName, lastSeenAt: r.lastSeenAt, appVersion: r.appVersion, platform: r.platform });
    });
    online.sort((a, b) => b.lastSeenAt - a.lastSeenAt);
    return { onlineNow: online.length, online, generatedAt: now };
}

/**
 * One college day, per student: when they first opened the app, each session
 * (derived from per-minute beats, see api/_activity.js), total minutes, and the
 * screens they opened. Plus the day's totals and an hour-by-hour histogram of
 * distinct students.
 */
async function computeDaily({ day } = {}) {
    const key = DAY_RE.test(day || '') ? day : dayKey();
    const start = dayStartMs(key);
    const snap = await dayStudents(key).limit(MAX_ACTIVITY).get();

    const hours = Array(24).fill(0);
    const screens = {};
    const people = [];
    snap.forEach((d) => {
        const v = d.data() || {};
        const beats = Array.isArray(v.beats) ? v.beats : [];
        const sessions = sessionsFromBeats(beats);
        if (!sessions.length) return;
        new Set(beats.map((m) => Math.floor((m * 60000 - start) / HOUR)).filter((h) => h >= 0 && h < 24))
            .forEach((h) => { hours[h]++; });
        const mine = v.screens && typeof v.screens === 'object' ? v.screens : {};
        Object.entries(mine).forEach(([k, n]) => { screens[k] = (screens[k] || 0) + (Number(n) || 0); });
        people.push({
            rollNumber: v.rollNumber || d.id,
            studentName: v.studentName || null,
            platform: v.platform || null,
            appVersion: v.appVersion || null,
            firstOpenAt: sessions[0].start,
            lastSeenAt: sessions[sessions.length - 1].end,
            sessions,
            minutes: sum(sessions.map((x) => x.minutes)),
            screens: mine,
        });
    });
    people.sort((a, b) => b.lastSeenAt - a.lastSeenAt);

    const minutes = sum(people.map((p) => p.minutes));
    const sessionCount = sum(people.map((p) => p.sessions.length));
    return {
        day: key,
        dayStart: start,
        isToday: key === dayKey(),
        users: people.length,
        sessions: sessionCount,
        minutes,
        avgMinutes: people.length ? Math.round(minutes / people.length) : 0,
        hours,
        screens,
        people,
    };
}

/**
 * The last USAGE_DAYS college days: distinct students per day (a count query —
 * one read, not one per student) and screen views from the day's aggregate doc.
 */
async function computeUsage() {
    const now = Date.now();
    const days = Array.from({ length: USAGE_DAYS }, (_, i) => dayKey(now - (USAGE_DAYS - 1 - i) * DAY));
    const rows = await Promise.all(days.map(async (day) => {
        const [users, doc] = await Promise.all([
            countOf(dayStudents(day)),
            adminDb.doc(`admin/activity/days/${day}`).get(),
        ]);
        const screens = (doc.exists && doc.data()?.screens) || {};
        return { day, users, views: sum(Object.values(screens)), screens };
    }));
    const screens = {};
    rows.forEach((r) => Object.entries(r.screens).forEach(([k, n]) => { screens[k] = (screens[k] || 0) + (Number(n) || 0); }));
    return { days: rows, screens };
}

/**
 * The sign-in log: every attempt against the college, successful or not.
 * This is the answer to "who logged in, and when".
 */
async function computeLoginEvents() {
    let snap;
    try {
        snap = await loginsCol().orderBy('at', 'desc').limit(MAX_LOGINS).get();
    } catch (err) {
        // The composite index may not exist yet on a fresh project.
        console.warn('[ANALYTICS] logins orderBy failed, unordered scan:', err.message);
        snap = await loginsCol().limit(MAX_LOGINS).get();
    }

    const events = [];
    snap.forEach((d) => {
        const v = d.data() || {};
        if (v.isMock) return;
        events.push({
            id: d.id,
            rollNumber: v.rollNumber || null,
            studentName: v.studentName || null,
            outcome: v.outcome || 'unknown',
            method: v.method || 'password',
            at: finiteMillis(v.at),
            deviceId: v.deviceId ? String(v.deviceId).slice(0, 8) : null,
            ipHash: v.ipHash || null,
            appVersion: v.appVersion || null,
            platform: v.platform || null,
        });
    });
    events.sort((a, b) => (b.at || 0) - (a.at || 0));

    const now = Date.now();
    const startOfToday = dayStartMs(dayKey(now));
    const succeeded = (e) => e.outcome === 'trusted' || e.outcome === 'otp-verified';

    const byOutcome = {};
    events.forEach((e) => { byOutcome[e.outcome] = (byOutcome[e.outcome] || 0) + 1; });

    const todays = events.filter((e) => e.at && e.at >= startOfToday);
    return {
        events: events.slice(0, 200),
        total: events.length,
        byOutcome,
        loginsToday: todays.filter(succeeded).length,
        studentsToday: new Set(todays.filter(succeeded).map((e) => e.rollNumber)).size,
        logins24h: events.filter((e) => e.at && now - e.at <= DAY && succeeded(e)).length,
        failed24h: events.filter((e) => e.at && now - e.at <= DAY && e.outcome === 'rejected').length,
    };
}

// ── Metrics ──────────────────────────────────────────────────────────

/** Attendance and sync health across students — what their phones wrote. */
async function computeOverview() {
    const now = Date.now();
    const { students, unfinished, semesters } = await loadPeople();

    let withNumbers = 0, pctSum = 0, belowGoalStudents = 0, connected = 0;
    students.forEach((u, id) => {
        const sem = semesters.get(id);
        if (!sem) return;
        const s = summarise(sem.latest);
        if (s.erpConnected) connected++;
        if (s.overallAttendancePct != null) {
            withNumbers++;
            pctSum += s.overallAttendancePct;
            if (s.belowGoal > 0) belowGoalStudents++;
        }
    });

    const syncsSnap = await recentSyncs(now - 7 * DAY);
    let syncs24h = 0, ok24h = 0, attempts24h = 0, otp7d = 0, login7d = 0;
    syncsSnap.forEach((d) => {
        const data = d.data();
        const ts = syncMillis(data);
        if (ts < now - 7 * DAY) return;
        const userId = ownerOf(d);
        if (!userId || !students.has(userId)) return;
        if (now - ts <= DAY) {
            syncs24h++;
            (data.endpoints || []).forEach((ep) => { if (!ep) return; attempts24h++; if (ep.status === 'ok') ok24h++; });
        }
        if (data.sessionEvent?.type === 'needsOtp') otp7d++;
        if (data.sessionEvent?.type === 'needsLogin') login7d++;
    });

    const sevenDaysAgo = now - 7 * DAY;
    return {
        students: students.size,
        connected,
        unfinishedSignups: unfinished.length,
        unfinishedOlderThan7d: unfinished.filter((u) => !u.lastActive || u.lastActive < sevenDaysAgo).length,
        syncs24h,
        successRate24h: attempts24h > 0 ? (ok24h * 100) / attempts24h : null,
        signInPrompts7d: otp7d,
        signInLost7d: login7d,
        avgAttendancePct: withNumbers > 0 ? Math.round((pctSum / withNumbers) * 10) / 10 : null,
        belowGoalStudents,
        studentsWithNumbers: withNumbers,
    };
}

/**
 * Every student the server has seen (the ledger: anyone who signed in or
 * synced) merged with what their phone wrote (users/ + semesters). A student
 * whose phone never completed a Firebase sign-in used to be invisible here;
 * now they are listed with `inCloud: false` and no attendance figures.
 */
async function computeUserRoster() {
    const [{ students, unfinished, semesters }, ledger] = await Promise.all([loadPeople(), loadLedger()]);
    const now = Date.now();
    const byRoll = new Map();

    ledger.forEach((r) => {
        if (!isRealRoll(r.rollNumber)) return;
        byRoll.set(r.rollNumber, {
            userId: r.rollNumber, rollNumber: r.rollNumber, studentName: r.studentName,
            lastActive: r.lastSeenAt || r.lastLoginAt, firstSeen: r.firstSeen, lastLoginAt: r.lastLoginAt,
            loginCount: r.loginCount, syncCount: r.syncCount, devices: r.devices,
            version: r.appVersion, platform: r.platform, inCloud: false,
        });
    });

    students.forEach((u, id) => {
        const s = summarise(semesters.get(id)?.latest);
        const prev = byRoll.get(u.erpRollNumber) || { rollNumber: u.erpRollNumber };
        byRoll.set(u.erpRollNumber, {
            ...prev,
            userId: id,
            studentName: prev.studentName || u.studentName || s.userName || null,
            lastActive: Math.max(prev.lastActive || 0, finiteMillis(u.lastActive) || 0) || null,
            version: prev.version || u.version || null,
            inCloud: true,
            setupComplete: !!u.setupComplete || s.setupComplete,
            erpConnected: s.erpConnected,
            semesterCount: semesters.get(id)?.count || 0,
            totalSubjects: s.subjects.length,
            totalClasses: s.totalClasses,
            totalAttended: s.totalAttended,
            belowGoal: s.belowGoal,
            goal: s.goal,
            overallAttendancePct: s.overallAttendancePct,
            latestErpDate: s.latestErpDate,
            lastErpSync: s.lastErpSync,
            subjects: s.subjects,
        });
    });

    const byVersion = {};
    const byPlatform = {};
    const users = [...byRoll.values()].map((u) => {
        if (u.version) byVersion[u.version] = (byVersion[u.version] || 0) + 1;
        if (u.platform) byPlatform[u.platform] = (byPlatform[u.platform] || 0) + 1;
        return { totalSubjects: 0, belowGoal: 0, subjects: [], overallAttendancePct: null, ...u, batchGroup: batchOf(u.rollNumber) };
    });
    users.sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));
    return {
        users,
        byVersion,
        byPlatform,
        unfinished: {
            count: unfinished.length,
            olderThan7d: unfinished.filter((u) => !u.lastActive || u.lastActive < now - 7 * DAY).length,
        },
    };
}

/**
 * Everything about one student: the ledger row, the phone's cloud copy and
 * attendance, 30 days of usage sessions, their sign-in attempts and their last
 * 50 syncs with per-endpoint results.
 */
async function computeStudent({ roll } = {}) {
    const now = Date.now();
    const days = Array.from({ length: STUDENT_DAYS }, (_, i) => dayKey(now - i * DAY));
    const [rosterSnap, userSnap, semSnap, daySnaps, loginSnap, syncSnap, revokedSnap] = await Promise.all([
        adminDb.doc(`admin/activity/students/${roll}`).get(),
        adminDb.doc(`users/${roll}`).get(),
        adminDb.collection(`users/${roll}/semesters`).limit(20).get(),
        adminDb.getAll(...days.map((day) => adminDb.doc(`admin/activity/days/${day}/students/${roll}`))),
        // No orderBy with the where: that needs a composite index. Sorted below.
        loginsCol().where('rollNumber', '==', roll).limit(100).get(),
        adminDb.collection(`telemetry/${roll}/syncs`).orderBy('timestamp', 'desc').limit(50).get(),
        adminDb.doc(`admin/revokedUsers/items/${roll}`).get(),
    ]);

    const ledger = rosterSnap.exists ? ledgerRow(rosterSnap) : null;
    const user = userSnap.exists ? (userSnap.data() || {}) : null;

    let latest = null, latestAt = -1, semesterCount = 0;
    semSnap.forEach((d) => {
        const v = d.data() || {};
        if (v._deleted) return;
        semesterCount++;
        const at = finiteMillis(v._lastModified) || 0;
        if (at >= latestAt) { latest = v; latestAt = at; }
    });
    const attendance = summarise(latest);

    const usage = [];
    daySnaps.forEach((d) => {
        if (!d.exists) return;
        const v = d.data() || {};
        const sessions = sessionsFromBeats(v.beats);
        if (!sessions.length) return;
        usage.push({
            day: d.ref.parent.parent.id,
            sessions,
            minutes: sum(sessions.map((x) => x.minutes)),
            screens: v.screens || {},
            platform: v.platform || null,
            appVersion: v.appVersion || null,
        });
    });

    const logins = [];
    loginSnap.forEach((d) => {
        const v = d.data() || {};
        logins.push({ id: d.id, outcome: v.outcome || 'unknown', method: v.method || 'password', at: finiteMillis(v.at),
            platform: v.platform || null, appVersion: v.appVersion || null, deviceId: v.deviceId ? String(v.deviceId).slice(0, 8) : null, ipHash: v.ipHash || null });
    });
    logins.sort((a, b) => (b.at || 0) - (a.at || 0));

    const syncs = [];
    syncSnap.forEach((d) => {
        const v = d.data() || {};
        syncs.push({ at: syncMillis(v) || null, endpoints: v.endpoints || [], parserErrors: v.parserErrors || [], sessionEvent: v.sessionEvent || null });
    });

    const revoked = revokedSnap.exists ? revokedSnap.data() || {} : null;
    return {
        rollNumber: roll,
        studentName: ledger?.studentName || user?.studentName || attendance.userName || null,
        batchGroup: batchOf(roll),
        ledger,
        cloud: user ? {
            lastActive: finiteMillis(user.lastActive),
            setupComplete: !!user.setupComplete,
            semesterCount,
        } : null,
        attendance,
        revoked: revoked ? { reason: revoked.reason || '', revokedAt: finiteMillis(revoked.revokedAt), revokedBy: revoked.revokedBy || null } : null,
        usage,
        usageMinutes30d: sum(usage.map((u) => u.minutes)),
        logins,
        syncs,
    };
}

async function computeSessionEvents() {
    const cutoff = Date.now() - 7 * DAY;
    const [{ students }, syncsSnap] = await Promise.all([loadPeople(), recentSyncs(cutoff)]);
    const byReason = {};
    const byType = { needsOtp: 0, needsLogin: 0 };
    const recent = [];
    const affected = new Set();
    syncsSnap.forEach((d) => {
        const data = d.data();
        const ev = data?.sessionEvent;
        if (!ev || !ev.type) return;
        const ts = syncMillis(data);
        if (ts < cutoff) return;
        const userId = ownerOf(d);
        byType[ev.type] = (byType[ev.type] || 0) + 1;
        byReason[ev.reason || 'unknown'] = (byReason[ev.reason || 'unknown'] || 0) + 1;
        affected.add(userId);
        recent.push({
            userId,
            rollNumber: data.rollNumber || students.get(userId)?.erpRollNumber || null,
            studentName: students.get(userId)?.studentName || null,
            type: ev.type,
            reason: ev.reason || 'unknown',
            at: ts,
        });
    });
    recent.sort((a, b) => b.at - a.at);
    return { total: recent.length, affectedStudents: affected.size, byType, byReason, recent: recent.slice(0, 40) };
}

async function computeSubjectDifficulty() {
    const { students, semesters } = await loadPeople();
    const subjectMap = {};
    semesters.forEach((sem, userId) => {
        if (!students.has(userId)) return;
        const subjects = sem.latest?.subjects;
        if (!Array.isArray(subjects)) return;
        subjects.forEach((sub) => {
            const key = String(sub.name || sub.id || '').trim().replace(/\s+/g, ' ');
            if (!key) return;
            const t = Number(sub.initialTotal) || 0;
            if (t <= 0) return;
            const a = Math.min(Number(sub.initialAttended) || 0, t);
            const norm = key.toLowerCase();
            if (!subjectMap[norm]) subjectMap[norm] = { name: key, code: sub.code || '', totalPresent: 0, totalAbsent: 0, students: 0 };
            subjectMap[norm].totalPresent += a;
            subjectMap[norm].totalAbsent += t - a;
            subjectMap[norm].students++;
        });
    });
    return Object.values(subjectMap)
        .filter((s) => s.students >= 2)
        .map((s) => {
            const total = s.totalPresent + s.totalAbsent;
            return { ...s, bunkRate: total > 0 ? (s.totalAbsent / total) * 100 : 0, attendanceRate: total > 0 ? (s.totalPresent / total) * 100 : 0 };
        })
        .sort((a, b) => b.bunkRate - a.bunkRate);
}

async function computeBunkCulture() {
    const { students, semesters } = await loadPeople();
    const DAY_MAP = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday' };
    const dayStats = Object.fromEntries(Object.values(DAY_MAP).map((d) => [d, { present: 0, absent: 0 }]));

    semesters.forEach((sem, userId) => {
        if (!students.has(userId)) return;
        const records = sem.latest?.attendanceRecords || {};
        Object.entries(records).forEach(([dateStr, dayData]) => {
            if (!dayData || dayData._holiday) return;
            const [y, m, d] = dateStr.split('-').map(Number);
            if (!y || !m || !d) return;
            const dayName = DAY_MAP[new Date(y, m - 1, d, 12).getDay()];
            if (!dayName) return;
            Object.entries(dayData).forEach(([key, rec]) => {
                if (key.startsWith('_') || !rec || typeof rec !== 'object' || rec.source !== 'erp') return;
                if (!rec.status || rec.status === 'cancelled') return;
                const units = Number(rec.units) > 0 ? Number(rec.units) : 1;
                const attended = Number.isFinite(Number(rec.attendedUnits))
                    ? Math.min(Math.max(Number(rec.attendedUnits), 0), units)
                    : (rec.status === 'present' ? units : 0);
                dayStats[dayName].present += attended;
                dayStats[dayName].absent += units - attended;
            });
        });
    });

    return Object.entries(dayStats).map(([day, s]) => {
        const total = s.present + s.absent;
        return { day, bunkRate: total > 0 ? (s.absent / total) * 100 : 0, total };
    });
}

async function computeBatchDistribution() {
    const { users } = await computeUserRoster();
    const batches = {};
    users.forEach((u) => { batches[u.batchGroup] = (batches[u.batchGroup] || 0) + 1; });
    const total = users.length;
    return Object.entries(batches)
        .map(([batch, count]) => ({ batch, count, percentage: total > 0 ? (count / total) * 100 : 0 }))
        .sort((a, b) => b.count - a.count);
}

async function computeEndpointHealth() {
    const cutoff = Date.now() - DAY;
    const syncsSnap = await recentSyncs(cutoff);
    const stats = {};
    syncsSnap.forEach((d) => {
        const data = d.data();
        if (!data || syncMillis(data) < cutoff) return;
        (data.endpoints || []).forEach((ep) => {
            if (!ep || !ep.name) return;
            if (!stats[ep.name]) stats[ep.name] = { name: ep.name, success: 0, fail: 0, totalMs: 0, count: 0 };
            const s = stats[ep.name];
            if (ep.status === 'ok') s.success++; else s.fail++;
            s.totalMs += ep.durationMs || 0;
            s.count++;
        });
    });
    return Object.values(stats)
        .map((s) => ({ ...s, successRate: s.count > 0 ? (s.success / s.count) * 100 : 0, avgDuration: s.count > 0 ? Math.round(s.totalMs / s.count) : 0 }))
        .sort((a, b) => a.successRate - b.successRate);
}

async function computeDowntime() {
    const WINDOW_MS = 60 * 60 * 1000;
    const MIN_ATTEMPTS = 3;
    const FAIL_RATE = 0.5;
    const cutoff = Date.now() - WINDOW_MS;
    const syncsSnap = await recentSyncs(cutoff);
    const stats = {};
    syncsSnap.forEach((d) => {
        const data = d.data();
        const ts = syncMillis(data);
        if (!data || ts < cutoff) return;
        const userId = ownerOf(d) || 'unknown';
        (data.endpoints || []).forEach((ep) => {
            if (!ep || !ep.name) return;
            if (!stats[ep.name]) stats[ep.name] = { name: ep.name, attempts: 0, failures: 0, users: new Set(), firstFailAt: null, lastFailAt: null, sampleError: null };
            const s = stats[ep.name];
            s.attempts++;
            if (ep.status !== 'ok') {
                s.failures++;
                s.users.add(userId);
                if (!s.firstFailAt || ts < s.firstFailAt) s.firstFailAt = ts;
                if (!s.lastFailAt || ts > s.lastFailAt) s.lastFailAt = ts;
                if (!s.sampleError && ep.error) s.sampleError = String(ep.error).slice(0, 200);
            }
        });
    });
    return Object.values(stats)
        .filter((s) => s.attempts >= MIN_ATTEMPTS && s.failures / s.attempts >= FAIL_RATE)
        .map((s) => ({
            id: s.name, type: `${s.name} endpoint failing`, failures: s.failures, attempts: s.attempts,
            failRate: (s.failures / s.attempts) * 100, affectedUsers: s.users.size,
            startedAt: s.firstFailAt, lastSeenAt: s.lastFailAt, sampleError: s.sampleError,
        }))
        .sort((a, b) => b.failRate - a.failRate);
}

async function computeParserFailures() {
    let syncsSnap;
    try {
        syncsSnap = await adminDb.collectionGroup('syncs').orderBy('timestamp', 'desc').limit(200).get();
    } catch {
        syncsSnap = await recentSyncs(Date.now() - 7 * DAY);
    }
    const failures = [];
    syncsSnap.forEach((d) => {
        const data = d.data();
        if (!data || !data.parserErrors || data.parserErrors.length === 0) return;
        failures.push({ userId: ownerOf(d) || 'unknown', timestampMs: syncMillis(data) || null, errors: data.parserErrors, rollNumber: data.rollNumber || 'Unknown' });
    });
    return failures.sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0)).slice(0, 20);
}

// ── Handler ──────────────────────────────────────────────────────────

const METRIC_HANDLERS = {
    live: computeLive,
    daily: computeDaily,
    usage: computeUsage,
    student: computeStudent,
    loginEvents: computeLoginEvents,
    overview: computeOverview,
    userRoster: computeUserRoster,
    sessionEvents: computeSessionEvents,
    subjectDifficulty: computeSubjectDifficulty,
    bunkCulture: computeBunkCulture,
    batchDistribution: computeBatchDistribution,
    endpointHealth: computeEndpointHealth,
    parserFailures: computeParserFailures,
    downtime: computeDowntime,
};

/**
 * Validated parameters for a metric, or { error }. Only `daily` and `student`
 * take any; the value also names the cache doc, so it must be a safe id.
 */
function metricParams(metric, body) {
    if (metric === 'daily') {
        if (body.day != null && !DAY_RE.test(String(body.day))) return { error: 'day must look like 2026-09-14' };
        return { params: { day: body.day || dayKey() }, key: `daily-${body.day || dayKey()}` };
    }
    if (metric === 'student') {
        const roll = safeRoll(body.roll);
        if (!roll) return { error: 'roll is required' };
        return { params: { roll }, key: `student-${roll}` };
    }
    return { params: {}, key: metric };
}

module.exports = async function handler(req, res) {
    setCorsHeaders(res, req);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const body = req.body || {};
    const { token, metric, forceRefresh } = body;

    const rollNumber = decodeSessionRollNumber(token);
    if (!rollNumber || !isAdminRoll(rollNumber)) return res.status(403).json({ error: 'Unauthorized' });

    if (await tooManyAttempts(res, 'admin-analytics-ip', getClientIp(req), IP_POLICY)) return;

    if (!metric || !Object.prototype.hasOwnProperty.call(METRIC_HANDLERS, metric)) {
        return res.status(400).json({ error: `Unknown metric: ${metric}. Valid: ${Object.keys(METRIC_HANDLERS).join(', ')}` });
    }
    const { params, key, error } = metricParams(metric, body);
    if (error) return res.status(400).json({ error });

    try {
        if (!forceRefresh) {
            const cached = await getCached(key, metric);
            if (cached) return res.json({ data: cached.data, cached: true, cachedAt: cached.cachedAt });
        }
        const data = await METRIC_HANDLERS[metric](params);
        await setCache(key, data);
        return res.json({ data, cached: false, cachedAt: Date.now() });
    } catch (err) {
        console.error(`Analytics computation failed for ${metric}:`, err);
        // The reason is deliberately surfaced: only an admin ever sees it.
        return res.status(500).json({ error: `Failed to compute ${metric}: ${err.message}` });
    }
};

// The local dashboard (scripts/admin-dashboard.js) runs the very same metrics.
module.exports.METRICS = METRIC_HANDLERS;
module.exports.metricParams = metricParams;
module.exports.isRealRoll = isRealRoll;
