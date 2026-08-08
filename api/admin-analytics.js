/**
 * Vercel Serverless Function: Admin Analytics Computation
 *
 * POST /api/admin-analytics
 * Body: { rollNumber, metric }
 *
 * Computes heavy analytics server-side and caches results to admin/analytics/{metric}.
 * Avoids N+1 Firestore reads on the client by using collectionGroup queries
 * and server-side aggregation.
 *
 * Metrics:
 *   subjectDifficulty — aggregates attendance across all users' semesters
 *   bunkCulture       — day-of-week bunk rates from attendance records
 *   endpointHealth    — 24h endpoint success/fail rates from telemetry
 *   parserFailures    — recent parser errors from telemetry
 *   rateLimit         — per-user sync frequency from telemetry
 */

const { setCorsHeaders, decodeSessionRollNumber } = require('./_session-utils');
const { adminDb, isAdminRoll } = require('./_firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

async function getCached(metric) {
    const snap = await adminDb.doc(`admin/analytics`).get();
    if (!snap.exists) return null;
    const data = snap.data();
    const entry = data[metric];
    if (!entry || !entry.cachedAt) return null;
    const age = Date.now() - entry.cachedAt.toMillis();
    if (age > CACHE_TTL_MS) return null;
    return entry.data;
}

async function setCache(metric, data) {
    await adminDb.doc('admin/analytics').set({
        [metric]: {
            data,
            cachedAt: FieldValue.serverTimestamp(),
        },
    }, { merge: true });
}

// ── Metric Computation ──────────────────────────────────────────────

async function computeSubjectDifficulty() {
    const semestersSnap = await adminDb.collectionGroup('semesters').get();
    const subjectMap = {};

    semestersSnap.forEach(semDoc => {
        const data = semDoc.data();
        if (!data.subjects) return;
        data.subjects.forEach(sub => {
            const key = sub.name || sub.id;
            if (!key) return;
            if (!subjectMap[key]) subjectMap[key] = { name: key, totalPresent: 0, totalAbsent: 0, students: 0 };
            subjectMap[key].totalPresent += sub.initialAttended || 0;
            subjectMap[key].totalAbsent += Math.max(0, (sub.initialTotal || 0) - (sub.initialAttended || 0));
            subjectMap[key].students++;
        });
    });

    return Object.values(subjectMap)
        .filter(s => s.students >= 3)
        .map(s => {
            const total = s.totalPresent + s.totalAbsent;
            const bunkRate = total > 0 ? (s.totalAbsent / total) * 100 : 0;
            return { ...s, bunkRate, attendanceRate: total > 0 ? (s.totalPresent / total) * 100 : 0 };
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
    };
    const DAY_MAP = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday' };

    semestersSnap.forEach(semDoc => {
        const records = semDoc.data()?.attendanceRecords || {};
        Object.entries(records).forEach(([dateStr, dayData]) => {
            if (dateStr.startsWith('_') || dayData._holiday) return;
            const [y, m, d] = dateStr.split('-').map(Number);
            const date = new Date(y, m - 1, d, 12);
            const dayName = DAY_MAP[date.getDay()];
            if (!dayName) return;
            Object.values(dayData).forEach(rec => {
                if (typeof rec !== 'object' || rec === null) return;
                if (rec.status === 'present') dayStats[dayName].present += (rec.units || 1);
                else if (rec.status === 'absent' || rec.status === 'bunked') dayStats[dayName].absent += (rec.units || 1);
            });
        });
    });

    return Object.entries(dayStats).map(([day, stats]) => {
        const total = stats.present + stats.absent;
        return { day, bunkRate: total > 0 ? (stats.absent / total) * 100 : 0, total };
    });
}

async function computeEndpointHealth() {
    const syncsSnap = await adminDb.collectionGroup('syncs').get();
    const endpointStats = {};
    const cutoff = Date.now() - 86400000;

    syncsSnap.forEach(syncDoc => {
        const data = syncDoc.data();
        const ts = data.timestamp?.toMillis ? data.timestamp.toMillis() : 0;
        if (ts < cutoff) return;
        (data.endpoints || []).forEach(ep => {
            if (!endpointStats[ep.name]) endpointStats[ep.name] = { name: ep.name, success: 0, fail: 0, totalMs: 0, count: 0 };
            const stat = endpointStats[ep.name];
            if (ep.status === 'ok') stat.success++;
            else stat.fail++;
            stat.totalMs += ep.durationMs || 0;
            stat.count++;
        });
    });

    return Object.values(endpointStats).map(s => ({
        ...s,
        successRate: s.count > 0 ? (s.success / s.count) * 100 : 0,
        avgDuration: s.count > 0 ? Math.round(s.totalMs / s.count) : 0,
    }));
}

async function computeParserFailures() {
    const syncsSnap = await adminDb.collectionGroup('syncs')
        .orderBy('timestamp', 'desc')
        .limit(200)
        .get();

    const failures = [];

    syncsSnap.forEach(syncDoc => {
        const data = syncDoc.data();
        if (data.parserErrors && data.parserErrors.length > 0) {
            const pathParts = syncDoc.ref.path.split('/');
            const userId = pathParts.length >= 2 ? pathParts[1] : 'unknown';
            failures.push({
                userId,
                timestamp: data.timestamp ? { _seconds: data.timestamp.seconds, _nanoseconds: data.timestamp.nanoseconds } : null,
                errors: data.parserErrors,
                rollNumber: data.rollNumber || 'Unknown',
            });
        }
    });

    return failures.slice(0, 10);
}

async function computeRateLimit() {
    const usersSnap = await adminDb.collection('users').get();
    const hourAgo = Date.now() - 3600000;
    const dayAgo = Date.now() - 86400000;
    const userRolls = {};

    usersSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.erpRollNumber) {
            userRolls[docSnap.id] = data.erpRollNumber;
        }
    });

    const syncsSnap = await adminDb.collectionGroup('syncs').get();
    const userSyncs = {};

    syncsSnap.forEach(syncDoc => {
        const pathParts = syncDoc.ref.path.split('/');
        const userId = pathParts.length >= 2 ? pathParts[1] : null;
        if (!userId || !userRolls[userId]) return;

        const ts = syncDoc.data().timestamp?.toMillis ? syncDoc.data().timestamp.toMillis() : 0;
        if (!userSyncs[userId]) userSyncs[userId] = { hourly: 0, daily: 0 };
        if (ts > hourAgo) userSyncs[userId].hourly++;
        if (ts > dayAgo) userSyncs[userId].daily++;
    });

    return Object.entries(userSyncs)
        .filter(([_, s]) => s.hourly > 0 || s.daily > 0)
        .map(([userId, s]) => ({
            rollNumber: userRolls[userId],
            userId,
            hourly: s.hourly,
            daily: s.daily,
            status: s.hourly >= 15 ? 'restricted' : s.hourly >= 10 ? 'warning' : 'normal',
        }))
        .sort((a, b) => b.hourly - a.hourly);
}

async function computeActiveUsers() {
    const usersSnap = await adminDb.collection('users').get();
    const now = Date.now();
    const DAY = 86400000;
    let dau = 0, wau = 0, mau = 0;
    const dailyCounts = new Array(7).fill(0);

    usersSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.lastActive) return;
        const lastActive = data.lastActive.toMillis ? data.lastActive.toMillis() : new Date(data.lastActive).getTime();
        const diff = now - lastActive;
        if (diff <= DAY) dau++;
        if (diff <= 7 * DAY) wau++;
        if (diff <= 30 * DAY) mau++;
        const daysAgo = Math.floor(diff / DAY);
        if (daysAgo < 7) dailyCounts[6 - daysAgo]++;
    });

    return { dau, wau, mau, sparkline: dailyCounts };
}

async function computeBatchDistribution() {
    const usersSnap = await adminDb.collection('users').get();
    const batches = {};

    usersSnap.forEach(docSnap => {
        const rn = docSnap.data().erpRollNumber;
        if (!rn || rn.length < 4) return;
        const yearPrefix = rn.substring(0, 2);
        const fullYear = parseInt(yearPrefix, 10) >= 50 ? `19${yearPrefix}` : `20${yearPrefix}`;
        const batchLabel = `Batch ${fullYear}`;
        batches[batchLabel] = (batches[batchLabel] || 0) + 1;
    });

    const total = Object.values(batches).reduce((a, b) => a + b, 0);
    return Object.entries(batches)
        .map(([batch, count]) => ({ batch, count, percentage: total > 0 ? (count / total) * 100 : 0 }))
        .sort((a, b) => b.count - a.count);
}

async function computeUserRoster() {
    const usersSnap = await adminDb.collection('users').get();
    const roster = [];

    for (const docSnap of usersSnap.docs) {
        const data = docSnap.data();
        const userId = docSnap.id;

        const semsSnap = await docSnap.ref.collection('semesters').get();
        let totalSubjects = 0;
        let totalAttended = 0;
        let totalClasses = 0;
        const subjectsList = [];

        semsSnap.forEach(semDoc => {
            const semData = semDoc.data();
            if (semData.subjects && Array.isArray(semData.subjects)) {
                totalSubjects += semData.subjects.length;
                semData.subjects.forEach(sub => {
                    const att = sub.initialAttended || 0;
                    const tot = sub.initialTotal || 0;
                    totalAttended += att;
                    totalClasses += tot;
                    subjectsList.push({
                        name: sub.name || sub.id,
                        attended: att,
                        total: tot,
                        target: sub.target || 75,
                        pct: tot > 0 ? (att / tot) * 100 : 0,
                    });
                });
            }
        });

        const overallPct = totalClasses > 0 ? (totalAttended / totalClasses) * 100 : null;
        let lastActiveTs = null;
        if (data.lastActive) {
            lastActiveTs = typeof data.lastActive.toMillis === 'function'
                ? data.lastActive.toMillis()
                : new Date(data.lastActive).getTime();
        }

        roster.push({
            userId,
            rollNumber: data.erpRollNumber || 'Unknown',
            studentName: data.studentName || 'Student',
            lastActive: lastActiveTs,
            setupComplete: !!data.setupComplete,
            version: data.version || '1.0.0',
            semesterCount: semsSnap.size,
            totalSubjects,
            totalClasses,
            totalAttended,
            overallAttendancePct: overallPct != null ? Math.round(overallPct * 10) / 10 : null,
            subjects: subjectsList,
        });
    }

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
            if (cached) return res.json({ data: cached, cached: true });
        }

        const data = await METRIC_HANDLERS[metric]();
        await setCache(metric, data);
        return res.json({ data, cached: false });
    } catch (err) {
        console.error(`Analytics computation failed for ${metric}:`, err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
