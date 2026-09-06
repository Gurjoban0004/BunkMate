/**
 * Firebase ID token verification, without firebase-admin/auth.
 *
 * WHY THIS EXISTS: `require('firebase-admin/auth')` cannot load on Vercel. It pulls
 * jwks-rsa@4, which does a CJS `require()` of jose@6 — and jose@6 is ESM-only. Node
 * 22.12+ allows require(esm), and the project runs Node 24, but Vercel's bytecode
 * loader (/opt/rust/nodejs.js) intercepts module loading and does not implement it,
 * so the function dies at load with ERR_REQUIRE_ESM and returns
 * FUNCTION_INVOCATION_FAILED before any handler code runs.
 *
 * An ID token is just an RS256 JWT signed by Google, so verifying it needs nothing
 * but `crypto` and the public certs. That removes the unloadable module entirely
 * rather than working around it.
 *
 * Checks performed (per Firebase's documented ID-token contract):
 *   alg RS256 · signature against Google's current certs · iss · aud · exp · iat · sub
 */

const crypto = require('crypto');

const CERT_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let certCache = { certs: null, expiresAt: 0 };

function projectId() {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (raw) {
        try {
            const id = JSON.parse(raw).project_id;
            if (id) return id;
        } catch { /* fall through to the public env var */ }
    }
    return process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '';
}

/** Google's signing certs, cached until the response says they go stale. */
async function fetchCerts() {
    if (certCache.certs && Date.now() < certCache.expiresAt) return certCache.certs;

    const res = await fetch(CERT_URL);
    if (!res.ok) throw new Error(`cert fetch failed: ${res.status}`);
    const certs = await res.json();

    // Google sends max-age; fall back to an hour if the header is missing or odd.
    const maxAge = Number((res.headers.get('cache-control') || '').match(/max-age=(\d+)/)?.[1]);
    certCache = {
        certs,
        expiresAt: Date.now() + (Number.isFinite(maxAge) && maxAge > 0 ? maxAge : 3600) * 1000,
    };
    return certs;
}

function b64urlToBuffer(part) {
    return Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/**
 * @param {string} idToken
 * @returns {Promise<{ uid: string }>} resolves only for a token that passes every check
 * @throws on any malformed, expired, mis-issued or badly signed token
 */
async function verifyIdToken(idToken) {
    const parts = String(idToken || '').split('.');
    if (parts.length !== 3) throw new Error('malformed token');

    const header = JSON.parse(b64urlToBuffer(parts[0]).toString('utf8'));
    const claims = JSON.parse(b64urlToBuffer(parts[1]).toString('utf8'));

    if (header.alg !== 'RS256') throw new Error('unexpected alg');
    if (!header.kid) throw new Error('no kid');

    const project = projectId();
    if (!project) throw new Error('project id not configured');
    if (claims.aud !== project) throw new Error('wrong audience');
    if (claims.iss !== `https://securetoken.google.com/${project}`) throw new Error('wrong issuer');
    if (!claims.sub || typeof claims.sub !== 'string') throw new Error('no subject');

    const now = Math.floor(Date.now() / 1000);
    // 60s of slack for clock skew between Google, Vercel and the device.
    if (!(claims.exp > now - 60)) throw new Error('expired');
    if (!(claims.iat < now + 60)) throw new Error('issued in the future');

    const cert = (await fetchCerts())[header.kid];
    if (!cert) throw new Error('unknown key id');

    const ok = crypto.createVerify('RSA-SHA256')
        .update(`${parts[0]}.${parts[1]}`)
        .verify(crypto.createPublicKey(cert), b64urlToBuffer(parts[2]));
    if (!ok) throw new Error('bad signature');

    return { uid: claims.sub };
}

module.exports = { verifyIdToken, _resetCertCache: () => { certCache = { certs: null, expiresAt: 0 }; } };
