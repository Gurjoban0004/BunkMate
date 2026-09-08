/**
 * The client half of the research dataset: the participant UUID exists, and it
 * rides on every request that parses the register or the timetable server-side.
 *
 * This is the failure nobody notices. The server files a row only when the body
 * carries `researchId`; if the client stops attaching it — a renamed endpoint, a
 * dropped entry in RESEARCH_ENDPOINTS, a UUID that never gets minted — every
 * sync still succeeds, the app still works, and the dataset just stays empty.
 */

const mockStore = new Map();
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(async (k) => (mockStore.has(k) ? mockStore.get(k) : null)),
    setItem: jest.fn(async (k, v) => { mockStore.set(k, v); }),
    removeItem: jest.fn(async (k) => { mockStore.delete(k); }),
    multiSet: jest.fn(async (pairs) => { pairs.forEach(([k, v]) => mockStore.set(k, v)); }),
    multiRemove: jest.fn(async (keys) => { keys.forEach((k) => mockStore.delete(k)); }),
}));
jest.mock('../../storage/erpTokenStorage', () => ({
    updateErpToken: jest.fn(async () => {}),
    getDeviceId: jest.fn(async () => 'DEADBEEF-0000-0000-0000-00000000BEEF'),
}));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KNOWN_UUID = '3f2a9c14-8b7d-4e6a-9c21-7d5e0f1a2b3c';

const bodyOf = (call) => JSON.parse(call[1].body);
const okFetch = () => jest.fn(async () => ({
    ok: true, status: 200, text: async () => JSON.stringify({ success: true }),
}));

beforeEach(() => { mockStore.clear(); jest.resetModules(); });

describe('participant UUID', () => {
    it('is minted on first read and kept from then on — no consent step to gate it', async () => {
        const { getResearchId, getConsentedAt } = require('../../storage/researchStorage');
        const first = await getResearchId();
        expect(first).toMatch(UUID_RE);
        // The same id must come back after a reload, or every launch files a new row.
        jest.resetModules();
        const again = await require('../../storage/researchStorage').getResearchId();
        expect(again).toBe(first);
        expect(await getConsentedAt()).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('matches the UUID shape the server validates before writing', async () => {
        const id = await require('../../storage/researchStorage').getResearchId();
        // api/_research.js RESEARCH_ID — a mismatch here silently drops every row.
        expect(new RegExp(UUID_RE.source, 'i').test(id)).toBe(true);
    });
});

describe('requests that carry the dataset', () => {
    it('tags attendance, calendar and timetable with the UUID', async () => {
        global.fetch = okFetch();
        const erp = require('../erpService');
        const { getResearchId } = require('../../storage/researchStorage');
        const id = await getResearchId();

        await erp.erpFetchAttendance('tok', 'ptok');
        await erp.erpFetchCalendar('tok', 'ptok');
        await erp.erpFetchTimetable('tok', 'ptok');

        const calls = global.fetch.mock.calls;
        expect(calls.map((c) => String(c[0]))).toEqual([
            expect.stringContaining('/api/erp-attendance'),
            expect.stringContaining('/api/erp-calendar'),
            expect.stringContaining('/api/erp-timetable'),
        ]);
        for (const call of calls) {
            expect(bodyOf(call).researchId).toBe(id);
            expect(bodyOf(call).consentedAt).toMatch(/^\d{4}-/);
        }
    });

    // The bug this pins: one shared upload clock. The register writes `marks` and
    // the timetable writes `slots`; with a single timestamp whichever request went
    // first consumed the window and the other half of the row was never written.
    it('throttles each endpoint on its own clock, not one shared one', async () => {
        global.fetch = okFetch();
        const erp = require('../erpService');
        const id = await require('../../storage/researchStorage').getResearchId();

        await erp.erpFetchAttendance('tok', 'ptok');
        await erp.erpFetchTimetable('tok', 'ptok');
        // Same sync again, inside the six-hour window.
        await erp.erpFetchAttendance('tok', 'ptok');
        await erp.erpFetchTimetable('tok', 'ptok');

        const tagged = global.fetch.mock.calls.map((c) => bodyOf(c).researchId);
        expect(tagged).toEqual([id, id, undefined, undefined]);
    });

    // Both halves of the throttle, driven from stored state so no module has to be
    // reloaded mid-test: a fresh timestamp suppresses, a stale one lets it through.
    it.each([
        ['a fresh upload suppresses the next one', 60e3, undefined],
        ['a window older than six hours uploads again', 6 * 3600e3 + 60e3, KNOWN_UUID],
    ])('%s', async (_name, agoMs, expected) => {
        mockStore.set('@presence_research_id', KNOWN_UUID);
        mockStore.set('@presence_research_consented_at', '2026-09-01T00:00:00.000Z');
        mockStore.set('@presence_research_uploaded_at:/api/erp-attendance', String(Date.now() - agoMs));

        global.fetch = okFetch();
        await require('../erpService').erpFetchAttendance('tok', 'ptok');

        expect(bodyOf(global.fetch.mock.calls[0]).researchId).toBe(expected);
    });

    it('never puts the UUID on a sign-in request', async () => {
        global.fetch = okFetch();
        const erp = require('../erpService');
        await erp.erpLogin('2410990001', 'pw');
        await erp.erpVerifyOtp('ticket', '1234');
        for (const call of global.fetch.mock.calls) {
            expect(bodyOf(call).researchId).toBeUndefined();
        }
    });

    it('sends the password only to the sign-in endpoint', async () => {
        global.fetch = okFetch();
        const erp = require('../erpService');
        await erp.erpLogin('2410990001', 'hunter2');
        await erp.erpFetchAttendance('tok', 'ptok');
        const [login, attendance] = global.fetch.mock.calls;
        expect(bodyOf(login).password).toBe('hunter2');
        expect(JSON.stringify(bodyOf(attendance))).not.toContain('hunter2');
    });
});
