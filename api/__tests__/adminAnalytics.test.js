/**
 * Guards the admin analytics metrics: the numbers must come from real data,
 * a failing query must report failure rather than invent figures, and the
 * expensive queries must stay bounded.
 */

process.env.ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || '0123456789abcdef0123456789abcdef';

const now = Date.now();
const HOUR = 3600000;
const DAY = 86400000;
const ts = (ms) => ({ toMillis: () => ms, seconds: Math.floor(ms / 1000) });

const syncDocs = [
    { path: 'telemetry/userA/syncs/s1', data: { timestamp: ts(now - 10 * 60000), rollNumber: '2410990001',
        endpoints: [{ name: 'attendance', status: 'ok', durationMs: 100 }, { name: 'calendar', status: 'fail', durationMs: 900, error: 'HTTP 500' }],
        parserErrors: [{ component: 'register', error: 'no rows' }] } },
    { path: 'telemetry/userB/syncs/s2', data: { timestamp: ts(now - 20 * 60000), rollNumber: '2410990002',
        endpoints: [{ name: 'attendance', status: 'ok', durationMs: 120 }, { name: 'calendar', status: 'fail', durationMs: 800, error: 'HTTP 500' }],
        parserErrors: [] } },
    { path: 'telemetry/userC/syncs/s3', data: { timestamp: ts(now - 30 * 60000), rollNumber: '2410990003',
        endpoints: [{ name: 'attendance', status: 'ok', durationMs: 110 }, { name: 'calendar', status: 'fail', durationMs: 850 }],
        parserErrors: [] } },
    { path: 'telemetry/userA/syncs/s4', data: { timestamp: ts(now - 3 * DAY), rollNumber: '2410990001',
        endpoints: [{ name: 'attendance', status: 'ok', durationMs: 90 }], parserErrors: [] } },
];

const semDocs = [
    { path: 'users/userA/semesters/sem1', data: {
        subjects: [
            { name: 'Physics', initialAttended: 40, initialTotal: 50, target: 75 },
            { name: 'Maths', initialAttended: 20, initialTotal: 50, target: 75 },
        ],
        attendanceRecords: {
            '2026-08-10': { sub1: { status: 'partial', units: 2, attendedUnits: 1, source: 'erp' } }, // Monday
            '2026-08-11': { sub1: { status: 'absent', units: 2, source: 'erp' } },                    // Tuesday
        } } },
    { path: 'users/userB/semesters/sem1', data: { subjects: [{ name: 'Physics', initialAttended: 10, initialTotal: 50, target: 75 }] } },
];

const userDocs = [
    { id: 'userA', data: { erpRollNumber: '2410990001', studentName: 'A', lastActive: ts(now - HOUR), setupComplete: true, version: '2.0.0' } },
    { id: 'userB', data: { erpRollNumber: '2410990002', studentName: 'B', lastActive: ts(now - 3 * DAY), setupComplete: true, version: '2.0.0' } },
    { id: 'userC', data: { erpRollNumber: '2510990003', studentName: 'C', lastActive: ts(now - 20 * DAY), setupComplete: false, version: '1.0.0' } },
];

// The server-side ledger (api/_activity.js).
const ledgerDocs = [
    { id: '2410990001', data: { rollNumber: '2410990001', studentName: 'Asha', lastSeenAt: ts(now - 60000), syncCount: 4, platform: 'android', appVersion: '2.1.0' } },
    { id: '2410990004', data: { rollNumber: '2410990004', studentName: 'Dev', lastSeenAt: ts(now - 2 * HOUR), loginCount: 1, platform: 'web' } },
    { id: 'mock', data: { rollNumber: 'mock', isMock: true, lastSeenAt: ts(now - 30000) } },
];
const { dayKey, dayStartMs } = require('../_activity');
const today = dayKey(now);
const minuteOf = (h, m) => Math.floor((dayStartMs(today) + h * HOUR + m * 60000) / 60000);
const dayDocs = [
    // two sessions: 09:00–09:04 and 14:00
    { id: '2410990001', data: { rollNumber: '2410990001', studentName: 'Asha', beats: [minuteOf(9, 0), minuteOf(9, 2), minuteOf(9, 4), minuteOf(14, 0)], screens: { TodayMain: 3, SubjectDetail: 1 } } },
    { id: '2410990004', data: { rollNumber: '2410990004', studentName: 'Dev', beats: [minuteOf(9, 30)], screens: { TodayMain: 1 } } },
    { id: '2410990009', data: { rollNumber: '2410990009' } },   // no beats: not a visit
];
const plainDocs = {
    [`admin/activity/days/${today}`]: { day: today, screens: { TodayMain: 4, SubjectDetail: 1 } },
};

const mkDoc = (d) => {
    const parts = (d.path || '').split('/');
    return {
        id: d.id || parts[parts.length - 1],
        data: () => d.data,
        ref: { path: d.path, parent: { parent: { id: parts[1] } } },
    };
};
const mkSnap = (docs) => {
    const wrapped = docs.map(mkDoc);
    return { size: wrapped.length, docs: wrapped, forEach: (fn) => wrapped.forEach(fn) };
};

let cache = {};
let usersThrow = false;

const adminDb = {
    doc: (path) => ({
        get: async () => ({ exists: !!(cache[path] || plainDocs[path]), data: () => cache[path] || plainDocs[path] }),
        set: async (v) => { cache[path] = v; },
    }),
    collection: (name) => {
        const rows = name === 'users' ? userDocs
            : name === 'admin/activity/students' ? ledgerDocs
                : name === `admin/activity/days/${today}/students` ? dayDocs : [];
        const col = (list) => {
            const c = {
                where: (_f, _op, val) => col(list.filter((d) => d.data.lastSeenAt.toMillis() >= val.toMillis())),
                limit: () => c,
                count: () => ({ get: async () => ({ data: () => ({ count: list.length }) }) }),
                get: async () => {
                    if (usersThrow) throw new Error('permission denied');
                    return mkSnap(list);
                },
            };
            return c;
        };
        return col(rows);
    },
    collectionGroup: (name) => {
        const base = name === 'syncs' ? syncDocs : name === 'semesters' ? semDocs : [];
        const q = (rows) => ({
            where: (_f, _op, val) => q(rows.filter(d => d.data.timestamp.toMillis() >= val.toMillis())),
            orderBy: () => { throw new Error('index missing'); }, // exercise the fallback path
            limit: () => q(rows),
            get: async () => mkSnap(rows),
        });
        return q(base);
    },
};

// NB: these mocks must NOT carry `{ virtual: true }`. `_firebase-admin` etc. are
// real files; a virtual mock is keyed on the extensionless path, so once another
// suite in the same worker has resolved the real `./_firebase-admin.js` (see
// handlers-load.test.js, which loads every handler), the resolver's module-ID
// cache makes the require inside the handler miss the mock and hit the real
// module — the handler then 403s on every request. Order-dependent and invisible
// when the suite runs alone.
jest.mock('../_firebase-admin', () => ({
    adminDb,
    isAdminRoll: (roll) => roll === '2410990296',
}));

jest.mock('../_session-utils', () => ({
    setCorsHeaders: () => {},
    decodeSessionRollNumber: (token) => token,
    getClientIp: () => '127.0.0.1',
}));
jest.mock('../_rate-limit', () => ({ tooManyAttempts: async () => false }));

jest.mock('firebase-admin/firestore', () => ({
    FieldValue: { serverTimestamp: () => ({ toMillis: () => Date.now() }) },
    Timestamp: { fromMillis: (ms) => ({ toMillis: () => ms }) },
}));

const handler = require('../admin-analytics');

function call(metric, { token = '2410990296', forceRefresh = true, ...params } = {}) {
    return new Promise(resolve => {
        const res = {
            _code: 200,
            setHeader() {},
            status(c) { this._code = c; return this; },
            json(body) { resolve({ code: this._code, body }); },
            end() { resolve({ code: this._code, body: null }); },
        };
        handler({ method: 'POST', body: { token, metric, forceRefresh, ...params } }, res);
    });
}

const dataOf = async (metric, opts) => (await call(metric, opts)).body.data;

beforeEach(() => { cache = {}; usersThrow = false; });

describe('authorization', () => {
    it('rejects a non-admin token', async () => {
        expect((await call('overview', { token: '2410990999' })).code).toBe(403);
    });
    it('rejects an unknown metric', async () => {
        expect((await call('nope')).code).toBe(400);
        expect((await call('toString')).code).toBe(400);
    });
    it('rejects parameters that would name a bad cache doc', async () => {
        expect((await call('daily', { day: '../x' })).code).toBe(400);
        expect((await call('student', { roll: 'a/b' })).code).toBe(400);
    });
});

describe('live', () => {
    it('lists only students seen in the last five minutes, never the mock account', async () => {
        const lv = await dataOf('live');
        expect(lv.onlineNow).toBe(1);
        expect(lv.online[0]).toMatchObject({ rollNumber: '2410990001', studentName: 'Asha' });
    });
});

describe('daily', () => {
    it('turns beats into sessions, minutes and first-open time per student', async () => {
        const d = await dataOf('daily');
        expect(d.day).toBe(today);
        expect(d.users).toBe(2);                       // the doc with no beats is not a visit
        const asha = d.people.find((p) => p.rollNumber === '2410990001');
        expect(asha.studentName).toBe('Asha');
        expect(asha.sessions).toHaveLength(2);
        expect(asha.minutes).toBe(6);                  // 09:00–09:04 is 5, 14:00 is 1
        expect(asha.firstOpenAt).toBe(dayStartMs(today) + 9 * HOUR);
        expect(d.sessions).toBe(3);
        expect(d.minutes).toBe(7);
    });

    it('counts distinct students per IST hour and sums screen views', async () => {
        const d = await dataOf('daily');
        expect(d.hours[9]).toBe(2);
        expect(d.hours[14]).toBe(1);
        expect(d.screens).toEqual({ TodayMain: 4, SubjectDetail: 1 });
    });
});

describe('usage', () => {
    it('trends students per day from a count, and views from the day aggregate', async () => {
        const u = await dataOf('usage');
        expect(u.days).toHaveLength(14);
        // count() counts documents. writeDay never creates one without a beat,
        // so in real data this equals daily's `users`; the fixture's beatless doc is the difference.
        expect(u.days[13]).toMatchObject({ day: today, users: 3, views: 5 });
        expect(u.days[0].users).toBe(0);
        expect(u.screens.TodayMain).toBe(4);
    });
});

describe('endpointHealth', () => {
    it('separates a failing endpoint from a healthy one and sorts worst first', async () => {
        const eh = await dataOf('endpointHealth');
        expect(eh[0].name).toBe('calendar');
        expect(eh.find(e => e.name === 'calendar').successRate).toBe(0);
        expect(eh.find(e => e.name === 'attendance').successRate).toBe(100);
    });

    it('ignores telemetry older than the 24h window', async () => {
        const eh = await dataOf('endpointHealth');
        expect(eh.find(e => e.name === 'attendance').count).toBe(3); // the 3-day-old sync is excluded
    });
});

describe('downtime', () => {
    it('derives an outage from telemetry instead of an empty collection', async () => {
        const dt = await dataOf('downtime');
        expect(dt).toHaveLength(1);
        expect(dt[0].id).toBe('calendar');
        expect(dt[0].affectedUsers).toBe(3);
        expect(dt[0].sampleError).toBe('HTTP 500');
    });

    it('does not flag a healthy endpoint', async () => {
        expect((await dataOf('downtime')).some(d => d.id === 'attendance')).toBe(false);
    });
});

describe('parserFailures', () => {
    it('returns only syncs that recorded an error, with a usable timestamp', async () => {
        const pf = await dataOf('parserFailures');
        expect(pf).toHaveLength(1);
        expect(typeof pf[0].timestampMs).toBe('number');
    });
});

describe('userRoster', () => {
    it('aggregates every semester without a read per user', async () => {
        const { users: ur, unfinished } = await dataOf('userRoster');
        expect(ur).toHaveLength(4);   // three cloud users + one the ledger saw
        expect(unfinished).toEqual({ count: 0, olderThan7d: 0 });
        const a = ur.find(u => u.userId === 'userA');
        expect(a.totalSubjects).toBe(2);
        expect(a.totalClasses).toBe(100);
        expect(a.overallAttendancePct).toBe(60);
    });

    it('keeps users who have no semesters yet', async () => {
        const { users: ur } = await dataOf('userRoster');
        expect(ur.find(u => u.userId === 'userC').totalSubjects).toBe(0);
    });

    it('lists a student whose phone never wrote to the cloud, by name', async () => {
        const { users: ur } = await dataOf('userRoster');
        const dev = ur.find((u) => u.rollNumber === '2410990004');
        expect(dev).toMatchObject({ studentName: 'Dev', inCloud: false, batchGroup: 'Batch 2024' });
        expect(ur.find((u) => u.rollNumber === '2410990001')).toMatchObject({ studentName: 'Asha', inCloud: true, version: '2.1.0' });
        expect(ur.some((u) => u.rollNumber === 'mock')).toBe(false);
    });

    it('sorts by most recently active', async () => {
        expect((await dataOf('userRoster')).users[0].userId).toBe('userA');
    });
});

describe('bunkCulture', () => {
    it('counts periods, so a part-attended day is half bunked', async () => {
        const bc = await dataOf('bunkCulture');
        expect(bc.find(d => d.day === 'Monday').bunkRate).toBe(50);
        expect(bc.find(d => d.day === 'Tuesday').bunkRate).toBe(100);
    });
});

describe('caching', () => {
    it('serves the second call from cache', async () => {
        expect((await call('subjectDifficulty', { forceRefresh: true })).body.cached).toBe(false);
        expect((await call('subjectDifficulty', { forceRefresh: false })).body.cached).toBe(true);
    });

    it('writes one document per metric so no single doc can outgrow the limit', async () => {
        await call('subjectDifficulty');
        await call('bunkCulture');
        expect(Object.keys(cache).sort()).toEqual([
            'admin/analyticsCache/metrics/bunkCulture',
            'admin/analyticsCache/metrics/subjectDifficulty',
        ]);
    });
});

describe('failure honesty', () => {
    it('reports a broken query as an error instead of returning invented numbers', async () => {
        usersThrow = true;
        jest.spyOn(console, 'error').mockImplementation(() => {});
        const res = await call('overview');
        expect(res.code).toBe(500);
        expect(res.body.data).toBeUndefined();
        expect(res.body.error).toMatch(/permission denied/);
        console.error.mockRestore();
    });
});
