/**
 * A handler that throws at module load is FUNCTION_INVOCATION_FAILED in prod —
 * no JSON body, no stack the client can act on. This catches that class of bug
 * (e.g. firebase-admin v14 dropping the namespaced `admin.apps` API).
 */

const fs = require('fs');
const path = require('path');

// jwks-rsa (pulled in by firebase-admin/auth) ships syntax jest-expo's babel
// config won't transform. Node loads it fine; only the test runner trips.
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
