/**
 * Vercel Cron: send the daily attendance reminder via Web Push.
 *
 * GET /api/push-send  (scheduled hourly by vercel.json)
 *
 * Each run finds subscriptions whose reminder hour matches the current hour in IST
 * (the app's user base is India) and pushes a nudge. Expired subscriptions (404/410)
 * are pruned. Requires env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
 * and optionally CRON_SECRET (Vercel sends it as a Bearer token).
 */

const webpush = require('web-push');
const { adminDb } = require('./_firebase-admin');

const IST_OFFSET_MIN = 5 * 60 + 30; // UTC+5:30

function currentIstHour() {
    const now = new Date();
    const istMinutes = now.getUTCHours() * 60 + now.getUTCMinutes() + IST_OFFSET_MIN;
    return Math.floor((istMinutes % (24 * 60)) / 60);
}

module.exports = async function handler(req, res) {
    // Only the Vercel cron (or a caller with the secret) may trigger sends.
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.authorization !== `Bearer ${secret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        return res.status(500).json({ error: 'VAPID keys not configured' });
    }
    webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:support@presence.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const hour = currentIstHour();
    const hourPrefix = String(hour).padStart(2, '0') + ':';

    const payload = JSON.stringify({
        title: 'Presence',
        body: "Have you marked today's attendance?",
        url: '/app',
        tag: 'presence-daily',
    });

    let sent = 0, pruned = 0;
    try {
        const snap = await adminDb.collectionGroup('push').where('enabled', '==', true).get();
        const jobs = [];
        snap.forEach((docSnap) => {
            const data = docSnap.data();
            if (!data.subscription || !String(data.reminderTime || '18:00').startsWith(hourPrefix)) return;
            jobs.push(
                webpush.sendNotification(data.subscription, payload)
                    .then(() => { sent++; })
                    .catch(async (err) => {
                        if (err.statusCode === 404 || err.statusCode === 410) {
                            pruned++;
                            await docSnap.ref.delete().catch(() => {});
                        }
                    })
            );
        });
        await Promise.all(jobs);
        return res.status(200).json({ ok: true, hour, sent, pruned });
    } catch (err) {
        return res.status(500).json({ error: 'Send failed', detail: err.message });
    }
};
