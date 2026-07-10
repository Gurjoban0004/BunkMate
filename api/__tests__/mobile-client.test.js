/** @jest-environment node */

process.env.ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || '0123456789abcdef0123456789abcdef';
process.env.ERP_BASE_URL = process.env.ERP_BASE_URL || 'https://cuiet.codebrigade.in';

const {
    interpretLogin,
    parseMobileSession,
    extractHtml,
    mobilePost,
    appLogin,
    fetchAttendanceMonth,
    fetchTimetableDay,
} = require('../_mobile-client');

// A minimal fetch double: records the last call and returns a canned text body.
function mockFetch(bodyText, ok = true) {
    const calls = [];
    const impl = async (url, opts) => {
        calls.push({ url, opts });
        return { ok, text: async () => bodyText };
    };
    impl.calls = calls;
    return impl;
}

describe('interpretLogin', () => {
    test('status 1 → ok with server-issued securityToken', () => {
        const payload = {
            status: '1',
            token: 'a'.repeat(128),
            data: { userId: '24635', roleId: '4', sessionId: '20', apiKey: '52FvI920260709090726', studentId: '9508', name: 'GURJOBAN' },
        };
        const r = interpretLogin(payload, 'uuid-123');
        expect(r.outcome).toBe('ok');
        expect(r.session).toEqual(expect.objectContaining({
            userId: '24635', roleId: '4', sessionId: '20',
            apiKey: '52FvI920260709090726', studentId: '9508', studentName: 'GURJOBAN',
            securityToken: 'a'.repeat(128), deviceIdUUID: 'uuid-123',
        }));
    });

    test('status 4 → mfa with authUserId + otp hint (data as array)', () => {
        const payload = { status: '4', mobileString: 'gur****@chitkara.edu.in', data: [{ userId: '24635', roleId: '4' }] };
        const r = interpretLogin(payload, 'uuid');
        expect(r).toEqual({ outcome: 'mfa', authUserId: '24635', otpHint: 'gur****@chitkara.edu.in' });
    });

    test('status 4 parent (roleId 2) uses fatherUserId', () => {
        const payload = { status: '4', data: [{ userId: '999', fatherUserId: '111', roleId: '2' }] };
        expect(interpretLogin(payload).authUserId).toBe('111');
    });

    test('status 0 → ERP_REJECTED', () => {
        expect(() => interpretLogin({ status: '0' })).toThrow(/invalid username or password/i);
        try { interpretLogin({ status: '0' }); } catch (e) { expect(e.code).toBe('ERP_REJECTED'); }
    });

    test('status 3/5 → blocked (no contact info)', () => {
        try { interpretLogin({ status: '3' }); } catch (e) { expect(e.code).toBe('ERP_LOGIN_BLOCKED'); }
        expect(() => interpretLogin({ status: '5' })).toThrow(/email/i);
    });

    test('verificationStatus 8 → validation error', () => {
        expect(() => interpretLogin({ verificationStatus: '8', validation: 'Bad captcha' })).toThrow('Bad captcha');
    });
});

describe('parseMobileSession', () => {
    test('parent roleId 2 maps userId to child fatherUserId', () => {
        const s = parseMobileSession({ token: 't', data: { userId: '5', fatherUserId: '9', roleId: '2', sessionId: '20', apiKey: 'k' } }, 'dev');
        expect(s.userId).toBe('9');
        expect(s.securityToken).toBe('t');
        expect(s.deviceIdUUID).toBe('dev');
    });
});

describe('extractHtml', () => {
    test('prefers html, falls back to content then data.content', () => {
        expect(extractHtml({ html: '<b>A</b>' })).toBe('<b>A</b>');
        expect(extractHtml({ content: 'C' })).toBe('C');
        expect(extractHtml({ data: { content: 'D' } })).toBe('D');
        expect(extractHtml({})).toBe('');
    });
});

describe('mobilePost token injection ($.ajaxPrefilter equivalent)', () => {
    const session = { securityToken: 'TOK', deviceIdUUID: 'UUID', userId: '1' };

    test('appends securityToken + deviceIdUUID on data calls', async () => {
        const f = mockFetch('{"html":"x"}');
        await mobilePost('mobilev2/showAttendance', session, { userId: '1' }, f);
        const body = f.calls[0].opts.body;
        expect(body).toContain('securityToken=TOK');
        expect(body).toContain('deviceIdUUID=UUID');
    });

    test('does NOT append tokens on exempt endpoints (login/otp)', async () => {
        const f = mockFetch('{"status":"1"}');
        await mobilePost('mobilev2/appLoginAuthV2', session, { txtUsername: 'u' }, f);
        expect(f.calls[0].opts.body).not.toContain('securityToken');
    });

    test('tolerates ERP leading-whitespace JSON', async () => {
        const f = mockFetch('\t\n\n {"html":"<table></table>"}');
        const { payload } = await mobilePost('mobilev2/showAttendance', session, {}, f);
        expect(payload.html).toBe('<table></table>');
    });
});

describe('data fetchers', () => {
    const session = { securityToken: 'TOK', deviceIdUUID: 'UUID', userId: '24635', sessionId: '20', apiKey: 'K', roleId: '4' };

    test('fetchAttendanceMonth posts the right params and returns html', async () => {
        const f = mockFetch('{"html":"<table>att</table>"}');
        const r = await fetchAttendanceMonth(session, { month: 'July 2026' }, f);
        expect(f.calls[0].url).toMatch(/mobilev2\/showAttendance$/);
        expect(f.calls[0].opts.body).toContain('month=July%202026');
        expect(f.calls[0].opts.body).toContain('prevNext=0');
        expect(r.html).toBe('<table>att</table>');
    });

    test('fetchTimetableDay sends day 1-6 and returns html', async () => {
        const f = mockFetch('{"html":"<tr>tt</tr>"}');
        const r = await fetchTimetableDay(session, 3, f);
        expect(f.calls[0].opts.body).toContain('day=3');
        expect(r.html).toBe('<tr>tt</tr>');
    });
});

describe('appLogin', () => {
    test('drives interpretLogin end-to-end via mock fetch', async () => {
        const f = mockFetch(JSON.stringify({ status: '1', token: 'z'.repeat(64), data: { userId: '24635', roleId: '4', sessionId: '20', apiKey: 'K' } }));
        const r = await appLogin({ username: 'u', password: 'p', deviceIdUUID: 'd', baseUrl: 'https://cuiet.codebrigade.in' }, f);
        expect(r.outcome).toBe('ok');
        expect(r.session.securityToken).toBe('z'.repeat(64));
        expect(f.calls[0].opts.body).toContain('txtUsername=u');
        expect(f.calls[0].opts.body).toContain('device=android');
    });
});
