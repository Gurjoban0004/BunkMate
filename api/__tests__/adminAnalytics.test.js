/**
 * Guards the admin analytics metrics: the numbers must come from real data,
 * a failing query must report failure rather than invent figures, and the
 * expensive queries must stay bounded.
 */

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
        get: async () => ({ exists: !!cache[path], data: () => cache[path] }),
        set: async (v) => { cache[path] = v; },
    }),
    collection: (name) => ({
        get: async () => {
            if (usersThrow) throw new Error('permission denied');
            return name === 'users' ? mkSnap(userDocs) : mkSnap([]);
        },
    }),
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

jest.mock('../_firebase-admin', () => ({
    adminDb,
    isAdminRoll: (roll) => roll === '2410990296',
}), { virtual: true });

jest.mock('../_session-utils', () => ({
    setCorsHeaders: () => {},
    decodeSessionRollNumber: (token) => token,
}), { virtual: true });

jest.mock('firebase-admin/firestore', () => ({
    FieldValue: { serverTimestamp: () => ({ toMillis: () => Date.now() }) },
    Timestamp: { fromMillis: (ms) => ({ toMillis: () => ms }) },
}), { virtual: true });

const handler = require('../admin-analytics');

function call(metric, { token = '2410990296', forceRefresh = true } = {}) {
    return new Promise(resolve => {
        const res = {
            _code: 200,
            setHeader() {},
            status(c) { this._code = c; return this; },
            json(body) { resolve({ code: this._code, body }); },
            end() { resolve({ code: this._code, body: null }); },
        };
        handler({ method: 'POST', body: { token, metric, forceRefresh } }, res);
    });
}

const dataOf = async (metric, opts) => (await call(metric, opts)).body.data;

beforeEach(() => { cache = {}; usersThrow = false; });

describe('authorization', () => {
    it('rejects a non-admin token', async () => {
        expect((await call('activeUsers', { token: '2410990999' })).code).toBe(403);
    });
    it('rejects an unknown metric', async () => {
        expect((await call('nope')).code).toBe(400);
    });
});

describe('activeUsers', () => {
    it('reports the real user total, not a stand-in', async () => {
        const au = await dataOf('activeUsers');
        expect(au.total).toBe(3);
        expect([au.dau, au.wau, au.mau]).toEqual([1, 2, 3]);
    });

    it('trends distinct users per day rather than bucketing by last-seen', async () => {
        const { sparkline, total } = await dataOf('activeUsers');
        expect(sparkline).toHaveLength(7);
        expect(sparkline[6]).toBe(3); // three users synced today
        sparkline.forEach(v => expect(v).toBeLessThanOrEqual(total));
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

describe('rateLimit', () => {
    it('counts only the last 24 hours per user', async () => {
        const rl = await dataOf('rateLimit');
        expect(rl.find(r => r.rollNumber === '2410990001').daily).toBe(1);
        expect(rl.every(r => r.status === 'normal')).toBe(true);
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
        const ur = await dataOf('userRoster');
        expect(ur).toHaveLength(3);
        const a = ur.find(u => u.userId === 'userA');
        expect(a.totalSubjects).toBe(2);
        expect(a.totalClasses).toBe(100);
        expect(a.overallAttendancePct).toBe(60);
    });

    it('keeps users who have no semesters yet', async () => {
        const ur = await dataOf('userRoster');
        expect(ur.find(u => u.userId === 'userC').totalSubjects).toBe(0);
    });

    it('sorts by most recently active', async () => {
        expect((await dataOf('userRoster'))[0].userId).toBe('userA');
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
        const res = await call('activeUsers');
        expect(res.code).toBe(500);
        expect(res.body.data).toBeUndefined();
        expect(res.body.error).toMatch(/permission denied/);
        console.error.mockRestore();
    });
});
