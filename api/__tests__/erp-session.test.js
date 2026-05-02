/** @jest-environment node */

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

describe('ERP session check', () => {
    test('validates encrypted session token without contacting ERP login', async () => {
        jest.resetModules();
        global.fetch = jest.fn(() => {
            throw new Error('session check must not hit ERP');
        });

        const { encryptSession } = require('../_session-utils');
        const handler = require('../erp-session');
        const token = encryptSession({
            userId: '24635',
            studentId: '9508',
            sessionId: '19',
            roleId: '4',
            apiKey: 'RFeRrG20260502052713',
        });

        const res = makeRes();
        await handler(makeReq({ action: 'check', token }), res);

        expect(global.fetch).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual(expect.objectContaining({
            valid: true,
            reason: 'session_available',
            studentId: '9508',
        }));
    });
});
