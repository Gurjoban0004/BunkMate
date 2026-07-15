/**
 * Admin authorization is anchored to the roll number sealed inside the encrypted
 * ERP session token — never a plaintext value from the client. These tests prove
 * the spoofing hole is closed: only a token minted server-side for the admin roll
 * authorizes admin actions.
 */

process.env.ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET
    || 'test-secret-that-is-at-least-32-chars-long';
process.env.ADMIN_ROLL_NUMBERS = '2410990296';

const { encryptSession, decodeSessionRollNumber } = require('../_session-utils');

// Mirror of _firebase-admin's isAdminRoll (a plain whitelist `includes`), inlined
// so this test doesn't pull in the Firebase Admin SDK init under jest-expo.
const ADMIN = process.env.ADMIN_ROLL_NUMBERS.split(',').map(r => r.trim());
const isAdminRoll = (r) => !!r && ADMIN.includes(String(r).trim());

const authorized = (token) => {
    const roll = decodeSessionRollNumber(token);
    return !!roll && isAdminRoll(roll);
};

describe('admin token authorization', () => {
    test('a token minted for the admin roll authorizes admin actions', () => {
        const token = encryptSession({ rollNumber: '2410990296', userId: 'u1' });
        expect(authorized(token)).toBe(true);
    });

    test('a token for any other roll is rejected', () => {
        const token = encryptSession({ rollNumber: '2410990297', userId: 'u2' });
        expect(authorized(token)).toBe(false);
    });

    test('a plaintext/forged roll number (no valid token) is rejected', () => {
        expect(authorized('2410990296')).toBe(false);        // raw roll, not a token
        expect(authorized(undefined)).toBe(false);
        expect(authorized('not:a:real:token')).toBe(false);
    });

    test('a tampered token ciphertext fails authentication', () => {
        const token = encryptSession({ rollNumber: '2410990296', userId: 'u1' });
        const tampered = token.slice(0, -2) + (token.endsWith('00') ? '11' : '00');
        expect(authorized(tampered)).toBe(false);
    });
});
