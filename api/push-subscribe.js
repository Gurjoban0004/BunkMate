/**
 * Vercel Serverless Function: store / update a Web Push subscription.
 *
 * POST /api/push-subscribe
 * Body: { userId, subscription, reminderTime?, enabled }
 *
 * Subscriptions live at users/{userId}/push/{endpointHash}. The daily-reminder cron
 * (api/push-send) reads them. Written with the Admin SDK (bypasses rules).
 */

const crypto = require('crypto');
const { FieldValue } = require('firebase-admin/firestore');
const { setCorsHeaders } = require('./_session-utils');
const { adminDb } = require('./_firebase-admin');

const CODE_REGEX = /^PRES-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{7}$/;

function endpointHash(endpoint) {
    return crypto.createHash('sha256').update(String(endpoint)).digest('hex').slice(0, 32);
}

module.exports = async function handler(req, res) {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { userId, subscription, reminderTime, enabled } = req.body || {};
    if (!userId || !CODE_REGEX.test(userId)) return res.status(400).json({ error: 'Invalid user' });
    if (!subscription || !subscription.endpoint) return res.status(400).json({ error: 'Invalid subscription' });

    try {
        const ref = adminDb.doc(`users/${userId}/push/${endpointHash(subscription.endpoint)}`);
        if (enabled === false) {
            await ref.set({ enabled: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        } else {
            await ref.set({
                subscription,
                reminderTime: /^\d{2}:\d{2}$/.test(reminderTime) ? reminderTime : '18:00',
                enabled: true,
                updatedAt: FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        return res.status(200).json({ ok: true });
    } catch (err) {
        return res.status(500).json({ error: 'Could not save subscription' });
    }
};
