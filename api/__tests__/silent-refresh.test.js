/** @jest-environment node */

// reloginERP is the one call that can log a student in again. It is only ever
// reached from /api/erp-login (onboarding) and /api/erp-session requestOtp
// (the student tapped "Sign in again") — never from a data endpoint on its own.
// See reconnect-flow.test.js for that rule; this file pins the two ERP shapes.

process.env.ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || '0123456789abcdef0123456789abcdef';
process.env.ERP_BASE_URL = process.env.ERP_BASE_URL || 'https://cuiet.codebrigade.in';

function makeReq(body) {
    return { method: 'POST', body };
}

function makeRes() {
    const res = {
        statusCode: 200,
        headers: {},
        body: undefined,
        setHeader: jest.fn((key, value) => { res.headers[key] = value; }),
        status: jest.fn((code) => { res.statusCode = code; return res; }),
        json: jest.fn((body) => { res.body = body; return res; }),
        end: jest.fn(() => res),
    };
    return res;
}

const jsonResponse = (payload) => ({
    ok: true,
    text: async () => JSON.stringify(payload),
});

const ATTENDANCE_HTML = `
<div class="tt-box-new"><table>
<tr><td>Data Structures</td><td>24CSE0212</td><td>Dr. Teacher</td>
<td>10</td><td>8</td><td>2</td><td>80%</td></tr>
</table></div>`;

describe('silent session refresh (trusted device, no OTP)', () => {
    beforeEach(() => jest.resetModules());

    test('reloginERP returns full session when ERP login yields status 1', async () => {
        global.fetch = jest.fn(async () => jsonResponse({
            status: '1',
            token: 'sec-token-192hex',
            data: [{ userId: '24635', sessionId: '19', roleId: '4', apiKey: 'K20260717090000', studentId: '9508', name: 'Student' }],
        }));

        const { reloginERP } = require('../_session-utils');
        const result = await reloginERP('2410990001', 'pw');

        expect(result.needsOtp).toBeUndefined();
        expect(result.session).toEqual(expect.objectContaining({
            userId: '24635',
            sessionId: '19',
            apiKey: 'K20260717090000',
            securityToken: 'sec-token-192hex',
        }));
    });

    test('reloginERP falls back to OTP flow when ERP demands MFA (status 4)', async () => {
        global.fetch = jest.fn(async () => jsonResponse({
            status: '4',
            authUserId: '24635',
            mobileString: 'XXXXXX1234',
            data: [{ userId: '24635', roleId: '4' }],
        }));

        const { reloginERP } = require('../_session-utils');
        const result = await reloginERP('2410990001', 'pw');

        expect(result).toEqual({ needsOtp: true, authUserId: '24635', deviceId: expect.stringMatching(/^[0-9A-F-]{36}$/) });
    });
});
