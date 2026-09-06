/**
 * POST /api/push-subscribe
 * Headers: Authorization: Bearer <Firebase ID token>
 * Body: { userId, subscription, enabled }
 *
 * Subscriptions live at users/{userId}/push/{endpointHash}. Written with the
 * Admin SDK (bypasses rules), so the caller's ownership of {userId} is proven
 * here by verifying the ID token's uid. The subscription object is validated
 * to the shape web-push needs and nothing else is stored.
 */

const crypto = require('crypto');
const { FieldValue } = require('firebase-admin/firestore');
const { verifyIdToken } = require('./_verify-id-token');
const { setCorsHeaders } = require('./_session-utils');
const { tooManyAttempts } = require('./_rate-limit');
const { adminDb } = require('./_firebase-admin');

const CODE_REGEX = /^PRES-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{7}$/;
const USER_POLICY = { max: 20, windowMs: 10 * 60 * 1000 };

function endpointHash(endpoint) {
    return crypto.createHash('sha256').update(String(endpoint)).digest('hex').slice(0, 32);
}

/** Only the fields web-push consumes; rejects anything malformed or oversized. */
function cleanSubscription(sub) {
    if (!sub || typeof sub !== 'object') return null;
    const endpoint = typeof sub.endpoint === 'string' ? sub.endpoint : '';
    const p256dh = typeof sub.keys?.p256dh === 'string' ? sub.keys.p256dh : '';
    const auth = typeof sub.keys?.auth === 'string' ? sub.keys.auth : '';
    if (!/^https:\/\/\S{1,2000}$/.test(endpoint)) return null;
    if (!p256dh || p256dh.length > 256 || !auth || auth.length > 64) return null;
    return { endpoint, keys: { p256dh, auth } };
}

module.exports = async function handler(req, res) {
    setCorsHeaders(res, req);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { userId, subscription, enabled } = req.body || {};
    if (!userId || typeof userId !== 'string' || !CODE_REGEX.test(userId)) {
        return res.status(400).json({ error: 'Invalid user' });
    }
    const clean = cleanSubscription(subscription);
    if (!clean) return res.status(400).json({ error: 'Invalid subscription' });

    const bearer = String(req.headers.authorization || '');
    const idToken = bearer.startsWith('Bearer ') ? bearer.slice(7).trim() : '';
    if (!idToken) return res.status(401).json({ error: 'Authentication required' });

    try {
        const decoded = await verifyIdToken(idToken);
        if (decoded.uid !== userId) return res.status(403).json({ error: 'Forbidden' });
    } catch {
        return res.status(401).json({ error: 'Authentication required' });
    }

    if (await tooManyAttempts(res, 'push-subscribe-user', userId, USER_POLICY)) return;

    try {
        const ref = adminDb.doc(`users/${userId}/push/${endpointHash(clean.endpoint)}`);
        if (enabled === false) {
            await ref.set({ enabled: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        } else {
            await ref.set({ subscription: clean, enabled: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        }
        return res.status(200).json({ ok: true });
    } catch (err) {
        console.error('push-subscribe failed:', err.message);
        return res.status(500).json({ error: 'Could not save subscription' });
    }
};
