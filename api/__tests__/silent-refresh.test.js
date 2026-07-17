/** @jest-environment node */

// Silent refresh: when a stored session dies but the device is trusted (ERP
// status 1 login, no OTP), the data handler re-logs-in, retries the fetch,
// and returns fresh data plus a new session token — no OTP round-trip.

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

        expect(result).toEqual({ needsOtp: true, authUserId: '24635' });
    });

    test('erp-attendance retries with fresh session and returns data + new token', async () => {
        const { encryptSession, encryptPersistent, decryptSession } = require('../_session-utils');
        const deadToken = encryptSession({
            rollNumber: '2410990001', userId: '24635', sessionId: '19', roleId: '4',
            apiKey: 'EXPIRED', studentId: '9508',
        });
        const persistentToken = encryptPersistent({ username: '2410990001', password: 'pw', studentName: 'Student' });

        // Data endpoints report a dead session until appLoginAuthV2 is called
        let loggedIn = false;
        global.fetch = jest.fn(async (url) => {
            if (String(url).includes('appLoginAuthV2')) {
                loggedIn = true;
                return jsonResponse({
                    status: '1',
                    token: 'fresh-sec-token',
                    data: [{ userId: '24635', sessionId: '19', roleId: '4', apiKey: 'FRESH20260717', studentId: '9508', name: 'Student' }],
                });
            }
            if (!loggedIn) {
                return jsonResponse({ status: '0', message: 'Session invalid, please login again' });
            }
            return jsonResponse({ content: ATTENDANCE_HTML });
        });

        const handler = require('../erp-attendance');
        const res = makeRes();
        await handler(makeReq({ token: deadToken, persistentToken }), res);

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.needsOtp).toBeUndefined();
        expect(res.body.subjects.length).toBeGreaterThan(0);
        // New token must decrypt to the fresh session, with rollNumber preserved for admin auth
        expect(res.body.token).toEqual(expect.any(String));
        expect(decryptSession(res.body.token)).toEqual(expect.objectContaining({
            apiKey: 'FRESH20260717',
            securityToken: 'fresh-sec-token',
            rollNumber: '2410990001',
        }));
    });
});
