/**
 * Vercel Serverless Function: Firebase custom-token auth
 *
 * POST /api/auth-token
 * Body: { code: "PRES-XXXXXXX", create?: boolean }
 *
 * The login code IS the identity (there is no email/password). This endpoint is
 * the ONLY place a client can obtain a Firebase auth session for its code:
 *   - validates the code format
 *   - rate-limits by client IP (brute-force defense)
 *   - confirms the user doc exists (or creates it when `create` is set)
 *   - mints a Firebase custom token with uid === code
 *
 * The client then calls signInWithCustomToken(). Firestore rules enforce
 * `request.auth.uid == userId`, so a code-holder can only touch their own data.
 *
 * Requires the service account to have the "Service Account Token Creator" role
 * and Firebase Authentication enabled on the project.
 */

// ⚠️ BROKEN IN PRODUCTION — this handler returns FUNCTION_INVOCATION_FAILED.
// `firebase-admin/auth` cannot load on Vercel: jwks-rsa@4 does a CJS require() of
// ESM-only jose@6, and Vercel's bytecode loader does not implement require(esm).
// It loads fine locally, so this only reproduces in production.
// Root cause, the fix, and what not to try: docs/BUG-auth-token-esm.md

const crypto = require('crypto');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue } = require('firebase-admin/firestore');
const { setCorsHeaders } = require('./_session-utils');
const { adminDb } = require('./_firebase-admin');

const CODE_REGEX = /^PRES-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{7}$/;
const RATE_MAX = 12;                    // attempts per window per IP
const RATE_WINDOW_MS = 10 * 60 * 1000;  // 10 minutes

function hashIp(ip) {
    return crypto.createHash('sha256').update(String(ip)).digest('hex').slice(0, 24);
}

/** Firestore-backed IP limiter. Fails open on limiter errors — never blocks a real login. */
async function allowAttempt(ip) {
    try {
        const ref = adminDb.doc(`rateLimits/${hashIp(ip)}`);
        const now = Date.now();
        return await adminDb.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            const data = snap.exists ? snap.data() : null;
            if (!data || now - (data.windowStart || 0) > RATE_WINDOW_MS) {
                tx.set(ref, { windowStart: now, count: 1 });
                return true;
            }
            if ((data.count || 0) >= RATE_MAX) return false;
            tx.update(ref, { count: (data.count || 0) + 1 });
            return true;
        });
    } catch (e) {
        return true;
    }
}

module.exports = async function handler(req, res) {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { code, create } = req.body || {};
    if (!code || typeof code !== 'string' || !CODE_REGEX.test(code)) {
        return res.status(400).json({ error: 'Invalid login code' });
    }

    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    if (!(await allowAttempt(ip))) {
        return res.status(429).json({ error: 'Too many attempts. Please try again in a few minutes.' });
    }

    try {
        const userRef = adminDb.doc(`users/${code}`);
        const snap = await userRef.get();

        if (!snap.exists) {
            if (!create) return res.status(404).json({ error: 'Invalid login code' });
            await userRef.set({
                createdAt: FieldValue.serverTimestamp(),
                lastActive: FieldValue.serverTimestamp(),
                version: '2.0.0',
            });
        } else {
            await userRef.set({ lastActive: FieldValue.serverTimestamp() }, { merge: true });
        }

        const token = await getAuth().createCustomToken(code);
        return res.status(200).json({ token });
    } catch (err) {
        return res.status(500).json({ error: 'Could not sign in. Please try again.' });
    }
};
