/**
 * A handler that throws at module load is FUNCTION_INVOCATION_FAILED in prod —
 * no JSON body, no stack the client can act on. This catches that class of bug
 * (e.g. firebase-admin v14 dropping the namespaced `admin.apps` API).
 */

const fs = require('fs');
const path = require('path');

// This mock is load-bearing AND dangerous, so read before touching it.
//
// jest-expo's babel config cannot transform the jwks-rsa/jose chain, so without
// the mock every suite that touches a handler fails to run. But the mock also
// makes `firebase-admin/auth` look loadable when in production it is not: on
// Vercel, jwks-rsa@4 does a CJS require() of ESM-only jose@6, and Vercel's
// bytecode loader does not implement require(esm). Any handler importing it dies
// at load with ERR_REQUIRE_ESM → FUNCTION_INVOCATION_FAILED.
//
// That is not hypothetical: /api/auth-token has been returning 500 in production
// for weeks while this suite stayed green. The static check below is the guard
// the mock cannot be — it fails on the import itself, not on loading it.
jest.mock('firebase-admin/auth', () => ({ getAuth: () => ({}) }));

const API_DIR = path.join(__dirname, '..');
const handlers = fs.readdirSync(API_DIR)
    .filter(f => f.endsWith('.js') && !f.startsWith('_'));

describe('api handlers load without env', () => {
    beforeAll(() => {
        process.env.ENCRYPTION_SECRET = 'x'.repeat(32);
        delete process.env.FIREBASE_SERVICE_ACCOUNT;
        delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    });

    test.each(handlers)('%s exports a handler', (file) => {
        jest.isolateModules(() => {
            expect(typeof require(path.join(API_DIR, file))).toBe('function');
        });
    });
});

// `firebase-admin/auth` is unloadable on Vercel (see the mock above). Verifying an
// ID token needs only crypto and Google's public certs — api/_verify-id-token.js
// does exactly that. Minting a custom token is likewise an RS256 JWT signed with
// the service-account key.
//
// KNOWN_BROKEN is an exact set, not a floor: adding a handler that imports the
// module fails this test, and so does fixing auth-token — at which point delete
// the entry rather than widening it.
// Full write-up, root cause and the fix: docs/BUG-auth-token-esm.md
describe('no handler imports firebase-admin/auth', () => {
    const KNOWN_BROKEN = ['auth-token.js'];

    // Comments get stripped first — several files discuss this import by name.
    const stripComments = (src) => src.replace(/\/\*[^]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

    const importers = fs.readdirSync(API_DIR)
        .filter(f => f.endsWith('.js'))
        .filter(f => /require\(['"]firebase-admin\/auth['"]\)/.test(
            stripComments(fs.readFileSync(path.join(API_DIR, f), 'utf8'))));

    it('has exactly the handlers already known to be broken in production', () => {
        expect(importers.sort()).toEqual(KNOWN_BROKEN.sort());
    });
});
