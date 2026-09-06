/**
 * Vercel Cron: send the daily attendance reminder via Web Push.
 *
 * GET /api/push-send — scheduled once a day by vercel.json (12:30 UTC = 18:00 IST).
 *
 * Auth fails CLOSED (audit C3): without CRON_SECRET configured, or without the
 * matching bearer, nothing is sent. Vercel attaches `Authorization: Bearer
 * $CRON_SECRET` to cron invocations automatically once the env var exists.
 *
 * There is one reminder time for everyone (audit H2). The app never shipped a
 * time picker, the cron is daily, and Vercel's Hobby plan does not run hourly
 * crons — so the per-hour filter that silently dropped every user not on 18:xx
 * is gone rather than pretended at.
 */

const crypto = require('crypto');
const webpush = require('web-push');
const { adminDb } = require('./_firebase-admin');

const MAX_SUBSCRIPTIONS = 5000;   // bounded read; well above the user base

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

    const payload = JSON.stringify({
        title: 'Presence',
        body: "Have you marked today's attendance?",
        url: '/app',
        tag: 'presence-daily',
    });

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
            jobs.push(
                webpush.sendNotification(data.subscription, payload, { TTL: 6 * 3600 })
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
