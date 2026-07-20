/** @jest-environment node */

// checkSessionAlive is the ERP's own liveness probe (/mobilev2/checkUserStatusMobileApp).
// It gates re-login: callers only OTP when it returns exactly false. So it MUST NOT return
// false on a live "1" or on an ambiguous/errored response — that would email spurious OTPs.

process.env.ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || '0123456789abcdef0123456789abcdef';
process.env.ERP_BASE_URL = process.env.ERP_BASE_URL || 'https://cuiet.codebrigade.in';

const { checkSessionAlive } = require('../_session-utils');

const session = { userId: '24635', roleId: '4', securityToken: 'tok', deviceIdUUID: 'DEV' };
const textResponse = (body) => ({ ok: true, text: async () => body });

afterEach(() => { global.fetch = undefined; });

test('live session ("1", with ERP whitespace padding) → true', async () => {
    global.fetch = jest.fn(async () => textResponse('\t\r\n        1\n'));
    expect(await checkSessionAlive(session)).toBe(true);
});

test('genuinely dead session (JSON session message) → false', async () => {
    global.fetch = jest.fn(async () => textResponse('{"message":"Your session has expired"}'));
    expect(await checkSessionAlive(session)).toBe(false);
});

test('ambiguous body → null (never forces OTP)', async () => {
    global.fetch = jest.fn(async () => textResponse('{"status":"0","feedVersion":"3"}'));
    expect(await checkSessionAlive(session)).toBeNull();
});

test('network error → null (never forces OTP)', async () => {
    global.fetch = jest.fn(async () => { throw new Error('ECONNRESET'); });
    expect(await checkSessionAlive(session)).toBeNull();
});
