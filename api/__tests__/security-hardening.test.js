/** @jest-environment node */

/**
 * Pins the properties from docs/AUDIT-2026-09-06.md that this round closed:
 *   C1  device identity is per install (random), never derived from the roll number
 *   C2  an OTP ticket dies after five wrong guesses
 *   C3  /api/push-send fails closed without CRON_SECRET
 *   M3  session and persistent tokens expire (after a year — see reconnect-flow.test.js
 *       for why not sooner)
 *   CORS is same-origin unless ALLOWED_ORIGIN says otherwise
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

// ── In-memory Firestore stand-in for the limiter ───────────────────────
function fakeDb() {
    const docs = new Map();
    return {
        docs,
        doc: (path) => ({
            path,
            get: async () => ({ exists: docs.has(path), data: () => docs.get(path) }),
        }),
        runTransaction: async (fn) => fn({
            get: async (ref) => ({ exists: docs.has(ref.path), data: () => docs.get(ref.path) }),
            set: (ref, data) => { docs.set(ref.path, data); },
            update: (ref, patch) => { docs.set(ref.path, { ...docs.get(ref.path), ...patch }); },
        }),
    };
}

describe('_rate-limit', () => {
    beforeEach(() => jest.resetModules());

    test('allows `max` attempts in a window, then denies', async () => {
        jest.doMock('../_firebase-admin', () => ({ adminDb: fakeDb() }), { virtual: true });
        const { allowAttempt } = require('../_rate-limit');
        const policy = { max: 5, windowMs: 60000 };
        for (let i = 0; i < 5; i++) expect(await allowAttempt('otp', 'ticket-A', policy)).toBe(true);
        expect(await allowAttempt('otp', 'ticket-A', policy)).toBe(false);
        expect(await allowAttempt('otp', 'ticket-B', policy)).toBe(true);   // another key is unaffected
    });

    test('resets once the window has passed', async () => {
        jest.doMock('../_firebase-admin', () => ({ adminDb: fakeDb() }), { virtual: true });
        const { allowAttempt } = require('../_rate-limit');
        const policy = { max: 1, windowMs: 1000 };
        const realNow = Date.now;
        try {
            Date.now = () => 1_000_000;
            expect(await allowAttempt('s', 'k', policy)).toBe(true);
            expect(await allowAttempt('s', 'k', policy)).toBe(false);
            Date.now = () => 1_002_000;
            expect(await allowAttempt('s', 'k', policy)).toBe(true);
        } finally {
            Date.now = realNow;
        }
    });

    test('fails open when Firestore is unavailable', async () => {
        jest.doMock('../_firebase-admin', () => ({
            adminDb: { doc: () => ({}), runTransaction: async () => { throw new Error('UNAVAILABLE'); } },
        }), { virtual: true });
        jest.spyOn(console, 'error').mockImplementation(() => {});
        const { allowAttempt } = require('../_rate-limit');
        expect(await allowAttempt('s', 'k', { max: 1, windowMs: 1000 })).toBe(true);
        console.error.mockRestore();
    });

    test('tooManyAttempts answers 429 with Retry-After', async () => {
        jest.doMock('../_firebase-admin', () => ({ adminDb: fakeDb() }), { virtual: true });
        const { tooManyAttempts } = require('../_rate-limit');
        const policy = { max: 1, windowMs: 60000 };
        const res = makeRes();
        expect(await tooManyAttempts(res, 's', 'k', policy)).toBe(false);
        expect(await tooManyAttempts(res, 's', 'k', policy)).toBe(true);
        expect(res.statusCode).toBe(429);
        expect(res.headers['Retry-After']).toBe('60');
    });
});

describe('C1 — device identity', () => {
    const { resolveDeviceId } = require('../_session-utils');

    test('a well-formed client UUID is kept (uppercased); anything else gets a fresh random one', () => {
        expect(resolveDeviceId('3f2a9c14-8b7d-4e6a-9c21-7d5e0f1a2b3c')).toBe('3F2A9C14-8B7D-4E6A-9C21-7D5E0F1A2B3C');
        const a = resolveDeviceId('not-a-uuid');
        const b = resolveDeviceId(undefined);
        expect(a).toMatch(/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/);
        expect(a).not.toBe(b);
    });

    test('the device id is no longer derivable from the username', () => {
        const utils = require('../_session-utils');
        expect(utils.generateDeviceUUID).toBeUndefined();
        const crypto = require('crypto');
        const md5 = crypto.createHash('md5').update('presence-device-2410990001').digest('hex').toUpperCase();
        const seen = new Set();
        for (let i = 0; i < 5; i++) seen.add(resolveDeviceId());
        expect(seen.size).toBe(5);
        for (const id of seen) expect(id.replace(/-/g, '')).not.toBe(md5);
    });

    test('reloginERP presents exactly the device id it was given', async () => {
        let sentBody = '';
        global.fetch = jest.fn(async (_url, opts) => {
            sentBody = String(opts.body);
            return jsonResponse({ status: '4', authUserId: '24635', data: [{ userId: '24635', roleId: '4' }] });
        });
        const { reloginERP } = require('../_session-utils');
        const result = await reloginERP('2410990001', 'pw', null, '3F2A9C14-8B7D-4E6A-9C21-7D5E0F1A2B3C');
        expect(sentBody).toContain('deviceIdUUID=3F2A9C14-8B7D-4E6A-9C21-7D5E0F1A2B3C');
        expect(result).toEqual({ needsOtp: true, authUserId: '24635', deviceId: '3F2A9C14-8B7D-4E6A-9C21-7D5E0F1A2B3C' });
    });
});

describe('C2 — OTP brute force', () => {
    beforeEach(() => jest.resetModules());

    test('the fifth wrong OTP is the last one the ticket accepts', async () => {
        jest.doMock('../_firebase-admin', () => ({ adminDb: fakeDb(), isAdminRoll: () => false }), { virtual: true });
        jest.doMock('../_revocation', () => ({ blockIfRevoked: async () => false }));
        global.fetch = jest.fn(async () => jsonResponse({ status: '0', message: 'Invalid OTP' }));

        const { sealOtpTicket } = require('../_session-utils');
        const handler = require('../erp-verify-otp');
        const ticket = sealOtpTicket('24635', '2410990001', { password: 'pw', deviceId: 'DEV' });

        for (let i = 0; i < 5; i++) {
            const res = makeRes();
            await handler(makeReq({ authUserId: ticket, otp: '0000' }), res);
            expect(res.statusCode).toBe(401);            // wrong, but still counted against the ERP
        }
        const res = makeRes();
        await handler(makeReq({ authUserId: ticket, otp: '0000' }), res);
        expect(res.statusCode).toBe(429);
        expect(global.fetch).toHaveBeenCalledTimes(5);   // the sixth guess never reaches the ERP
    });

    test('a malformed OTP is rejected before anything is counted or sent', async () => {
        jest.doMock('../_firebase-admin', () => ({ adminDb: fakeDb(), isAdminRoll: () => false }), { virtual: true });
        global.fetch = jest.fn();
        const { sealOtpTicket } = require('../_session-utils');
        const handler = require('../erp-verify-otp');
        const res = makeRes();
        await handler(makeReq({ authUserId: sealOtpTicket('1', 'u', {}), otp: 'abcd' }), res);
        expect(res.statusCode).toBe(400);
        expect(global.fetch).not.toHaveBeenCalled();
    });
});

describe('login → OTP → session, end to end', () => {
    beforeEach(() => jest.resetModules());

    test('the ticket carries the device id and password; verify seals both into the tokens', async () => {
        jest.doMock('../_firebase-admin', () => ({ adminDb: fakeDb(), isAdminRoll: (r) => r === '2410990296' }), { virtual: true });
        jest.doMock('../_revocation', () => ({ blockIfRevoked: async () => false }));

        const bodies = [];
        global.fetch = jest.fn(async (url, opts) => {
            bodies.push(String(opts.body));
            if (String(url).includes('appLoginAuthV2')) {
                return jsonResponse({ status: '4', authUserId: '24635', data: [{ userId: '24635', roleId: '4' }] });
            }
            return jsonResponse({ status: '1', token: 'sec', data: [{ userId: '24635', sessionId: '19', roleId: '4', apiKey: 'K', studentId: '9508', name: 'S' }] });
        });

        const login = require('../erp-login');
        const verify = require('../erp-verify-otp');
        const { decryptSession, decryptPersistent, openOtpTicket } = require('../_session-utils');

        const clientDevice = '3F2A9C14-8B7D-4E6A-9C21-7D5E0F1A2B3C';
        const r1 = makeRes();
        await login(makeReq({ username: ' 2410990001 ', password: 'pw', deviceId: clientDevice }, { 'x-forwarded-for': '1.1.1.1' }), r1);
        expect(r1.body.needsOtp).toBe(true);
        expect(openOtpTicket(r1.body.authUserId)).toEqual({ authUserId: '24635', username: '2410990001', password: 'pw', deviceId: clientDevice });

        const r2 = makeRes();
        await verify(makeReq({ authUserId: r1.body.authUserId, otp: '1234' }), r2);
        expect(r2.statusCode).toBe(200);
        expect(r2.body.isAdmin).toBe(false);
        expect(bodies[1]).toContain(`deviceIdUUID=${clientDevice}`);          // verify used the SAME device
        expect(decryptSession(r2.body.token)).toEqual(expect.objectContaining({ rollNumber: '2410990001', deviceIdUUID: clientDevice }));
        expect(decryptPersistent(r2.body.persistentToken)).toEqual(expect.objectContaining({ username: '2410990001', password: 'pw', deviceId: clientDevice }));
    });

    test('login refuses oversized or non-string credentials without touching the ERP', async () => {
        jest.doMock('../_firebase-admin', () => ({ adminDb: fakeDb(), isAdminRoll: () => false }), { virtual: true });
        global.fetch = jest.fn();
        const login = require('../erp-login');
        for (const body of [{ username: 'x'.repeat(65), password: 'pw' }, { username: { $ne: '' }, password: 'pw' }, { username: 'u', password: 'p'.repeat(129) }]) {
            const res = makeRes();
            await login(makeReq(body), res);
            expect(res.statusCode).toBe(400);
        }
        expect(global.fetch).not.toHaveBeenCalled();
    });
});

describe('M3 — token expiry', () => {
    const {
        encryptSession, decodeSessionRollNumber, isSessionStale,
        encryptPersistent, decryptPersistent, decryptSession,
    } = require('../_session-utils');
    const DAY = 86400000;
    const realNow = Date.now;
    afterEach(() => { Date.now = realNow; });

    test('a session token stops authorizing admin actions after a year', () => {
        const token = encryptSession({ rollNumber: '2410990296' });
        expect(decodeSessionRollNumber(token)).toBe('2410990296');
        Date.now = () => realNow() + 366 * DAY;
        expect(decodeSessionRollNumber(token)).toBeNull();
        expect(isSessionStale(decryptSession(token))).toBe(true);
    });

    test('a session minted before expiry existed (no iat) counts as stale', () => {
        expect(isSessionStale({ rollNumber: 'x' })).toBe(true);
    });

    test('a persistent token dies after a year with a distinguishable code', () => {
        const token = encryptPersistent({ username: 'u', password: 'p' });
        expect(decryptPersistent(token).username).toBe('u');
        Date.now = () => realNow() + 366 * DAY;
        expect(() => decryptPersistent(token)).toThrow(expect.objectContaining({ code: 'PERSISTENT_EXPIRED' }));
    });
});

describe('C3 — push-send fails closed', () => {
    beforeEach(() => jest.resetModules());
    const originalSecret = process.env.CRON_SECRET;
    afterEach(() => { if (originalSecret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = originalSecret; });

    const load = () => {
        jest.doMock('web-push', () => ({ setVapidDetails: jest.fn(), sendNotification: jest.fn(async () => {}) }), { virtual: true });
        jest.doMock('../_firebase-admin', () => ({
            adminDb: { collectionGroup: () => ({ where: () => ({ limit: () => ({ get: async () => ({ forEach: () => {} }) }) }) }) },
        }), { virtual: true });
        return require('../push-send');
    };

    test('no CRON_SECRET → 401 even with no header at all', async () => {
        delete process.env.CRON_SECRET;
        const res = makeRes();
        await load()({ method: 'GET', headers: {} }, res);
        expect(res.statusCode).toBe(401);
    });

    test('wrong bearer → 401; right bearer → runs', async () => {
        process.env.CRON_SECRET = 'top-secret';
        process.env.VAPID_PUBLIC_KEY = 'pub'; process.env.VAPID_PRIVATE_KEY = 'priv'; process.env.VAPID_SUBJECT = 'mailto:a@b.c';
        const handler = load();
        const bad = makeRes();
        await handler({ method: 'GET', headers: { authorization: 'Bearer nope' } }, bad);
        expect(bad.statusCode).toBe(401);
        const good = makeRes();
        await handler({ method: 'GET', headers: { authorization: 'Bearer top-secret' } }, good);
        expect(good.statusCode).toBe(200);
        expect(good.body).toEqual({ ok: true, sent: 0, pruned: 0, failed: 0 });
    });
});

describe('CORS', () => {
    const { setCorsHeaders } = require('../_session-utils');
    const original = process.env.ALLOWED_ORIGIN;
    afterEach(() => { if (original === undefined) delete process.env.ALLOWED_ORIGIN; else process.env.ALLOWED_ORIGIN = original; });

    const run = (origin) => {
        const res = makeRes();
        setCorsHeaders(res, { headers: origin ? { origin } : {} });
        return res.headers['Access-Control-Allow-Origin'];
    };

    test('same-origin / native (no Origin header) needs nothing and gets nothing', () => {
        process.env.ALLOWED_ORIGIN = '';
        expect(run(undefined)).toBeUndefined();
    });
    test('an unlisted browser origin is not allowed', () => {
        process.env.ALLOWED_ORIGIN = 'https://presence-blue.vercel.app';
        expect(run('https://evil.example')).toBeUndefined();
    });
    test('a listed origin is echoed back (never "*")', () => {
        process.env.ALLOWED_ORIGIN = 'https://a.example, https://presence-blue.vercel.app';
        expect(run('https://presence-blue.vercel.app')).toBe('https://presence-blue.vercel.app');
    });
    test('"*" is honoured for local development', () => {
        process.env.ALLOWED_ORIGIN = '*';
        expect(run('http://localhost:8081')).toBe('http://localhost:8081');
    });
});
