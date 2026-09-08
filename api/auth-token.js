/**
 * POST /api/auth-token
 * Body: { token }   — the ERP session token this app already holds
 *
 * Mints the Firebase session used for cloud sync. The identity is the student's
 * roll number, taken from inside the sealed ERP session token — never from a
 * client-sent field — so proving who you are is exactly the thing you already
 * did at the college's own login. Firestore rules then enforce
 * `request.auth.uid == userId`.
 *
 * This replaced the PRES-XXXXXXX login code, which was a second credential that
 * existed only to find your cloud data again after a reinstall — and which lost
 * that data for anyone who did not write it down. Signing in to the college
 * recovers it now, because the roll number is the key.
 *
 * Minting is done with `crypto` (api/_custom-token.js), not firebase-admin/auth,
 * which cannot load on Vercel — see docs/BUG-auth-token-esm.md.
 */

const { FieldValue } = require('firebase-admin/firestore');
const { setCorsHeaders, getClientIp, decodeSessionRollNumber } = require('./_session-utils');
const { tooManyAttempts } = require('./_rate-limit');
const { createCustomToken } = require('./_custom-token');
const { adminDb } = require('./_firebase-admin');

const IP_POLICY = { max: 30, windowMs: 10 * 60 * 1000 };

module.exports = async function handler(req, res) {
    setCorsHeaders(res, req);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { token } = req.body || {};
    if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'Missing session' });
    }

    if (await tooManyAttempts(res, 'auth-token-ip', getClientIp(req), IP_POLICY)) return;

    // Forged, tampered or stale tokens all decode to null.
    const rollNumber = decodeSessionRollNumber(token);
    if (!rollNumber) return res.status(401).json({ error: 'Session expired' });

    try {
        // First sign-in creates the doc; the ERP already vouched for this roll,
        // so there is nothing extra to check and no `create` flag to pass. The
        // read is only so createdAt keeps meaning first-seen — a blind merge
        // would reset it on every launch.
        const userRef = adminDb.doc(`users/${rollNumber}`);
        const snap = await userRef.get();
        await userRef.set({
            lastActive: FieldValue.serverTimestamp(),
            ...(snap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
        }, { merge: true });

        return res.status(200).json({ token: createCustomToken(rollNumber) });
    } catch (err) {
        console.error('auth-token failed:', err.message);
        return res.status(500).json({ error: 'Could not sign in. Please try again.' });
    }
};
