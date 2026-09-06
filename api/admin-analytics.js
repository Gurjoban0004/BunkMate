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
 * connected their college account. Abandoned sign-ups (a login code that
 * never got past onboarding), test accounts and mock logins do not have one
 * and are reported separately as `unfinishedSignups`, never mixed in.
 *
 * Metrics:
 *   overview          — the hero: students, activity, sync health, sign-in events, attendance
 *   userRoster        — { users: [real students], unfinished: { count, olderThan7d } }
 *   sessionEvents     — who was asked to sign in again in the last 7 days, and why
 *   subjectDifficulty — aggregate attendance per subject across students
 *   bunkCulture       — day-of-week miss rates from the register
 *   batchDistribution — cohort breakdown
 *   endpointHealth    — 24h endpoint success/fail rates
 *   parserFailures    — recent parser errors
 *   rateLimit         — per-student sync frequency
 *   downtime          — live college outages inferred from sync telemetry
 */

const { setCorsHeaders, decodeSessionRollNumber, getClientIp } = require('./_session-utils');
const { tooManyAttempts } = require('./_rate-limit');
const { adminDb, isAdminRoll } = require('./_firebase-admin');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');

const IP_POLICY = { max: 120, windowMs: 10 * 60 * 1000 };

// Ceilings, not targets (audit H3).
const MAX_USERS     = 5000;
const MAX_SEMESTERS = 10000;
const MAX_SYNCS     = 20000;

// Live panels refresh often; the heavy aggregates less so.
const TTL_MS = {
    overview: 2 * 60 * 1000,
    userRoster: 2 * 60 * 1000,
    sessionEvents: 2 * 60 * 1000,
    endpointHealth: 5 * 60 * 1000,
    downtime: 2 * 60 * 1000,
    parserFailures: 5 * 60 * 1000,
    rateLimit: 5 * 60 * 1000,
    subjectDifficulty: 30 * 60 * 1000,
    bunkCulture: 30 * 60 * 1000,
    batchDistribution: 30 * 60 * 1000,
};

const DAY = 86400000;
const REAL_ROLL = /^\d{6,}$/;
const isRealRoll = (roll) => !!roll && REAL_ROLL.test(String(roll).trim());

const millis = (v) => (v && typeof v.toMillis === 'function') ? v.toMillis()
    : (typeof v === 'string' || typeof v === 'number') ? new Date(v).getTime() : 0;
const finiteMillis = (v) => { const m = millis(v); return Number.isFinite(m) && m > 0 ? m : null; };

// ── Cache: one doc per metric ────────────────────────────────────────
const cacheRef = (metric) => adminDb.doc(`admin/analyticsCache/metrics/${metric}`);

async function getCached(metric) {
    try {
        const snap = await cacheRef(metric).get();
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

async function setCache(metric, data) {
    try {
        await cacheRef(metric).set({ data, cachedAt: FieldValue.serverTimestamp() });
    } catch (e) {
        console.warn(`Cache write failed for ${metric}:`, e.message);
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
 * Users split into real students and unfinished sign-ups, plus each student's
 * current-semester summary. One users read + one semesters read, joined here.
 */
async function loadPeople() {
    const [usersSnap, semestersSnap] = await Promise.all([allUsers(), allSemesters()]);

    const students = new Map();   // userId → { doc data }
    const unfinished = [];
    usersSnap.forEach((d) => {
        const data = d.data() || {};
        if (isRealRoll(data.erpRollNumber)) students.set(d.id, { id: d.id, ...data });
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

// ── Metrics ──────────────────────────────────────────────────────────

async function computeOverview() {
    const now = Date.now();
    const { students, unfinished, semesters } = await loadPeople();

    let dau = 0, wau = 0, mau = 0;
    let withNumbers = 0, pctSum = 0, belowGoalStudents = 0, connected = 0;
    students.forEach((u, id) => {
        const last = finiteMillis(u.lastActive);
        if (last) {
            const diff = now - last;
            if (diff <= DAY) dau++;
            if (diff <= 7 * DAY) wau++;
            if (diff <= 30 * DAY) mau++;
        }
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

    // Last 7 days of sync telemetry: activity per day, success rate, sign-in events.
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const windowStart = startOfToday.getTime() - 6 * DAY;
    const syncsSnap = await recentSyncs(windowStart);
    const perDay = Array.from({ length: 7 }, () => new Set());
    let syncs24h = 0, ok24h = 0, attempts24h = 0, otp7d = 0, login7d = 0, syncs7d = 0;
    syncsSnap.forEach((d) => {
        const data = d.data();
        const ts = syncMillis(data);
        if (ts < windowStart) return;
        const userId = ownerOf(d);
        if (!userId || !students.has(userId)) return;
        syncs7d++;
        perDay[Math.min(6, Math.max(0, Math.floor((ts - windowStart) / DAY)))].add(userId);
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
        dau, wau, mau,
        syncs24h,
        syncs7d,
        successRate24h: attempts24h > 0 ? (ok24h * 100) / attempts24h : null,
        signInPrompts7d: otp7d,
        signInLost7d: login7d,
        avgAttendancePct: withNumbers > 0 ? Math.round((pctSum / withNumbers) * 10) / 10 : null,
        belowGoalStudents,
        studentsWithNumbers: withNumbers,
        sparkline: perDay.map((s) => s.size),
        sparklineStart: windowStart,
    };
}

async function computeUserRoster() {
    const { students, unfinished, semesters } = await loadPeople();
    const now = Date.now();
    const users = [];
    students.forEach((u, id) => {
        const sem = semesters.get(id);
        const s = summarise(sem?.latest);
        users.push({
            userId: id,
            rollNumber: u.erpRollNumber,
            studentName: u.studentName || s.userName || 'Student',
            batchGroup: u.batchGroup || null,
            lastActive: finiteMillis(u.lastActive),
            version: u.version || null,
            setupComplete: !!u.setupComplete || s.setupComplete,
            erpConnected: s.erpConnected,
            semesterCount: sem?.count || 0,
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
    users.sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));
    return {
        users,
        unfinished: {
            count: unfinished.length,
            olderThan7d: unfinished.filter((u) => !u.lastActive || u.lastActive < now - 7 * DAY).length,
        },
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
    const { students } = await loadPeople();
    const batches = {};
    students.forEach((u) => {
        const rn = String(u.erpRollNumber);
        const yearPrefix = rn.substring(0, 2);
        const fullYear = parseInt(yearPrefix, 10) >= 50 ? `19${yearPrefix}` : `20${yearPrefix}`;
        batches[`Batch ${fullYear}`] = (batches[`Batch ${fullYear}`] || 0) + 1;
    });
    const total = Object.values(batches).reduce((a, b) => a + b, 0);
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

async function computeRateLimit() {
    const hourAgo = Date.now() - 3600000;
    const dayAgo = Date.now() - DAY;
    const [{ students }, syncsSnap] = await Promise.all([loadPeople(), recentSyncs(dayAgo)]);
    const userSyncs = {};
    syncsSnap.forEach((d) => {
        const userId = ownerOf(d);
        if (!userId) return;
        const ts = syncMillis(d.data());
        if (ts < dayAgo) return;
        if (!userSyncs[userId]) userSyncs[userId] = { hourly: 0, daily: 0 };
        if (ts > hourAgo) userSyncs[userId].hourly++;
        userSyncs[userId].daily++;
    });
    return Object.entries(userSyncs)
        .map(([userId, s]) => ({
            rollNumber: students.get(userId)?.erpRollNumber || `(unknown: ${userId.slice(0, 8)})`,
            userId, hourly: s.hourly, daily: s.daily,
            status: s.hourly >= 15 ? 'restricted' : s.hourly >= 10 ? 'warning' : 'normal',
        }))
        .sort((a, b) => b.hourly - a.hourly || b.daily - a.daily);
}

// ── Handler ──────────────────────────────────────────────────────────

const METRIC_HANDLERS = {
    overview: computeOverview,
    userRoster: computeUserRoster,
    sessionEvents: computeSessionEvents,
    subjectDifficulty: computeSubjectDifficulty,
    bunkCulture: computeBunkCulture,
    batchDistribution: computeBatchDistribution,
    endpointHealth: computeEndpointHealth,
    parserFailures: computeParserFailures,
    rateLimit: computeRateLimit,
    downtime: computeDowntime,
    // Kept for older clients; the overview supersedes it.
    activeUsers: async () => {
        const o = await computeOverview();
        return { dau: o.dau, wau: o.wau, mau: o.mau, total: o.students, sparkline: o.sparkline, sparklineStart: o.sparklineStart };
    },
};

module.exports = async function handler(req, res) {
    setCorsHeaders(res, req);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { token, metric, forceRefresh } = req.body || {};

    const rollNumber = decodeSessionRollNumber(token);
    if (!rollNumber || !isAdminRoll(rollNumber)) return res.status(403).json({ error: 'Unauthorized' });

    if (await tooManyAttempts(res, 'admin-analytics-ip', getClientIp(req), IP_POLICY)) return;

    if (!metric || !METRIC_HANDLERS[metric]) {
        return res.status(400).json({ error: `Unknown metric: ${metric}. Valid: ${Object.keys(METRIC_HANDLERS).join(', ')}` });
    }

    try {
        if (!forceRefresh) {
            const cached = await getCached(metric);
            if (cached) return res.json({ data: cached.data, cached: true, cachedAt: cached.cachedAt });
        }
        const data = await METRIC_HANDLERS[metric]();
        await setCache(metric, data);
        return res.json({ data, cached: false, cachedAt: Date.now() });
    } catch (err) {
        console.error(`Analytics computation failed for ${metric}:`, err);
        // The reason is deliberately surfaced: only an admin ever sees it.
        return res.status(500).json({ error: `Failed to compute ${metric}: ${err.message}` });
    }
};

module.exports.isRealRoll = isRealRoll;
