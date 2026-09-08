/** @jest-environment node */

/**
 * /api/erp-attendance answers with the calendar, and files the research marks.
 *
 * The register page IS the calendar — attendance and calendar used to fetch the
 * exact same URL, parse the same HTML, and each pay a warm-up round trip for the
 * privilege. Attendance now parses it once and ships both, and the client skips
 * /api/erp-calendar whenever `calendar` came back.
 *
 * Two things must hold or the roll-out breaks quietly:
 *   1. the calendar and register totals are in the answer, so the client has
 *      history without a second request;
 *   2. the research write moved here with the parse — if it did not, every
 *      participant's `marks` silently stop arriving while `slots` keep landing.
 */

process.env.ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || '0123456789abcdef0123456789abcdef';
process.env.ERP_BASE_URL = process.env.ERP_BASE_URL || 'https://cuiet.codebrigade.in';

const UUID = '3f2a9c14-8b7d-4e6a-9c21-7d5e0f1a2b3c';

const mockWrites = [];
jest.mock('../_firebase-admin', () => ({
    adminDb: {
        collection: () => ({
            doc: () => ({
                collection: () => ({
                    doc: (id) => ({ set: (data, opts) => { mockWrites.push({ id, data, opts }); return Promise.resolve(); } }),
                }),
            }),
        }),
    },
    isAdminRoll: () => false,
}));
jest.mock('../_rate-limit', () => ({ tooManyAttempts: async () => false }));
jest.mock('../_revocation', () => ({ blockIfRevoked: async () => false }));

const makeRes = () => {
    const res = {
        statusCode: 200, headers: {}, body: undefined,
        setHeader: (k, v) => { res.headers[k] = v; },
        status: (c) => { res.statusCode = c; return res; },
        json: (b) => { res.body = b; return res; },
        end: () => res,
    };
    return res;
};
const resp = (text, ok = true) => ({
    ok, text: async () => text,
    headers: { getSetCookie: () => [], get: () => null, raw: () => ({}) },
});

// Two subjects, three dated cells, so calendar/marks/totals are all non-trivial.
const REGISTER = `
<table><thead><tr><th></th></tr>
<tr><th>Mathematics<br>(24MAT0101)</th><th>Algorithms<br>(24CSE0317)</th>
<th>1<br>19-01<br>1</th><th>2<br>20-01<br>1</th></tr>
</thead><tbody>
<tr id='subject_100'><td>Attendance Count</td>
<td id='subject_100_2026_01_19_1'>P</td>
<td id='subject_100_2026_01_20_1'>X</td>
<td class='total_100'>1/2</td><td class='percent_100'>50%</td></tr>
<tr id='subject_200'><td>Attendance Count</td>
<td id='subject_200_2026_01_19_2'>P</td>
<td class='total_200'>1/1</td><td class='percent_200'>100%</td></tr>
</tbody></table>`;

function session() {
    const { encryptSession } = require('../_session-utils');
    return encryptSession({
        rollNumber: '2410990001', userId: '24635', sessionId: '20', roleId: '4',
        apiKey: 'LIVEKEY', securityToken: 'sec', deviceIdUUID: 'uuid', studentId: '9508',
    });
}

describe('/api/erp-attendance carries the calendar', () => {
    beforeEach(() => { jest.resetModules(); mockWrites.length = 0; });

    test('answers with subjects, calendar, registerSubjects and latestDate in one call', async () => {
        const token = session();
        let registerFetches = 0;
        global.fetch = jest.fn(async (url) => {
            if (String(url).includes('getAttendanceRegister')) { registerFetches += 1; return resp(REGISTER); }
            return resp('');
        });

        const res = makeRes();
        await require('../erp-attendance')({ method: 'POST', body: { token }, headers: {} }, res);

        expect(res.statusCode).toBe(200);
        expect(res.body.subjects.map(s => s.code).sort()).toEqual(['24CSE0317', '24MAT0101']);
        expect(res.body.subjects.find(s => s.code === '24MAT0101'))
            .toMatchObject({ delivered: 2, attended: 1, absent: 1 });

        // The half the client used to pay a second round trip for.
        expect(Object.keys(res.body.calendar).sort()).toEqual(['2026-01-19', '2026-01-20']);
        expect(res.body.calendar['2026-01-20'].Mathematics).toMatchObject({ status: 'absent', attendedUnits: 0 });
        expect(res.body.latestDate).toBe('2026-01-20');
        // mapCalendarToRecords reads these — the register's own per-subject totals.
        expect(res.body.registerSubjects.find(s => s.code === '24MAT0101'))
            .toMatchObject({ attended: 1, total: 2, erpSubjectId: '100' });

        // One fetch of the register per attendance call, warm-up cookies and all.
        expect(registerFetches).toBe(1);
    });

    test('files the research marks — the write that moved here with the parse', async () => {
        const token = session();
        global.fetch = jest.fn(async (url) =>
            (String(url).includes('getAttendanceRegister') ? resp(REGISTER) : resp('')));

        const res = makeRes();
        await require('../erp-attendance')(
            { method: 'POST', body: { token, researchId: UUID, consentedAt: '2026-09-07T00:00:00Z' }, headers: {} },
            res,
        );

        expect(mockWrites).toHaveLength(1);
        expect(mockWrites[0].id).toBe(UUID);
        expect(mockWrites[0].data.consentedAt).toBe('2026-09-07T00:00:00Z');
        // One mark per register cell, not one per subject-day.
        expect(mockWrites[0].data.marks).toEqual([
            { d: '2026-01-19', s: '24MAT0101', p: 1, a: 1 },
            { d: '2026-01-20', s: '24MAT0101', p: 1, a: 0 },
            { d: '2026-01-19', s: '24CSE0317', p: 2, a: 1 },
        ]);
        expect(mockWrites[0].data.subjects).toHaveLength(2);
    });

    test('without a participant UUID nothing is filed, and the answer is unchanged', async () => {
        const token = session();
        global.fetch = jest.fn(async (url) =>
            (String(url).includes('getAttendanceRegister') ? resp(REGISTER) : resp('')));

        const res = makeRes();
        await require('../erp-attendance')({ method: 'POST', body: { token }, headers: {} }, res);

        expect(mockWrites).toHaveLength(0);
        expect(res.body.calendar).toBeDefined();
    });

    test('keepAlive still probes only — no parse, no calendar, no research write', async () => {
        const token = session();
        let registerFetches = 0;
        global.fetch = jest.fn(async (url) => {
            if (String(url).includes('getAttendanceRegister')) { registerFetches += 1; return resp(REGISTER); }
            return resp('{"status":1}');
        });

        const res = makeRes();
        await require('../erp-attendance')(
            { method: 'POST', body: { token, keepAlive: true, researchId: UUID }, headers: {} }, res);

        expect(res.body).toMatchObject({ success: true, alive: true });
        expect(res.body.calendar).toBeUndefined();
        expect(registerFetches).toBe(0);
        expect(mockWrites).toHaveLength(0);
    });

    test('summary-card fallback answers without a calendar, so the client asks erp-calendar', async () => {
        const token = session();
        const SUMMARY = '<div class="tt-box-new"><td>Physics</td><td>Dr X</td><td>10</td><td>8</td><td>2</td><td>80%</td></div>';
        global.fetch = jest.fn(async (url) =>
            (String(url).includes('commonPage') ? resp(SUMMARY) : resp('no register here')));

        const res = makeRes();
        await require('../erp-attendance')({ method: 'POST', body: { token, researchId: UUID }, headers: {} }, res);

        expect(res.body.success).toBe(true);
        expect(res.body.subjects.length).toBeGreaterThan(0);
        expect(res.body.calendar).toBeUndefined();
        expect(mockWrites).toHaveLength(0);   // no register parsed → nothing to file
    });
});
