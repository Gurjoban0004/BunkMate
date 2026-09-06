/**
 * Vercel Serverless Function: store / update a Web Push subscription.
 *
 * POST /api/push-subscribe
 * Headers: Authorization: Bearer <Firebase ID token>
 * Body: { userId, subscription, reminderTime?, enabled }
 *
 * Subscriptions live at users/{userId}/push/{endpointHash}. The daily-reminder cron
 * (api/push-send) reads them. Written with the Admin SDK (bypasses rules) — so the
 * caller's ownership of {userId} has to be proven here, since Firestore's own
 * `request.auth.uid == userId` rule never runs on this path.
 */

const crypto = require('crypto');
const { FieldValue } = require('firebase-admin/firestore');
const { verifyIdToken } = require('./_verify-id-token');
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

    // auth-token.js mints custom tokens with uid === login code, so a verified ID
    // token proves the caller holds this code. Without this, knowing a code was
    // enough to overwrite that user's push subscription.
    const bearer = String(req.headers.authorization || '');
    const idToken = bearer.startsWith('Bearer ') ? bearer.slice(7).trim() : '';
    if (!idToken) return res.status(401).json({ error: 'Authentication required' });

    try {
        const decoded = await verifyIdToken(idToken);
        if (decoded.uid !== userId) return res.status(403).json({ error: 'Forbidden' });
    } catch {
        return res.status(401).json({ error: 'Authentication required' });
    }

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
