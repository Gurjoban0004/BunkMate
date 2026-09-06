/** @jest-environment node */

// /api/admin: every write is validated, rate limited and audited.

process.env.ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || '0123456789abcdef0123456789abcdef';
process.env.ADMIN_ROLL_NUMBERS = '2410990296';

const writes = [];
const auditEntries = [];
const revokedDocs = [{ id: '2410990111', data: () => ({ reason: 'Shared account', revokedAt: { toMillis: () => 1 } }) }];

jest.mock('../_firebase-admin', () => ({
    adminDb: {
        doc: (path) => ({
            set: async (data, opts) => { writes.push({ path, data, opts }); },
            delete: async () => { writes.push({ path, deleted: true }); },
        }),
        collection: (path) => ({
            add: async (entry) => { auditEntries.push({ path, entry }); },
            limit: () => ({ get: async () => ({ forEach: (fn) => revokedDocs.forEach(fn) }) }),
        }),
    },
    isAdminRoll: (r) => r === '2410990296',
}));
jest.mock('../_rate-limit', () => ({ tooManyAttempts: async () => false }));
jest.mock('firebase-admin/firestore', () => ({
    FieldValue: { serverTimestamp: () => 'TS' },
    Timestamp: { fromMillis: (ms) => ({ ms }) },
}));

const { encryptSession } = require('../_session-utils');
const handler = require('../admin');

const adminToken = () => encryptSession({ rollNumber: '2410990296' });
const call = async (action, payload, token = adminToken()) => {
    const res = { statusCode: 200, body: null, headers: {} };
    res.setHeader = (k, v) => { res.headers[k] = v; };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; return res; };
    res.end = () => res;
    await handler({ method: 'POST', body: { token, action, payload }, headers: { 'x-forwarded-for': '9.9.9.9' } }, res);
    return res;
};

beforeEach(() => { writes.length = 0; auditEntries.length = 0; });

test('a non-admin session is refused before any validation', async () => {
    const res = await call('updateConfig', { maintenanceMode: true }, encryptSession({ rollNumber: '2410990001' }));
    expect(res.statusCode).toBe(403);
    expect(writes).toEqual([]);
});

test('updateConfig accepts an https apiBaseUrl and rejects http / unknown keys', async () => {
    expect((await call('updateConfig', { apiBaseUrl: 'https://presence-blue.vercel.app/' })).body).toEqual({ success: true, updated: ['apiBaseUrl'] });
    expect(writes[0].data).toEqual({ apiBaseUrl: 'https://presence-blue.vercel.app' });   // trailing slash trimmed
    expect((await call('updateConfig', { apiBaseUrl: 'http://x' })).statusCode).toBe(400);
    expect((await call('updateConfig', { adminRolls: ['1'] })).statusCode).toBe(400);
    expect((await call('updateConfig', { featureFlags: { nuke: true } })).statusCode).toBe(400);
});

test('every mutation lands in the audit log with actor, ip and action', async () => {
    await call('revokeUser', { targetRollNumber: '2410990002', reason: '  spam  ' });
    expect(writes[0]).toEqual({ path: 'admin/revokedUsers/items/2410990002', data: { revokedAt: 'TS', revokedBy: '2410990296', reason: 'spam' }, opts: undefined });
    expect(auditEntries[0].path).toBe('admin/auditLog/entries');
    expect(auditEntries[0].entry).toEqual(expect.objectContaining({ actor: '2410990296', ip: '9.9.9.9', action: 'revokeUser', detail: { target: '2410990002', reason: 'spam' } }));
});

test('revokeUser refuses an admin roll and a non-roll target', async () => {
    expect((await call('revokeUser', { targetRollNumber: '2410990296' })).statusCode).toBe(400);
    expect((await call('revokeUser', { targetRollNumber: '../admin/config' })).statusCode).toBe(400);
    expect(writes).toEqual([]);
});

test('announcements are bounded and typed; ids are validated on delete', async () => {
    const ok = await call('publishAnnouncement', { title: 'Hi', message: 'There', type: 'shout', expiryHours: 72 });
    expect(ok.body.success).toBe(true);
    expect(writes[0].data.type).toBe('info');                       // unknown type falls back
    expect((await call('publishAnnouncement', { title: 'x'.repeat(121), message: 'm' })).statusCode).toBe(400);
    expect((await call('deleteAnnouncement', { id: '../config' })).statusCode).toBe(400);
});

test('listRevokedUsers returns the server-side list', async () => {
    const res = await call('listRevokedUsers');
    expect(res.body).toEqual({ success: true, users: [{ rollNumber: '2410990111', reason: 'Shared account', revokedAt: 1 }] });
});
