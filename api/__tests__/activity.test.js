/**
 * The activity ledger is what makes the admin panel non-empty, and it runs
 * inside the login path — so the two things that matter are: it records what
 * actually happened, and it can never break a sign-in or a sync.
 */

process.env.ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || 'x'.repeat(48);

const writes = { sets: [], adds: [] };

const docStub = (path) => ({
    path,
    get: async () => ({ exists: writes.sets.some((s) => s.path === path) }),
    set: async (data, opts) => { writes.sets.push({ path, data, opts }); },
});

const adminDb = {
    doc: (path) => docStub(path),
    collection: (path) => ({ add: async (data) => { writes.adds.push({ path, data }); return { id: 'evt1' }; } }),
};

// See adminAnalytics.test.js: these mocks must not be virtual.
jest.mock('../_firebase-admin', () => ({ adminDb, isAdminRoll: () => false }));
jest.mock('firebase-admin/firestore', () => ({
    FieldValue: {
        serverTimestamp: () => '@ts',
        increment: (n) => ({ __inc: n }),
        arrayUnion: (v) => ({ __union: v }),
    },
}));

const { recordLogin, touchActive, clientMeta, safeRoll, hashIp } = require('../_activity');

beforeEach(() => { writes.sets.length = 0; writes.adds.length = 0; });

describe('recordLogin', () => {
    test('a trusted sign-in writes one event and advances the roster', async () => {
        await recordLogin({ rollNumber: '2410990296', outcome: 'trusted', studentName: 'A Student', deviceId: 'D1' });

        expect(writes.adds).toHaveLength(1);
        expect(writes.adds[0].path).toBe('admin/activity/logins');
        expect(writes.adds[0].data).toMatchObject({ rollNumber: '2410990296', outcome: 'trusted', method: 'password' });

        const roster = writes.sets.find((s) => s.path.includes('/students/'));
        expect(roster.path).toBe('admin/activity/students/2410990296');
        expect(roster.data.loginCount).toEqual({ __inc: 1 });
        expect(roster.data.studentName).toBe('A Student');
        expect(roster.data.createdAt).toBe('@ts');   // first sight
    });

    test('a rejected attempt is recorded but is not counted as a sign-in', async () => {
        await recordLogin({ rollNumber: '2410990296', outcome: 'rejected' });
        const roster = writes.sets.find((s) => s.path.includes('/students/'));
        expect(roster.data.loginAttempts).toEqual({ __inc: 1 });
        expect(roster.data.loginCount).toBeUndefined();
        expect(writes.adds[0].data.outcome).toBe('rejected');
    });

    test('createdAt means FIRST seen — a later login must not reset it', async () => {
        await recordLogin({ rollNumber: '2410990296', outcome: 'trusted' });
        await recordLogin({ rollNumber: '2410990296', outcome: 'trusted' });
        const rosterWrites = writes.sets.filter((s) => s.path.includes('/students/'));
        expect(rosterWrites[0].data.createdAt).toBe('@ts');
        expect(rosterWrites[1].data.createdAt).toBeUndefined();
    });

    test('never stores a raw IP — only a truncated keyed hash', async () => {
        await recordLogin({ rollNumber: '2410990296', outcome: 'trusted', ip: '203.0.113.9' });
        const body = JSON.stringify(writes.adds[0].data);
        expect(body).not.toContain('203.0.113.9');
        expect(writes.adds[0].data.ipHash).toHaveLength(12);
    });

    test('a roll number that is not a safe path segment is dropped, not written', async () => {
        await recordLogin({ rollNumber: 'a/../../admin', outcome: 'trusted' });
        expect(writes.adds).toHaveLength(0);
        expect(writes.sets).toHaveLength(0);
    });

    test('a Firestore failure never propagates into the login handler', async () => {
        const boom = { doc: () => { throw new Error('no credentials'); }, collection: adminDb.collection };
        jest.resetModules();
        jest.doMock('../_firebase-admin', () => ({ adminDb: boom, isAdminRoll: () => false }));
        const { recordLogin: rl } = require('../_activity');
        await expect(rl({ rollNumber: '2410990296', outcome: 'trusted' })).resolves.toBeUndefined();
        jest.resetModules();
    });
});

describe('touchActive', () => {
    test('stamps a student as seen', () => {
        touchActive('2410990296', { platform: 'android', appVersion: '2.1.0' });
        const row = writes.sets.find((s) => s.path === 'admin/activity/students/2410990296');
        expect(row.data.lastSeenAt).toBe('@ts');
        expect(row.data.syncCount).toEqual({ __inc: 1 });
        expect(row.data.platform).toBe('android');
    });

    test('throttles repeat syncs — the app calls three endpoints per cycle', () => {
        touchActive('2410990111');
        touchActive('2410990111');
        touchActive('2410990111');
        expect(writes.sets.filter((s) => s.path.endsWith('2410990111'))).toHaveLength(1);
    });

    test('is synchronous and never throws, whatever Firestore does', () => {
        jest.resetModules();
        jest.doMock('../_firebase-admin', () => ({
            adminDb: { doc: () => { throw new Error('down'); }, collection: () => ({ add: async () => {} }) },
            isAdminRoll: () => false,
        }));
        const { touchActive: ta } = require('../_activity');
        expect(() => ta('2410990222')).not.toThrow();
        jest.resetModules();
    });
});

describe('helpers', () => {
    test('safeRoll rejects path traversal and oversized ids', () => {
        expect(safeRoll('2410990296')).toBe('2410990296');
        expect(safeRoll('a/b')).toBeNull();
        expect(safeRoll('..')).toBeNull();
        expect(safeRoll('x'.repeat(65))).toBeNull();
        expect(safeRoll('')).toBeNull();
    });

    test('hashIp is stable, truncated, and declines unknown addresses', () => {
        expect(hashIp('1.2.3.4')).toBe(hashIp('1.2.3.4'));
        expect(hashIp('1.2.3.4')).not.toBe(hashIp('1.2.3.5'));
        expect(hashIp('unknown')).toBeNull();
        expect(hashIp(null)).toBeNull();
    });

    test('clientMeta bounds what the client claims about itself', () => {
        const meta = clientMeta({ headers: { 'x-presence-version': '2.1.0', 'user-agent': 'u'.repeat(500) }, body: {} });
        expect(meta.appVersion).toBe('2.1.0');
        expect(meta.userAgent).toHaveLength(200);
    });
});
