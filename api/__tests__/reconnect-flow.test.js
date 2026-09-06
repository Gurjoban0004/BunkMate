/** @jest-environment node */

/**
 * "Sign in once, never again" — the server side of it.
 *
 * On this college's ERP every login sends an OTP, so the rule is simple: the
 * server never logs in on its own. A dead session becomes a card in the app;
 * the code is only sent when the student taps it (erp-session requestOtp).
 */

process.env.ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || '0123456789abcdef0123456789abcdef';
process.env.ERP_BASE_URL = process.env.ERP_BASE_URL || 'https://cuiet.codebrigade.in';

const makeReq = (body, headers = {}) => ({ method: 'POST', body, headers });
const makeRes = () => {
    const res = {
        statusCode: 200, headers: {}, body: undefined,
        setHeader: jest.fn((k, v) => { res.headers[k] = v; }),
        status: jest.fn((c) => { res.statusCode = c; return res; }),
        json: jest.fn((b) => { res.body = b; return res; }),
        end: jest.fn(() => res),
    };
    return res;
};
const jsonResponse = (payload) => ({ ok: true, status: 200, text: async () => JSON.stringify(payload) });
const textResponse = (text) => ({ ok: true, status: 200, text: async () => text });
const loginCalls = () => global.fetch.mock.calls.filter(([url]) => String(url).includes('appLoginAuthV2')).length;
const probeCalls = () => global.fetch.mock.calls.filter(([url]) => String(url).includes('checkUserStatusMobileApp')).length;

const DEVICE = '3F2A9C14-8B7D-4E6A-9C21-7D5E0F1A2B3C';
const liveSession = () => ({ rollNumber: '2410990001', userId: '24635', sessionId: '19', roleId: '4', apiKey: 'K', studentId: '9508', iat: Date.now() });

beforeEach(() => {
    jest.resetModules();
    jest.doMock('../_revocation', () => ({ blockIfRevoked: async () => false, getRevocation: async () => null }));
    jest.doMock('../_rate-limit', () => ({ tooManyAttempts: async () => false }));
});
afterEach(() => { global.fetch = undefined; });

describe('_data-session never emails', () => {
    test('a dead session (probe says dead twice) → needsOtp card, zero login calls', async () => {
        global.fetch = jest.fn(async (url) => {
            if (String(url).includes('checkUserStatusMobileApp')) return textResponse('{"message":"Your session has expired"}');
            return jsonResponse({ status: '0', message: 'Session invalid, please login again' });
        });
        const { encryptPersistent } = require('../_session-utils');
        const { fetchWithLiveSession } = require('../_data-session');
        const res = makeRes();
        const out = await fetchWithLiveSession(res, liveSession(), encryptPersistent({ username: '2410990001', password: 'pw', deviceId: DEVICE }),
            async () => ({ dead: true }), (r) => r.dead);
        expect(out).toBeNull();
        expect(res.body).toEqual({ sessionExpired: true, needsOtp: true, reason: 'dead' });
        expect(res.body.authUserId).toBeUndefined();
        expect(loginCalls()).toBe(0);
        expect(probeCalls()).toBe(2);
    }, 10000);

    test('a session that looked dead but is alive is transient — nothing sent, data kept', async () => {
        global.fetch = jest.fn(async (url) => {
            if (String(url).includes('checkUserStatusMobileApp')) return textResponse(' 1 ');
            return jsonResponse({});
        });
        const { fetchWithLiveSession } = require('../_data-session');
        const out = await fetchWithLiveSession(makeRes(), liveSession(), 'anything', async () => ({ dead: true }), (r) => r.dead);
        expect(out).toEqual({ transient: true });
        expect(loginCalls()).toBe(0);
    });

    test('an HTML outage page is NOT a dead session', async () => {
        global.fetch = jest.fn(async (url) => {
            if (String(url).includes('checkUserStatusMobileApp')) return textResponse('<html><body><form>login</form> session expired</body></html>');
            return jsonResponse({});
        });
        const { fetchWithLiveSession } = require('../_data-session');
        const out = await fetchWithLiveSession(makeRes(), liveSession(), 'anything', async () => ({ dead: true }), (r) => r.dead);
        expect(out).toEqual({ transient: true });
    });

    test('a probe that flips (dead, then alive) is transient', async () => {
        let n = 0;
        global.fetch = jest.fn(async (url) => {
            if (String(url).includes('checkUserStatusMobileApp')) return textResponse(n++ === 0 ? '{"message":"session expired"}' : '1');
            return jsonResponse({});
        });
        const { fetchWithLiveSession } = require('../_data-session');
        const out = await fetchWithLiveSession(makeRes(), liveSession(), 'anything', async () => ({ dead: true }), (r) => r.dead);
        expect(out).toEqual({ transient: true });
    }, 10000);

    test('a token this server cannot open + a valid saved sign-in → needsOtp, not a 401', async () => {
        const { encryptPersistent } = require('../_session-utils');
        const { openSession } = require('../_data-session');
        const res = makeRes();
        const out = await openSession(makeReq({ token: 'garbage:garbage:garbage', persistentToken: encryptPersistent({ username: 'u', password: 'p' }) }), res);
        expect(out).toBeNull();
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ sessionExpired: true, needsOtp: true, reason: 'invalid_token' });
    });

    test('an unusable token with no saved sign-in → 401 sessionExpired', async () => {
        const { openSession } = require('../_data-session');
        const res = makeRes();
        await openSession(makeReq({ token: 'garbage:garbage:garbage' }), res);
        expect(res.statusCode).toBe(401);
        expect(res.body.sessionExpired).toBe(true);
    });

    test('a saved sign-in older than a year → needsLogin', async () => {
        const { encryptPersistent } = require('../_session-utils');
        const { fetchWithLiveSession } = require('../_data-session');
        const realNow = Date.now;
        const persistentToken = encryptPersistent({ username: 'u', password: 'p' });
        Date.now = () => realNow() + 400 * 86400000;
        try {
            const res = makeRes();
            const out = await fetchWithLiveSession(res, { userId: 'x' }, persistentToken, async () => ({}), () => false);
            expect(out).toBeNull();
            expect(res.body).toEqual({ sessionExpired: true, needsLogin: true });
        } finally {
            Date.now = realNow;
        }
    });

    test('a session token older than a year is not used', async () => {
        const { encryptPersistent } = require('../_session-utils');
        const { fetchWithLiveSession } = require('../_data-session');
        const fetchData = jest.fn(async () => ({}));
        const res = makeRes();
        await fetchWithLiveSession(res, { ...liveSession(), iat: Date.now() - 400 * 86400000 }, encryptPersistent({ username: 'u', password: 'p' }), fetchData, () => false);
        expect(fetchData).not.toHaveBeenCalled();
        expect(res.body).toEqual({ sessionExpired: true, needsOtp: true, reason: 'stale' });
    });
});

describe('erp-session requestOtp — the one tap that sends a code', () => {
    test('a trusted device gets fresh tokens back and no OTP step', async () => {
        global.fetch = jest.fn(async () => jsonResponse({
            status: '1', token: 'sec',
            data: [{ userId: '24635', sessionId: '19', roleId: '4', apiKey: 'FRESH', studentId: '9508', name: 'Student' }],
        }));
        const { encryptPersistent, decryptSession, decryptPersistent } = require('../_session-utils');
        const handler = require('../erp-session');
        const res = makeRes();
        await handler(makeReq({ action: 'requestOtp', persistentToken: encryptPersistent({ username: '2410990001', password: 'pw', deviceId: DEVICE }) }), res);
        expect(res.statusCode).toBe(200);
        expect(res.body.trusted).toBe(true);
        expect(decryptSession(res.body.token)).toMatchObject({ apiKey: 'FRESH', rollNumber: '2410990001', deviceIdUUID: DEVICE });
        expect(decryptPersistent(res.body.persistentToken)).toMatchObject({ username: '2410990001', password: 'pw', deviceId: DEVICE });
        expect(loginCalls()).toBe(1);
    });

    test('status 4 → a sealed ticket bound to the saved sign-in and device', async () => {
        global.fetch = jest.fn(async () => jsonResponse({ status: '4', authUserId: '24635', data: [{ userId: '24635', roleId: '4' }] }));
        const { encryptPersistent, openOtpTicket } = require('../_session-utils');
        const handler = require('../erp-session');
        const res = makeRes();
        await handler(makeReq({ action: 'requestOtp', persistentToken: encryptPersistent({ username: '2410990001', password: 'pw', deviceId: DEVICE }) }), res);
        expect(res.body.needsOtp).toBe(true);
        expect(openOtpTicket(res.body.authUserId)).toEqual({ authUserId: '24635', username: '2410990001', password: 'pw', deviceId: DEVICE });
    });

    test('a changed password → needsLogin so the app forgets the saved sign-in', async () => {
        global.fetch = jest.fn(async () => jsonResponse({ status: '0', error: '1', message: 'Invalid username or password' }));
        const { encryptPersistent } = require('../_session-utils');
        const handler = require('../erp-session');
        const res = makeRes();
        await handler(makeReq({ action: 'requestOtp', persistentToken: encryptPersistent({ username: 'u', password: 'old' }) }), res);
        expect(res.statusCode).toBe(401);
        expect(res.body.needsLogin).toBe(true);
    });

    test('is rate limited per student', async () => {
        jest.doMock('../_rate-limit', () => ({
            tooManyAttempts: async (res, scope) => {
                if (scope === 'otp-request-user') { res.status(429).json({ error: 'Too many' }); return true; }
                return false;
            },
        }));
        global.fetch = jest.fn();
        const { encryptPersistent } = require('../_session-utils');
        const handler = require('../erp-session');
        const res = makeRes();
        await handler(makeReq({ action: 'requestOtp', persistentToken: encryptPersistent({ username: 'u', password: 'p' }) }), res);
        expect(res.statusCode).toBe(429);
        expect(global.fetch).not.toHaveBeenCalled();
    });
});

describe('erp-attendance on a dead session', () => {
    test('answers needsOtp and never touches the login endpoint', async () => {
        global.fetch = jest.fn(async (url) => {
            if (String(url).includes('checkUserStatusMobileApp')) return textResponse('{"message":"Your session has expired"}');
            return jsonResponse({ status: '0', message: 'Session invalid, please login again' });
        });
        const { encryptSession, encryptPersistent } = require('../_session-utils');
        const handler = require('../erp-attendance');
        const res = makeRes();
        await handler(makeReq({
            token: encryptSession(liveSession()),
            persistentToken: encryptPersistent({ username: '2410990001', password: 'pw', deviceId: DEVICE }),
        }), res);
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ sessionExpired: true, needsOtp: true, reason: 'dead' });
        expect(loginCalls()).toBe(0);
    }, 10000);
});
