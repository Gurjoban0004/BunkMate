/**
 * The research dataset's two guards:
 *   - nothing is written unless the request carries a real participant UUID
 *   - a sync never fails or waits because a research write failed
 * Plus the two side-actions (reason, withdraw) the sync endpoints can't carry.
 */

process.env.ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || 'x'.repeat(32);

const mockWrites = [];
const mockDeletes = [];
let mockSetBehaviour = () => Promise.resolve();

jest.mock('firebase-admin/auth', () => ({ getAuth: () => ({}) }));
jest.mock('../_firebase-admin', () => ({
    adminDb: {
        collection: () => ({
            doc: () => ({
                collection: () => ({
                    doc: (id) => ({
                        set: (data, opts) => { mockWrites.push({ id, data, opts }); return mockSetBehaviour(); },
                        delete: () => { mockDeletes.push(id); return Promise.resolve(); },
                    }),
                }),
            }),
        }),
    },
    isAdminRoll: () => false,
}));
jest.mock('firebase-admin/firestore', () => ({
    FieldValue: { arrayUnion: (...items) => ({ __arrayUnion: items }) },
}));
jest.mock('../_rate-limit', () => ({ tooManyAttempts: async () => false }));

const { saveResearch } = require('../_research');
const handler = require('../research');

const UUID = '3f2a9c14-8b7d-4e6a-9c21-7d5e0f1a2b3c';

const mockRes = () => {
    const res = { statusCode: null, body: null, headers: {} };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; return res; };
    res.end = () => res;
    res.setHeader = (k, v) => { res.headers[k] = v; };
    return res;
};
const post = (body) => handler({ method: 'POST', body, headers: {} }, mockRes());

beforeEach(() => { mockWrites.length = 0; mockDeletes.length = 0; mockSetBehaviour = () => Promise.resolve(); });

describe('saveResearch', () => {
    it('writes nothing without a participant UUID — no consent, no row', () => {
        saveResearch(undefined, { marks: [{ d: '2026-08-12', s: 'X', p: 1, a: 0 }] });
        saveResearch('', { marks: [] });
        saveResearch('2410990296', { marks: [] });          // a roll number is not a UUID
        saveResearch('not-a-uuid-at-all', { marks: [] });
        expect(mockWrites).toHaveLength(0);
    });

    it('merges the patch onto the participant document', async () => {
        await saveResearch(UUID, { marks: [{ d: '2026-08-12', s: 'X', p: 1, a: 0 }] }, '2026-09-01T00:00:00Z');
        expect(mockWrites).toHaveLength(1);
        expect(mockWrites[0].id).toBe(UUID);
        expect(mockWrites[0].opts).toEqual({ merge: true });
        expect(mockWrites[0].data.consentedAt).toBe('2026-09-01T00:00:00Z');
        expect(mockWrites[0].data.marks).toHaveLength(1);
    });

    it('swallows a failed write — a sync must not break on it', async () => {
        mockSetBehaviour = () => Promise.reject(new Error('firestore down'));
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        await expect(saveResearch(UUID, { marks: [] })).resolves.toBeUndefined();
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    // The bug this pins: the write used to be fire-and-forget, and a serverless
    // instance can be frozen the moment its response is sent. The first real
    // participant's timetable (30 slots) landed and their marks (~1000 entries)
    // did not — same request cycle, same code, different write duration.
    it('does not resolve until the write has actually settled', async () => {
        let settle;
        mockSetBehaviour = () => new Promise(r => { settle = r; });

        let done = false;
        const pending = saveResearch(UUID, { marks: [] }).then(() => { done = true; });

        await new Promise(r => setImmediate(r));
        expect(done).toBe(false);      // still waiting on Firestore, as it must

        settle();
        await pending;
        expect(done).toBe(true);
    });
});

describe('POST /api/research', () => {
    it('rejects a request that is not carrying a real UUID', async () => {
        const res = await post({ researchId: 'nope', action: 'withdraw' });
        expect(res.statusCode).toBe(400);
        expect(mockDeletes).toHaveLength(0);
    });

    it('records a reason from the fixed list', async () => {
        const res = await post({ researchId: UUID, action: 'reason', d: '2026-08-12', s: '24CSE0317', r: 'slept_in' });
        expect(res.statusCode).toBe(200);
        expect(mockWrites[0].data.reasons.__arrayUnion[0]).toEqual({ d: '2026-08-12', s: '24CSE0317', r: 'slept_in' });
    });

    it('refuses a free-text reason', async () => {
        const res = await post({ researchId: UUID, action: 'reason', d: '2026-08-12', s: '24CSE0317', r: 'overslept lol' });
        expect(res.statusCode).toBe(400);
        expect(mockWrites).toHaveLength(0);
    });

    it('deletes the row on withdrawal', async () => {
        const res = await post({ researchId: UUID, action: 'withdraw' });
        expect(res.statusCode).toBe(200);
        expect(mockDeletes).toEqual([UUID]);
    });
});
