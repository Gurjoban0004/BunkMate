/**
 * Firebase custom-token minting, without firebase-admin/auth (audit H1).
 *
 * `require('firebase-admin/auth')` cannot load on Vercel: jwks-rsa@4 does a CJS
 * require() of ESM-only jose@6 and Vercel's bytecode loader does not implement
 * require(esm), so the function dies at load. A custom token is just an RS256
 * JWT signed with the service-account private key, so `crypto` is all it takes.
 * Mirror image of api/_verify-id-token.js. Full write-up: docs/BUG-auth-token-esm.md.
 */

const crypto = require('crypto');

const AUDIENCE = 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit';

function b64url(input) {
    return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

let cachedAccount = null;
function serviceAccount() {
    if (cachedAccount) return cachedAccount;
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
    const sa = JSON.parse(raw);
    if (!sa.client_email || !sa.private_key) throw new Error('service account is missing client_email/private_key');
    cachedAccount = { clientEmail: sa.client_email, privateKey: sa.private_key };
    return cachedAccount;
}

/**
 * @param {string} uid  1–128 chars; becomes request.auth.uid in Firestore rules
 * @param {number} [nowSeconds]  injectable clock for tests
 * @returns {string} signed JWT accepted by signInWithCustomToken()
 */
function createCustomToken(uid, nowSeconds = Math.floor(Date.now() / 1000)) {
    if (typeof uid !== 'string' || uid.length < 1 || uid.length > 128) throw new Error('invalid uid');
    const { clientEmail, privateKey } = serviceAccount();

    const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = b64url(JSON.stringify({
        iss: clientEmail,
        sub: clientEmail,
        aud: AUDIENCE,
        iat: nowSeconds,
        exp: nowSeconds + 3600,   // Google rejects anything longer than one hour
        uid,
    }));
    const body = `${header}.${claims}`;
    const signature = crypto.createSign('RSA-SHA256').update(body).sign(privateKey);
    return `${body}.${b64url(signature)}`;
}

module.exports = { createCustomToken, AUDIENCE, _resetServiceAccountCache: () => { cachedAccount = null; } };
