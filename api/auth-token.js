/**
 * POST /api/auth-token
 * Body: { code: "PRES-XXXXXXX", create?: boolean }
 *
 * The login code IS the identity (there is no email/password). This is the ONLY
 * place a client can obtain a Firebase session for its code: it validates the
 * format, rate-limits by IP, confirms the user doc exists (or creates it when
 * `create` is set) and mints a custom token with uid === code. Firestore rules
 * then enforce `request.auth.uid == userId`.
 *
 * Minting is done with `crypto` (api/_custom-token.js), not firebase-admin/auth,
 * which cannot load on Vercel — see docs/BUG-auth-token-esm.md.
 */

const { FieldValue } = require('firebase-admin/firestore');
const { setCorsHeaders, getClientIp } = require('./_session-utils');
const { tooManyAttempts } = require('./_rate-limit');
const { createCustomToken } = require('./_custom-token');
const { adminDb } = require('./_firebase-admin');

const CODE_REGEX = /^PRES-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{7}$/;
const IP_POLICY = { max: 12, windowMs: 10 * 60 * 1000 };

module.exports = async function handler(req, res) {
    setCorsHeaders(res, req);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { code, create } = req.body || {};
    if (!code || typeof code !== 'string' || !CODE_REGEX.test(code)) {
        return res.status(400).json({ error: 'Invalid login code' });
    }

    if (await tooManyAttempts(res, 'auth-token-ip', getClientIp(req), IP_POLICY)) return;

    try {
        const userRef = adminDb.doc(`users/${code}`);
        const snap = await userRef.get();

        if (!snap.exists) {
            if (!create) return res.status(404).json({ error: 'Invalid login code' });
            await userRef.set({
                createdAt: FieldValue.serverTimestamp(),
                lastActive: FieldValue.serverTimestamp(),
            });
        } else {
            await userRef.set({ lastActive: FieldValue.serverTimestamp() }, { merge: true });
        }

        return res.status(200).json({ token: createCustomToken(code) });
    } catch (err) {
        console.error('auth-token failed:', err.message);
        return res.status(500).json({ error: 'Could not sign in. Please try again.' });
    }
};
