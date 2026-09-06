/**
 * The ID-token verifier that replaced firebase-admin/auth (which cannot load on
 * Vercel — jwks-rsa@4 does a CJS require of ESM-only jose@6, and Vercel's bytecode
 * loader does not support require(esm), so the function dies before any handler runs).
 *
 * A verifier that accepts a token it should not is a full account takeover on
 * /api/push-subscribe, so every rejection path is covered, not just the happy one.
 */

process.env.ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || 'x'.repeat(32);
process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'presence-test';
delete process.env.FIREBASE_SERVICE_ACCOUNT;

const crypto = require('crypto');
const { verifyIdToken, _resetCertCache } = require('../_verify-id-token');

const PROJECT = 'presence-test';
const KID = 'test-kid';

// A throwaway RSA keypair plus a self-signed cert, standing in for Google's.
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const wrong = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

function sign(claims, { alg = 'RS256', kid = KID, key = privateKey } = {}) {
    const body = `${b64({ alg, kid })}.${b64(claims)}`;
    const sig = crypto.createSign('RSA-SHA256').update(body).sign(key).toString('base64url');
    return `${body}.${sig}`;
}

const now = () => Math.floor(Date.now() / 1000);
const goodClaims = (over = {}) => ({
    aud: PROJECT,
    iss: `https://securetoken.google.com/${PROJECT}`,
    sub: 'PRES-ABCDEFG',
    iat: now() - 60,
    exp: now() + 3600,
    ...over,
});

// The verifier reads certs over fetch; serve our own public key as that cert.
const pem = publicKey.export({ type: 'spki', format: 'pem' });
beforeEach(() => {
    _resetCertCache();
    global.fetch = jest.fn(async () => ({
        ok: true,
        json: async () => ({ [KID]: pem }),
        headers: { get: () => 'public, max-age=3600' },
    }));
});

describe('verifyIdToken', () => {
    it('accepts a correctly signed, current token and returns its uid', async () => {
        await expect(verifyIdToken(sign(goodClaims()))).resolves.toEqual({ uid: 'PRES-ABCDEFG' });
    });

    it('caches the certs instead of refetching per call', async () => {
        await verifyIdToken(sign(goodClaims()));
        await verifyIdToken(sign(goodClaims()));
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it.each([
        ['a token signed by the wrong key', () => sign(goodClaims(), { key: wrong.privateKey })],
        ['an expired token',                () => sign(goodClaims({ exp: now() - 120 }))],
        ['a token issued in the future',    () => sign(goodClaims({ iat: now() + 600 }))],
        ['another project\'s audience',     () => sign(goodClaims({ aud: 'someone-else' }))],
        ['a spoofed issuer',                () => sign(goodClaims({ iss: 'https://evil.example/' }))],
        ['no subject',                      () => sign(goodClaims({ sub: '' }))],
        ['alg none',                        () => sign(goodClaims(), { alg: 'none' })],
        ['an unknown key id',               () => sign(goodClaims(), { kid: 'not-a-real-kid' })],
        ['a garbage string',                () => 'not.a.jwt'],
        ['an empty token',                  () => ''],
    ])('rejects %s', async (_label, make) => {
        await expect(verifyIdToken(make())).rejects.toThrow();
    });

    it('rejects everything when no project id is configured', async () => {
        const saved = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
        delete process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
        await expect(verifyIdToken(sign(goodClaims()))).rejects.toThrow(/project id/);
        process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = saved;
    });
});
