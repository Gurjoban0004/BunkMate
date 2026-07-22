/**
 * Server-side revocation is the only gate that actually stops a revoked user —
 * the client RevokedGate runs once at launch and is trivially bypassed. These
 * tests pin the two properties that matter: revoked users are blocked, and an
 * infrastructure failure never locks out everyone else.
 */

const mockGet = jest.fn();

jest.mock('../_firebase-admin', () => ({
    adminDb: { doc: jest.fn(() => ({ get: mockGet })) },
    isAdminRoll: jest.fn(() => false),
}));

const { adminDb } = require('../_firebase-admin');
const { getRevocation, blockIfRevoked, _clearRevocationCache } = require('../_revocation');

const fakeRes = () => {
    const res = { statusCode: null, body: null };
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (payload) => { res.body = payload; return res; };
    return res;
};

const notRevoked = () => Promise.resolve({ exists: false });
const revokedWith = (reason) => Promise.resolve({ exists: true, data: () => ({ reason }) });

beforeEach(() => {
    jest.clearAllMocks();
    _clearRevocationCache();
    adminDb.doc.mockImplementation(() => ({ get: mockGet }));
});

describe('blockIfRevoked', () => {
    test('blocks a revoked roll with 403 and the admin-supplied reason', async () => {
        mockGet.mockImplementation(() => revokedWith('Shared account'));
        const res = fakeRes();

        expect(await blockIfRevoked(res, '2410990123')).toBe(true);
        expect(res.statusCode).toBe(403);
        expect(res.body).toEqual({ error: 'Shared account', revoked: true });
    });

    test('lets a non-revoked roll through and sends nothing', async () => {
        mockGet.mockImplementation(notRevoked);
        const res = fakeRes();

        expect(await blockIfRevoked(res, '2410990123')).toBe(false);
        expect(res.statusCode).toBeNull();
    });

    test('reads the revocation doc for the exact roll number', async () => {
        mockGet.mockImplementation(notRevoked);
        await blockIfRevoked(fakeRes(), '  2410990123  ');
        expect(adminDb.doc).toHaveBeenCalledWith('admin/revokedUsers/items/2410990123');
    });

    test('falls back to a default reason when the admin gave none', async () => {
        mockGet.mockImplementation(() => Promise.resolve({ exists: true, data: () => ({}) }));
        const res = fakeRes();

        await blockIfRevoked(res, '2410990123');
        expect(res.body.revoked).toBe(true);
        expect(res.body.error).toMatch(/revoked/i);
    });
});

describe('failing open', () => {
    test('a Firestore outage does NOT lock a user out', async () => {
        mockGet.mockImplementation(() => Promise.reject(new Error('UNAVAILABLE')));
        const res = fakeRes();

        expect(await blockIfRevoked(res, '2410990123')).toBe(false);
        expect(res.statusCode).toBeNull();
    });

    test('an outage still serves the last known verdict for a revoked user', async () => {
        mockGet.mockImplementation(() => revokedWith('Abuse'));
        expect(await getRevocation('2410990123')).toMatchObject({ reason: 'Abuse' });

        _clearRevocationCache();
        // Warm the cache, then break Firestore and expire the TTL.
        mockGet.mockImplementation(() => revokedWith('Abuse'));
        await getRevocation('2410990123');
        mockGet.mockImplementation(() => Promise.reject(new Error('UNAVAILABLE')));
        jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 120000);

        expect(await getRevocation('2410990123')).toMatchObject({ reason: 'Abuse' });
        Date.now.mockRestore();
    });

    test('a missing roll number is never treated as revoked', async () => {
        expect(await getRevocation(null)).toBeNull();
        expect(await getRevocation('   ')).toBeNull();
        expect(mockGet).not.toHaveBeenCalled();
    });
});

describe('TTL cache', () => {
    test('repeat checks inside the TTL hit Firestore once', async () => {
        mockGet.mockImplementation(notRevoked);

        await blockIfRevoked(fakeRes(), '2410990123');
        await blockIfRevoked(fakeRes(), '2410990123');
        await blockIfRevoked(fakeRes(), '2410990123');

        expect(mockGet).toHaveBeenCalledTimes(1);
    });

    test('a revoke takes effect once the TTL expires', async () => {
        mockGet.mockImplementation(notRevoked);
        expect(await blockIfRevoked(fakeRes(), '2410990123')).toBe(false);

        mockGet.mockImplementation(() => revokedWith('Revoked now'));
        jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 120000);

        expect(await blockIfRevoked(fakeRes(), '2410990123')).toBe(true);
        Date.now.mockRestore();
    });

    test('caches per roll number — one revoked user does not block another', async () => {
        mockGet
            .mockImplementationOnce(() => revokedWith('Abuse'))
            .mockImplementationOnce(notRevoked);

        expect(await blockIfRevoked(fakeRes(), '2410990111')).toBe(true);
        expect(await blockIfRevoked(fakeRes(), '2410990222')).toBe(false);
    });
});
