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

const { setCorsHeaders } = require('./_session-utils');
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

// ── Handler ─────────────────────────────────────────────────────────

const METRIC_HANDLERS = {
    subjectDifficulty: computeSubjectDifficulty,
    bunkCulture: computeBunkCulture,
    endpointHealth: computeEndpointHealth,
    parserFailures: computeParserFailures,
    rateLimit: computeRateLimit,
};

module.exports = async function handler(req, res) {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { rollNumber, metric, forceRefresh } = req.body || {};

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
