/** @jest-environment node */

// Regression: the mobile API never serves the real timetable, so the timetable fetch always
// "fails" (response.ok=false). The handler used to treat that as a dead session and re-login,
// which emailed an OTP on every app open. It must NOT re-login on a missing timetable — it must
// derive the weekly grid from the attendance register instead.

process.env.ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || '0123456789abcdef0123456789abcdef';
process.env.ERP_BASE_URL = process.env.ERP_BASE_URL || 'https://cuiet.codebrigade.in';

const makeReq = (body) => ({ method: 'POST', body });
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
const resp = (text, ok = true) => ({
    ok, text: async () => text,
    headers: { getSetCookie: () => [], get: () => null, raw: () => ({}) },
});

// Register with one Monday + two Tuesday instances → derivable weekly grid.
const REGISTER = `
<table><thead><tr><th></th></tr>
<tr><th>Mathematics<br>(24MAT0101)</th><th>1<br>19-01<br>1</th><th>2<br>20-01<br>1</th><th>3<br>27-01<br>1</th></tr>
</thead><tbody>
<tr id='subject_100'><td>Attendance Count</td>
<td id='subject_100_2026_01_19_1'>1</td>
<td id='subject_100_2026_01_20_1'>2</td>
<td id='subject_100_2026_01_27_1'>3</td>
<td class='total_100'>3/3</td><td class='percent_100'>100%</td></tr>
</tbody></table>`;

describe('erp-timetable handler — no OTP on missing timetable', () => {
    beforeEach(() => jest.resetModules());

    test('derives from register and never calls appLoginAuthV2', async () => {
        const { encryptSession, encryptPersistent } = require('../_session-utils');
        const token = encryptSession({
            rollNumber: '2410990001', userId: '24635', sessionId: '20', roleId: '4',
            apiKey: 'LIVEKEY', securityToken: 'sec', deviceIdUUID: 'uuid', studentId: '9508',
        });
        const persistentToken = encryptPersistent({ username: '2410990001', password: 'pw', studentName: 'S' });

        let loginCalled = false;
        global.fetch = jest.fn(async (url) => {
            const u = String(url);
            if (u.includes('appLoginAuthV2') || u.includes('verifyOtp')) { loginCalled = true; return resp('{}'); }
            if (u.includes('getAttendanceRegister')) return resp(REGISTER);       // register → derivable
            return resp('', true);                                                // every timetable endpoint → empty
        });

        const handler = require('../erp-timetable');
        const res = makeRes();
        await handler(makeReq({ token, persistentToken }), res);

        expect(loginCalled).toBe(false);              // the actual bug: no relogin → no OTP email
        expect(res.body.success).toBe(true);
        expect(res.body.needsOtp).toBeUndefined();
        expect(res.body.source).toBe('register-derived');
        const total = Object.values(res.body.timetable).reduce((n, d) => n + d.length, 0);
        expect(total).toBeGreaterThan(0);             // Tuesday recurs (20th + 27th) → a slot
    });
});
