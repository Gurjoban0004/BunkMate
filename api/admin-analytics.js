/**
 * Vercel Serverless Function: Admin Analytics Computation
 *
 * POST /api/admin-analytics
 * Body: { rollNumber, metric }
 *
 * Computes heavy analytics server-side and caches each result to its own doc at
 * admin/analyticsCache/metrics/{metric}. Uses collectionGroup queries and
 * server-side aggregation so the client never reads the users collection.
 *
 * A failing metric returns 500 with the reason. It must never invent numbers —
 * a dashboard that quietly shows made-up figures is worse than one that errors.
 *
 * Metrics:
 *   subjectDifficulty — aggregates attendance across all users' semesters
 *   bunkCulture       — day-of-week bunk rates from attendance records
 *   endpointHealth    — 24h endpoint success/fail rates from telemetry
 *   parserFailures    — recent parser errors from telemetry
 *   rateLimit         — per-user sync frequency from telemetry
 *   activeUsers       — DAU/WAU/MAU, total users, real 7-day active trend
 *   downtime          — live ERP outages derived from sync telemetry
 *   batchDistribution — cohort breakdown
 *   userRoster        — detailed user directory
 */

const { setCorsHeaders, decodeSessionRollNumber } = require('./_session-utils');
const { adminDb, isAdminRoll } = require('./_firebase-admin');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Presence is a single-college app (CUIET): every genuine user signs in with a
// long numeric ERP roll number (e.g. 2410990296). Mock/dev and abandoned-onboarding
// docs have no such roll, and the dev mock login seeds sample subjects (CS201,
// "Web Development", …) that are NOT real uni subjects. Gating aggregation on a real
// roll keeps foreign/junk data out of the admin view and makes the user count honest.
const REAL_ROLL = /^\d{6,}$/;
const isRealRoll = (roll) => !!roll && REAL_ROLL.test(String(roll).trim());

// One document per metric. A single shared doc used to hold every metric at
// once, which put the whole user roster and every other result in one payload —
// that both blows past Firestore's 1MB document limit as the user base grows and
// makes every metric read drag the others along with it.
const cacheRef = (metric) => adminDb.doc(`admin/analyticsCache/metrics/${metric}`);

async function getCached(metric) {
    try {
        const snap = await cacheRef(metric).get();
        if (!snap.exists) return null;
        const entry = snap.data();
        if (!entry || !entry.cachedAt) return null;
        const age = Date.now() - (entry.cachedAt.toMillis ? entry.cachedAt.toMillis() : 0);
        if (age > CACHE_TTL_MS) return null;
        return { data: entry.data, cachedAt: entry.cachedAt.toMillis() };
    } catch {
        return null;
    }
}

async function setCache(metric, data) {
    try {
        await cacheRef(metric).set({ data, cachedAt: FieldValue.serverTimestamp() });
        return true;
    } catch (e) {
        // A metric too large to cache still gets served; it just recomputes every
        // time. Surface it in the logs rather than failing silently forever.
        console.warn(`Cache write failed for ${metric}:`, e.message);
        return false;
    }
}

/**
 * Recent sync telemetry. Prefers a server-side timestamp filter and only falls
 * back to a full collection-group scan when the index is missing — the previous
 * code always read every sync ever written just to keep the last 24 hours.
 */
async function recentSyncs(sinceMs) {
    const since = Timestamp.fromMillis(sinceMs);
    try {
        return await adminDb.collectionGroup('syncs').where('timestamp', '>=', since).get();
    } catch {
        return await adminDb.collectionGroup('syncs').get();
    }
}

const syncMillis = (data) => (data && data.timestamp && data.timestamp.toMillis)
    ? data.timestamp.toMillis()
    : 0;

// ── Metric Computations ──────────────────────────────────────────────

async function computeSubjectDifficulty() {
    const [usersSnap, semestersSnap] = await Promise.all([
        adminDb.collection('users').get(),
        adminDb.collectionGroup('semesters').get(),
    ]);

    // Only aggregate semesters owned by a real (roll-bearing) user, so mock/test
    // accounts' sample subjects never enter the heatmap.
    const realUserIds = new Set(
        usersSnap.docs.filter(d => isRealRoll(d.data()?.erpRollNumber)).map(d => d.id)
    );

    const subjectMap = {};
    semestersSnap.forEach(semDoc => {
        const ownerId = semDoc.ref.parent.parent?.id;
        if (!ownerId || !realUserIds.has(ownerId)) return;
        const subjects = semDoc.data()?.subjects;
        if (!Array.isArray(subjects)) return;
        subjects.forEach(sub => {
            // Normalize the name so casing/whitespace variants collapse into one row
            // instead of padding the list with near-duplicates.
            const key = String(sub.name || sub.id || '').trim().replace(/\s+/g, ' ');
            if (!key) return;
            const norm = key.toLowerCase();
            if (!subjectMap[norm]) subjectMap[norm] = { name: key, totalPresent: 0, totalAbsent: 0, students: 0 };
            subjectMap[norm].totalPresent += Number(sub.initialAttended) || 0;
            subjectMap[norm].totalAbsent += Math.max(0, (Number(sub.initialTotal) || 0) - (Number(sub.initialAttended) || 0));
            subjectMap[norm].students++;
        });
    });

    return Object.values(subjectMap)
        // A "difficulty" signal needs a cohort; a subject only one account tracks is
        // noise (and where stray/test entries live). Require at least 2 students.
        .filter(s => s.students >= 2)
        .map(s => {
            const total = s.totalPresent + s.totalAbsent;
            return {
                ...s,
                bunkRate: total > 0 ? (s.totalAbsent / total) * 100 : 0,
                attendanceRate: total > 0 ? (s.totalPresent / total) * 100 : 0,
            };
        })
        .sort((a, b) => b.bunkRate - a.bunkRate);
}

async function computeBunkCulture() {
    const semestersSnap = await adminDb.collectionGroup('semesters').get();
    const dayStats = {
        Monday: { present: 0, absent: 0 },
        Tuesday: { present: 0, absent: 0 },
        Wednesday: { present: 0, absent: 0 },
        Thursday: { present: 0, absent: 0 },
        Friday: { present: 0, absent: 0 },
        Saturday: { present: 0, absent: 0 },
    };
    const DAY_MAP = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday' };

    semestersSnap.forEach(semDoc => {
        const records = semDoc.data()?.attendanceRecords || {};
        Object.entries(records).forEach(([dateStr, dayData]) => {
            if (!dayData || dateStr.startsWith('_') || dayData._holiday) return;
            const [y, m, d] = dateStr.split('-').map(Number);
            if (!y || !m || !d) return;
            const dayName = DAY_MAP[new Date(y, m - 1, d, 12).getDay()];
            if (!dayName) return;

            Object.entries(dayData).forEach(([key, rec]) => {
                if (key.startsWith('_') || typeof rec !== 'object' || rec === null) return;
                // A day can be part attended, so count periods rather than
                // treating one status as covering all of them.
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

    return Object.entries(dayStats).map(([day, stats]) => {
        const total = stats.present + stats.absent;
        return { day, bunkRate: total > 0 ? (stats.absent / total) * 100 : 0, total };
    });
}

async function computeEndpointHealth() {
    const cutoff = Date.now() - 86400000;
    const syncsSnap = await recentSyncs(cutoff);
    const endpointStats = {};

    syncsSnap.forEach(syncDoc => {
        const data = syncDoc.data();
        if (!data || syncMillis(data) < cutoff) return;
        (data.endpoints || []).forEach(ep => {
            if (!ep || !ep.name) return;
            if (!endpointStats[ep.name]) endpointStats[ep.name] = { name: ep.name, success: 0, fail: 0, totalMs: 0, count: 0 };
            const stat = endpointStats[ep.name];
            if (ep.status === 'ok') stat.success++;
            else stat.fail++;
            stat.totalMs += ep.durationMs || 0;
            stat.count++;
        });
    });

    return Object.values(endpointStats)
        .map(s => ({
            ...s,
            successRate: s.count > 0 ? (s.success / s.count) * 100 : 0,
            avgDuration: s.count > 0 ? Math.round(s.totalMs / s.count) : 0,
        }))
        .sort((a, b) => a.successRate - b.successRate);
}

/**
 * Active ERP outages, derived from the same telemetry the health card uses.
 *
 * There is no writer anywhere in the app for the admin/downtime/events
 * collection this panel used to read, so it could only ever render empty. An
 * outage is instead inferred live: an endpoint is down when it has a meaningful
 * number of recent attempts and most of them failed. It clears itself when the
 * endpoint recovers, so there is nothing to resolve by hand.
 */
async function computeDowntime() {
    const WINDOW_MS = 60 * 60 * 1000;
    const MIN_ATTEMPTS = 3;      // one user retrying is not an outage
    const FAIL_RATE = 0.5;
    const cutoff = Date.now() - WINDOW_MS;

    const syncsSnap = await recentSyncs(cutoff);
    const stats = {};

    syncsSnap.forEach(syncDoc => {
        const data = syncDoc.data();
        const ts = syncMillis(data);
        if (!data || ts < cutoff) return;
        const userId = syncDoc.ref.path.split('/')[1] || 'unknown';

        (data.endpoints || []).forEach(ep => {
            if (!ep || !ep.name) return;
            if (!stats[ep.name]) {
                stats[ep.name] = { name: ep.name, attempts: 0, failures: 0, users: new Set(), firstFailAt: null, lastFailAt: null, sampleError: null };
            }
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
        .filter(s => s.attempts >= MIN_ATTEMPTS && s.failures / s.attempts >= FAIL_RATE)
        .map(s => ({
            id: s.name,
            type: `${s.name} endpoint failing`,
            failures: s.failures,
            attempts: s.attempts,
            failRate: (s.failures / s.attempts) * 100,
            affectedUsers: s.users.size,
            startedAt: s.firstFailAt,
            lastSeenAt: s.lastFailAt,
            sampleError: s.sampleError,
        }))
        .sort((a, b) => b.failRate - a.failRate);
}

async function computeParserFailures() {
    let syncsSnap;
    try {
        syncsSnap = await adminDb.collectionGroup('syncs').orderBy('timestamp', 'desc').limit(200).get();
    } catch {
        // Missing composite index — fall back to the last week rather than all time.
        syncsSnap = await recentSyncs(Date.now() - 7 * 86400000);
    }

    const failures = [];
    syncsSnap.forEach(syncDoc => {
        const data = syncDoc.data();
        if (!data || !data.parserErrors || data.parserErrors.length === 0) return;
        const pathParts = syncDoc.ref.path.split('/');
        failures.push({
            userId: pathParts.length >= 2 ? pathParts[1] : 'unknown',
            timestampMs: syncMillis(data) || null,
            errors: data.parserErrors,
            rollNumber: data.rollNumber || 'Unknown',
        });
    });

    return failures.sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0)).slice(0, 20);
}

async function computeRateLimit() {
    const hourAgo = Date.now() - 3600000;
    const dayAgo = Date.now() - 86400000;

    const usersSnap = await adminDb.collection('users').get();
    const userRolls = {};
    usersSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data && data.erpRollNumber) userRolls[docSnap.id] = data.erpRollNumber;
    });

    const syncsSnap = await recentSyncs(dayAgo);
    const userSyncs = {};

    syncsSnap.forEach(syncDoc => {
        const userId = syncDoc.ref.path.split('/')[1];
        if (!userId) return;
        const ts = syncMillis(syncDoc.data());
        if (ts < dayAgo) return;
        if (!userSyncs[userId]) userSyncs[userId] = { hourly: 0, daily: 0 };
        if (ts > hourAgo) userSyncs[userId].hourly++;
        userSyncs[userId].daily++;
    });

    return Object.entries(userSyncs)
        .map(([userId, s]) => ({
            // A sync with no matching user doc is still real traffic worth showing.
            rollNumber: userRolls[userId] || `(unknown: ${userId.slice(0, 8)})`,
            userId,
            hourly: s.hourly,
            daily: s.daily,
            status: s.hourly >= 15 ? 'restricted' : s.hourly >= 10 ? 'warning' : 'normal',
        }))
        .sort((a, b) => b.hourly - a.hourly || b.daily - a.daily);
}

async function computeActiveUsers() {
    const usersSnap = await adminDb.collection('users').get();
    const now = Date.now();
    const DAY = 86400000;
    let dau = 0, wau = 0, mau = 0;
    // Count only real, onboarded users — placeholder/mock docs shouldn't inflate the total.
    let realTotal = 0;

    usersSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (isRealRoll(data?.erpRollNumber)) realTotal++;
        if (!data || !data.lastActive) return;
        const lastActive = data.lastActive.toMillis
            ? data.lastActive.toMillis()
            : new Date(data.lastActive).getTime();
        if (!Number.isFinite(lastActive)) return;
        const diff = now - lastActive;
        if (diff <= DAY) dau++;
        if (diff <= 7 * DAY) wau++;
        if (diff <= 30 * DAY) mau++;
    });

    // The sparkline used to bucket each user by their last-seen day, so a user
    // active all week appeared on exactly one day and the "trend" was really a
    // last-seen histogram that could never sum to DAU. Count distinct users with
    // real activity on each of the last 7 days instead.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const windowStart = startOfToday.getTime() - 6 * DAY;
    const perDay = Array.from({ length: 7 }, () => new Set());

    const syncsSnap = await recentSyncs(windowStart);
    syncsSnap.forEach(syncDoc => {
        const ts = syncMillis(syncDoc.data());
        if (ts < windowStart) return;
        const dayIndex = Math.floor((ts - windowStart) / DAY);
        if (dayIndex < 0 || dayIndex > 6) return;
        const userId = syncDoc.ref.path.split('/')[1];
        if (userId) perDay[dayIndex].add(userId);
    });

    return {
        dau,
        wau,
        mau,
        total: realTotal,
        sparkline: perDay.map(s => s.size),
        sparklineStart: windowStart,
    };
}

async function computeBatchDistribution() {
    const usersSnap = await adminDb.collection('users').get();
    const batches = {};

    usersSnap.forEach(docSnap => {
        const rn = docSnap.data()?.erpRollNumber;
        if (!rn || String(rn).length < 4) return;
        const yearPrefix = String(rn).substring(0, 2);
        const fullYear = parseInt(yearPrefix, 10) >= 50 ? `19${yearPrefix}` : `20${yearPrefix}`;
        batches[`Batch ${fullYear}`] = (batches[`Batch ${fullYear}`] || 0) + 1;
    });

    const total = Object.values(batches).reduce((a, b) => a + b, 0);
    return Object.entries(batches)
        .map(([batch, count]) => ({ batch, count, percentage: total > 0 ? (count / total) * 100 : 0 }))
        .sort((a, b) => b.count - a.count);
}

async function computeUserRoster() {
    // Previously this ran one semesters subcollection read per user, in series —
    // an N+1 that got linearly slower with every signup and eventually times the
    // function out. Read every semester once and group by owner instead.
    const [usersSnap, semestersSnap] = await Promise.all([
        adminDb.collection('users').get(),
        adminDb.collectionGroup('semesters').get(),
    ]);

    const byUser = {}; // userId → { semesterCount, subjects[] }
    semestersSnap.forEach(semDoc => {
        const userId = semDoc.ref.parent.parent?.id;
        if (!userId) return;
        if (!byUser[userId]) byUser[userId] = { semesterCount: 0, subjects: [] };
        byUser[userId].semesterCount++;

        const subjects = semDoc.data()?.subjects;
        if (!Array.isArray(subjects)) return;
        subjects.forEach(sub => {
            const attended = Number(sub.initialAttended) || 0;
            const total = Number(sub.initialTotal) || 0;
            byUser[userId].subjects.push({
                name: sub.name || sub.id || 'Unknown',
                attended,
                total,
                target: sub.target || 75,
                pct: total > 0 ? (attended / total) * 100 : 0,
            });
        });
    });

    const roster = usersSnap.docs.map(docSnap => {
        const data = docSnap.data() || {};
        const agg = byUser[docSnap.id] || { semesterCount: 0, subjects: [] };
        const totalAttended = agg.subjects.reduce((sum, s) => sum + s.attended, 0);
        const totalClasses = agg.subjects.reduce((sum, s) => sum + s.total, 0);

        let lastActiveTs = null;
        if (data.lastActive) {
            const ms = typeof data.lastActive.toMillis === 'function'
                ? data.lastActive.toMillis()
                : new Date(data.lastActive).getTime();
            if (Number.isFinite(ms)) lastActiveTs = ms;
        }

        return {
            userId: docSnap.id,
            rollNumber: data.erpRollNumber || 'Unknown',
            studentName: data.studentName || 'Student',
            lastActive: lastActiveTs,
            setupComplete: !!data.setupComplete,
            version: data.version || '1.0.0',
            semesterCount: agg.semesterCount,
            totalSubjects: agg.subjects.length,
            totalClasses,
            totalAttended,
            overallAttendancePct: totalClasses > 0
                ? Math.round((totalAttended / totalClasses) * 1000) / 10
                : null,
            subjects: agg.subjects,
        };
    });

    return roster.sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));
}

// ── Handler ─────────────────────────────────────────────────────────

const METRIC_HANDLERS = {
    subjectDifficulty: computeSubjectDifficulty,
    bunkCulture: computeBunkCulture,
    endpointHealth: computeEndpointHealth,
    parserFailures: computeParserFailures,
    rateLimit: computeRateLimit,
    activeUsers: computeActiveUsers,
    batchDistribution: computeBatchDistribution,
    userRoster: computeUserRoster,
    downtime: computeDowntime,
};

module.exports = async function handler(req, res) {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { token, metric, forceRefresh } = req.body || {};

    const rollNumber = decodeSessionRollNumber(token);
    if (!rollNumber || !isAdminRoll(rollNumber)) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

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
        // A dashboard that invents numbers when the query fails is worse than one
        // that says it failed. This used to answer 200 with { dau: 1, wau: 1 }.
        console.error(`Analytics computation failed for ${metric}:`, err);
        return res.status(500).json({ error: `Failed to compute ${metric}: ${err.message}` });
    }
};
