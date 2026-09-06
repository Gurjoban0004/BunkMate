/**
 * Admin authorization is anchored to the roll number sealed inside the encrypted
 * ERP session token — never a plaintext value from the client. These tests prove
 * the spoofing hole is closed: only a token minted server-side for the admin roll
 * authorizes admin actions.
 */

process.env.ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET
    || 'test-secret-that-is-at-least-32-chars-long';
process.env.ADMIN_ROLL_NUMBERS = '2410990296';

const {
    encryptSession,
    decodeSessionRollNumber,
    sealOtpTicket,
    openOtpTicket,
} = require('../_session-utils');

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

/**
 * The check above only proves a token's roll is authenticated — not that the roll
 * was the RIGHT one when the token was minted. erp-verify-otp used to seal
 * `rollNumber` from a client-supplied `username` field that nothing tied to the
 * OTP-verified account, so a student could complete their own OTP while claiming
 * the admin roll. The ticket is what binds the two.
 */
describe('OTP ticket binds authUserId to its username', () => {
    test('a sealed ticket round-trips the pair issued at login', () => {
        const bound = openOtpTicket(sealOtpTicket('auth-123', '2410990297', { password: 'pw', deviceId: 'DEV-1' }));
        expect(bound).toEqual({ authUserId: 'auth-123', username: '2410990297', password: 'pw', deviceId: 'DEV-1' });
    });

    test('the admin roll cannot be claimed by a caller (the escalation path)', () => {
        // Attacker completes a real OTP for their own account, then tries to pass
        // the admin roll alongside it. There is no ticket that says so, and a raw
        // roll number is not a ticket.
        expect(openOtpTicket('2410990296')).toBeNull();
        expect(openOtpTicket(undefined)).toBeNull();
        expect(openOtpTicket('not:a:real:ticket')).toBeNull();

        // ...and a ticket minted for their own roll never yields the admin's.
        const own = openOtpTicket(sealOtpTicket('auth-123', '2410990297'));
        expect(isAdminRoll(own.username)).toBe(false);
    });

    test('a tampered ticket is rejected rather than half-trusted', () => {
        const ticket = sealOtpTicket('auth-123', '2410990297');
        const tampered = ticket.slice(0, -2) + (ticket.endsWith('00') ? '11' : '00');
        expect(openOtpTicket(tampered)).toBeNull();
    });

    test('an expired ticket is rejected', () => {
        const ticket = sealOtpTicket('auth-123', '2410990297');
        const realNow = Date.now;
        Date.now = () => realNow() + 16 * 60 * 1000;   // past the 15-min max age
        try {
            expect(openOtpTicket(ticket)).toBeNull();
        } finally {
            Date.now = realNow;
        }
    });
});
