/** @jest-environment node */

// api/_custom-token.js mints the Firebase custom token with crypto instead of
// firebase-admin/auth (which cannot load on Vercel). This proves the JWT it
// produces is exactly what Google's documented contract expects.

const crypto = require('crypto');

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const b64urlToBuffer = (part) => Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const decode = (jwt) => {
    const [h, c, s] = jwt.split('.');
    return { header: JSON.parse(b64urlToBuffer(h)), claims: JSON.parse(b64urlToBuffer(c)), signature: b64urlToBuffer(s), body: `${h}.${c}` };
};

beforeAll(() => {
    process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
        project_id: 'presence-test', client_email: 'svc@presence-test.iam.gserviceaccount.com', private_key: privateKey,
    });
});

test('mints an RS256 JWT that verifies against the service-account key with the documented claims', () => {
    const { createCustomToken, AUDIENCE, _resetServiceAccountCache } = require('../_custom-token');
    _resetServiceAccountCache();
    const now = 1_800_000_000;
    const { header, claims, signature, body } = decode(createCustomToken('PRES-ABCDEFG', now));

    expect(header).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(claims).toEqual({
        iss: 'svc@presence-test.iam.gserviceaccount.com',
        sub: 'svc@presence-test.iam.gserviceaccount.com',
        aud: AUDIENCE,
        iat: now,
        exp: now + 3600,
        uid: 'PRES-ABCDEFG',
    });
    expect(crypto.createVerify('RSA-SHA256').update(body).verify(publicKey, signature)).toBe(true);
});

test('refuses an empty or oversized uid', () => {
    const { createCustomToken } = require('../_custom-token');
    expect(() => createCustomToken('')).toThrow();
    expect(() => createCustomToken('x'.repeat(129))).toThrow();
    expect(() => createCustomToken(42)).toThrow();
});

test('fails loudly when the service account is not configured', () => {
    jest.isolateModules(() => {
        const saved = process.env.FIREBASE_SERVICE_ACCOUNT;
        delete process.env.FIREBASE_SERVICE_ACCOUNT;
        const { createCustomToken } = require('../_custom-token');
        expect(() => createCustomToken('PRES-ABCDEFG')).toThrow(/FIREBASE_SERVICE_ACCOUNT/);
        process.env.FIREBASE_SERVICE_ACCOUNT = saved;
    });
});
