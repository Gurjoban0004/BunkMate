/**
 * Vercel Cron: send the daily attendance reminder via Web Push.
 *
 * GET /api/push-send — scheduled once a day by vercel.json (12:30 UTC = 18:00 IST).
 *
 * Auth fails CLOSED (audit C3): without CRON_SECRET configured, or without the
 * matching bearer, nothing is sent. Vercel attaches `Authorization: Bearer
 * $CRON_SECRET` to cron invocations automatically once the env var exists.
 *
 * There is one send time for everyone (audit H2): the cron is daily and
 * Vercel's Hobby plan does not run hourly crons.
 *
 * The body is personal: each subscriber's current-semester document is read
 * once and summarised (overall %, subjects below goal). A student whose
 * semester has no numbers yet gets a plain "open the app" line instead.
 */

const crypto = require('crypto');
const webpush = require('web-push');
const { adminDb } = require('./_firebase-admin');

const MAX_SUBSCRIPTIONS = 5000;   // bounded read; well above the user base

/** "fall-2026" style id for today — mirrors src/utils/firebaseHelpers.getCurrentSemesterId. */
function currentSemesterId() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    if (month >= 8) return `fall-${year}`;
    if (month <= 5) return `spring-${year}`;
    return `summer-${year}`;
}

/** One line about where this student stands, from their saved numbers. */
async function summaryFor(userId) {
    const fallback = 'Your attendance is up to date. Open Presence to see this week.';
    if (!userId) return fallback;
    try {
        const snap = await adminDb.doc(`users/${userId}/semesters/${currentSemesterId()}`).get();
        const data = snap.exists ? snap.data() : null;
        const subjects = Array.isArray(data?.subjects) ? data.subjects : [];
        const goal = Number(data?.settings?.dangerThreshold) || 75;
        let attended = 0, total = 0, below = 0;
        for (const s of subjects) {
            const t = Number(s.initialTotal) || 0;
            const a = Math.min(Number(s.initialAttended) || 0, t);
            if (t <= 0) continue;
            attended += a;
            total += t;
            if (100 * a < (Number(s.target) || goal) * t) below++;
        }
        if (total === 0) return fallback;
        const pct = Math.round((attended * 1000) / total) / 10;
        const belowLine = below === 0 ? 'Every subject is above goal.' : `${below} subject${below === 1 ? '' : 's'} below goal.`;
        return `You're at ${pct}% overall. ${belowLine}`;
    } catch {
        return fallback;
    }
}

function authorized(req) {
    const secret = process.env.CRON_SECRET;
    if (!secret) return false;
    const expected = Buffer.from(`Bearer ${secret}`);
    const given = Buffer.from(String(req.headers.authorization || ''));
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

module.exports = async function handler(req, res) {
    if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });

    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
        return res.status(500).json({ error: 'VAPID keys not configured' });
    }
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    let sent = 0, pruned = 0, failed = 0;
    try {
        const snap = await adminDb.collectionGroup('push')
            .where('enabled', '==', true)
            .limit(MAX_SUBSCRIPTIONS)
            .get();

        const jobs = [];
        snap.forEach((docSnap) => {
            const data = docSnap.data();
            if (!data.subscription) return;
            const userId = docSnap.ref.path.split('/')[1];
            jobs.push(
                summaryFor(userId)
                    .then((body) => webpush.sendNotification(data.subscription, JSON.stringify({
                        title: 'Presence', body, url: '/app', tag: 'presence-daily',
                    }), { TTL: 6 * 3600 }))
                    .then(() => { sent++; })
                    .catch(async (err) => {
                        if (err.statusCode === 404 || err.statusCode === 410) {
                            pruned++;
                            await docSnap.ref.delete().catch(() => {});
                        } else {
                            failed++;
                        }
                    })
            );
        });
        await Promise.all(jobs);
        return res.status(200).json({ ok: true, sent, pruned, failed });
    } catch (err) {
        console.error('push-send failed:', err.message);
        return res.status(500).json({ error: 'Send failed' });
    }
};
