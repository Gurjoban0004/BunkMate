/** @jest-environment node */

// Regression: the ERP's OTP challenge was being read as a trusted device.
//
// CUIET's appLoginAuthV2 answers status 4 (OTP emailed) with a payload that
// already contains userId, sessionId and apiKey. The trusted-device fast path
// only checked sessionId + apiKey, so EVERY login took it: the OTP screen was
// skipped, a session with no securityToken was minted, the first data call came
// back "session expired", and the student was told their password was wrong.
//
// LOGIN_STATUS_4 below is the verbatim body of the real login captured in
// proxyman/cuiet.codebrigade.in_07-20-2026-19-56-14.har (names/ids as captured).

process.env.ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || '0123456789abcdef0123456789abcdef';
process.env.ERP_BASE_URL = process.env.ERP_BASE_URL || 'https://cuiet.codebrigade.in';

const LOGIN_STATUS_4 = {
    status: '4',
    mobileString: 'email address gur****@chitkara.edu.in',
    data: [{
        userId: '24635', name: 'GURJOBAN SINGH', studentId: '9508',
        roleName: 'Student', roleId: '4', sessionId: '20', instituteId: 1,
        androidDeviceId: '', iosDeviceId: '', loginBit: '1',
        apiKey: 'A001vt20260720070653', profileName: 'GURJOBAN SINGH',
    }],
};

// The OTP-verify answer, same capture: `data.token` is the securityToken.
const VERIFY_STATUS_1 = {
    status: '1',
    data: {
        userId: '24635', name: 'GURJOBAN SINGH', studentId: '9508',
        roleId: '4', sessionId: '20', apiKey: 'Sasat92026072007155',
        token: '6ced176a52410f35834cfd46cb3a65e6',
    },
};

const jsonResponse = (payload) => ({ ok: true, text: async () => JSON.stringify(payload) });

function makeRes() {
    const res = {
        statusCode: 200, body: undefined,
        setHeader: jest.fn(), end: jest.fn(() => res),
        status: jest.fn((c) => { res.statusCode = c; return res; }),
        json: jest.fn((b) => { res.body = b; return res; }),
    };
    return res;
}

beforeEach(() => jest.resetModules());

describe('an OTP challenge is never mistaken for a trusted device', () => {
    test('reloginERP asks for the OTP even though the challenge carries sessionId + apiKey', async () => {
        global.fetch = jest.fn(async () => jsonResponse(LOGIN_STATUS_4));

        const { reloginERP } = require('../_session-utils');
        const result = await reloginERP('2410990296', 'pw', null, 'C0FFEE00-DEAD-BEEF-CAFE-000000000001');

        expect(result.needsOtp).toBe(true);
        expect(result.session).toBeUndefined();
    });

    test('/api/erp-login sends the student to the code screen, not into the app', async () => {
        global.fetch = jest.fn(async () => jsonResponse(LOGIN_STATUS_4));

        const handler = require('../erp-login');
        const res = makeRes();
        await handler({ method: 'POST', headers: {}, body: { username: '2410990296', password: 'pw' } }, res);

        expect(res.statusCode).toBe(200);
        expect(res.body.needsOtp).toBe(true);
        expect(res.body.trusted).toBeUndefined();
        expect(res.body.token).toBeUndefined();      // the session that used to poison the app
        expect(typeof res.body.authUserId).toBe('string');
    });

    test('a status-1 answer without a securityToken is still not a usable session', async () => {
        global.fetch = jest.fn(async () => jsonResponse({
            status: '1',
            data: [{ userId: '24635', sessionId: '20', roleId: '4', apiKey: 'A001vt' }],
        }));

        const { reloginERP } = require('../_session-utils');
        const result = await reloginERP('2410990296', 'pw');
        expect(result.needsOtp).toBe(true);
    });

    test('verifying the code does hand back a session, securityToken and all', async () => {
        global.fetch = jest.fn(async () => jsonResponse(VERIFY_STATUS_1));

        const { verifyOtpWithERP, decryptSession, mintSessionToken } = require('../_session-utils');
        const session = await verifyOtpWithERP('24635', '1234', 'C0FFEE00-DEAD-BEEF-CAFE-000000000001');

        expect(session.securityToken).toBe('6ced176a52410f35834cfd46cb3a65e6');
        expect(decryptSession(mintSessionToken(session, { username: '2410990296' })).securityToken)
            .toBe('6ced176a52410f35834cfd46cb3a65e6');
    });
});

describe('a session with no securityToken is retired at startup', () => {
    test('erp-session check rejects it so the app asks for a real sign-in', async () => {
        const { encryptSession } = require('../_session-utils');
        const handler = require('../erp-session');
        const res = makeRes();
        await handler({ method: 'POST', headers: {}, body: {
            action: 'check',
            token: encryptSession({
                rollNumber: '2410990296', userId: '24635', sessionId: '20',
                roleId: '4', apiKey: 'A001vt', studentId: '9508', securityToken: '',
            }),
        } }, res);

        expect(res.body).toEqual(expect.objectContaining({ valid: false, reason: 'incomplete_session' }));
    });
});
