import { friendlyError } from '../friendlyError';

// Anything that looks like plumbing. If one of these ever reaches the student,
// the setup screen is back to showing Vercel internals.
const INFRA_LEAK = /FUNCTION_INVOCATION|HTTP \d{3}|NON_JSON|vercel|<!DOCTYPE|request id/i;

const err = (message, extra = {}) => Object.assign(new Error(message), extra);

describe('friendlyError', () => {
    it('never surfaces infrastructure codes to the student', () => {
        const raw = [
            err('FUNCTION_INVOCATION_FAILED', { status: 500 }),
            err('HTTP 502', { status: 502 }),
            err('<!DOCTYPE html><html>...', { status: 500, code: 'NON_JSON_RESPONSE' }),
            err('Vercel Authentication required — request id: abc123', { status: 401 }),
        ];

        raw.forEach((e) => {
            const { title, message } = friendlyError(e, 'signin');
            expect(title).not.toMatch(INFRA_LEAK);
            expect(message).not.toMatch(INFRA_LEAK);
            expect(message.length).toBeGreaterThan(10);
        });
    });

    it('maps transport failures to their own copy', () => {
        expect(friendlyError(err('boom', { code: 'NETWORK_ERROR' })).title).toBe('No connection');
        expect(friendlyError(err('boom', { code: 'TIMEOUT' })).title).toBe('This is taking too long');
    });

    it('blames the right side for a rejected credential vs a server fault', () => {
        expect(friendlyError(err('Invalid credentials', { status: 401 }), 'signin').title)
            .toBe('Those details did not match');
        expect(friendlyError(err('boom', { status: 503 }), 'signin').title)
            .toBe('Your university portal is not responding');
    });

    it('varies the auth message by which step failed', () => {
        const bad = () => err('invalid', { status: 401 });
        expect(friendlyError(bad(), 'otp').title).toBe('That code did not work');
        expect(friendlyError(bad(), 'code').title).toBe('That login code did not work');
    });

    it('passes through a real server sentence but keeps machine codes as detail', () => {
        const sentence = friendlyError(err('Your account is locked for 24 hours.'), 'signin');
        expect(sentence.message).toBe('Your account is locked for 24 hours.');

        const machine = friendlyError(err('FUNCTION_INVOCATION_FAILED'), 'signin');
        expect(machine.message).not.toBe('FUNCTION_INVOCATION_FAILED');
        expect(machine.detail).toBe('FUNCTION_INVOCATION_FAILED');
    });

    it('survives a missing error', () => {
        expect(friendlyError(null).title).toBe('Something went wrong');
    });
});
