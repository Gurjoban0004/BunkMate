/**
 * The one rule: attendance is what the college says, and nothing the app
 * does on its own can move it. These pin the three ways the old model drifted
 * above the college — auto-marked predictions, manual marks, and "bridge"
 * records the sync never got round to garbage-collecting.
 */
jest.mock('firebase/firestore');
jest.mock('firebase/auth', () => ({ getAuth: jest.fn(), signInWithCustomToken: jest.fn() }));
jest.mock('../../config/firebase', () => ({ db: {}, auth: {} }));

import { appReducer, keepOnlyErpRecords } from '../../context/AppContext';
import { getSubjectAttendance, calculateOverallPercentage } from '../attendance';

const base = () => ({
    subjects: [
        { id: 'adi', name: 'Algorithm Design', initialAttended: 30, initialTotal: 40, erpSubjectId: '1' },
        { id: 'dbms', name: 'DBMS', initialAttended: 18, initialTotal: 20, erpSubjectId: '2' },
    ],
    attendanceRecords: {},
    holidays: [],
    timetable: { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [] },
    timetableMeta: { source: 'none' },
    timeSlots: [],
    settings: { dangerThreshold: 75 },
});

describe('totals are the college’s totals, exactly', () => {
    test('records of any kind never add to the totals', () => {
        const state = base();
        state.attendanceRecords = {
            '2026-09-01': { adi: { status: 'present', units: 2, source: 'manual' } },
            '2026-09-02': { adi: { status: 'present', units: 2, source: 'prediction', autoMarked: true } },
            '2026-09-03': { adi: { status: 'present', units: 2, attendedUnits: 2, source: 'erp' } },
        };
        expect(getSubjectAttendance('adi', state)).toMatchObject({ attendedUnits: 30, totalUnits: 40, percentage: 75 });
        expect(calculateOverallPercentage(state)).toBe((48 * 100) / 60);
    });

    test('attended can never exceed total', () => {
        const state = base();
        state.subjects[0] = { ...state.subjects[0], initialAttended: 45, initialTotal: 40 };
        expect(getSubjectAttendance('adi', state)).toMatchObject({ attendedUnits: 40, totalUnits: 40, percentage: 100 });
    });
});

describe('the college can correct itself downward', () => {
    test('ERP_OVERWRITE_ATTENDANCE applies a lower total', () => {
        const next = appReducer(base(), {
            type: 'ERP_OVERWRITE_ATTENDANCE',
            payload: { updates: [{ subjectId: 'adi', newAttended: 28, newTotal: 38, source: 'erp', lastUpdated: 'x' }] },
        });
        expect(getSubjectAttendance('adi', next)).toMatchObject({ attendedUnits: 28, totalUnits: 38 });
    });
});

describe('LOAD_STATE migration strips everything that is not from the college', () => {
    test('manual and predicted marks vanish; register records and holidays stay', () => {
        const saved = {
            ...base(),
            userId: 'PRES-AAAAAAA',
            attendanceRecords: {
                '2026-09-01': { adi: { status: 'present', units: 1, source: 'manual' }, dbms: { status: 'present', units: 1, attendedUnits: 1, source: 'erp' } },
                '2026-09-02': { adi: { status: 'present', units: 1, source: 'prediction', autoMarked: true } },
                '2026-09-03': { _holiday: true },
                '2026-09-04': { dbms: { status: 'absent', units: 1, attendedUnits: 0, source: 'erp' }, _holiday: true },
            },
            autopilotReview: { date: '2026-09-02', count: 1 },
            autopilotDismissed: { 'x': true },
            erpReauthSnoozeUntil: 123,
            todayIncludedInSetup: false,
            settings: { dangerThreshold: 75, weeklySummaryEnabled: true, notificationTime: '18:00' },
        };
        const next = appReducer(undefined ?? base(), { type: 'LOAD_STATE', payload: saved });
        expect(next.attendanceRecords).toEqual({
            '2026-09-01': { dbms: { status: 'present', units: 1, attendedUnits: 1, source: 'erp' } },
            '2026-09-03': { _holiday: true },
            '2026-09-04': { dbms: { status: 'absent', units: 1, attendedUnits: 0, source: 'erp' }, _holiday: true },
        });
        expect(next.autopilotReview).toBeUndefined();
        expect(next.autopilotDismissed).toBeUndefined();
        expect(next.erpReauthSnoozeUntil).toBeUndefined();
        expect(next.todayIncludedInSetup).toBeUndefined();
        expect(next.settings.weeklySummaryEnabled).toBeUndefined();
        // the old evening "mark your attendance" nudge becomes the morning plan
        expect(next.settings.notificationTime).toBe('07:30');
        expect(next.erpSessionExpired).toBeNull();
        expect(next.erpReconnectOpen).toBe(false);
    });

    test('keepOnlyErpRecords drops days left with nothing', () => {
        expect(keepOnlyErpRecords({ '2026-09-01': { adi: { status: 'present', source: 'manual' } } })).toEqual({});
    });
});

describe('the register replaces history when it covers every subject', () => {
    test('a class the college removed disappears; a partial register only merges', () => {
        const state = base();
        state.attendanceRecords = {
            '2026-09-01': { adi: { status: 'present', units: 1, attendedUnits: 1, source: 'erp' }, dbms: { status: 'present', units: 1, attendedUnits: 1, source: 'erp' } },
            '2026-09-02': { adi: { status: 'absent', units: 1, attendedUnits: 0, source: 'erp' } },
            '2026-09-05': { _holiday: true },
        };
        // Full register: both subjects present, 09-02 no longer listed.
        const full = appReducer(state, {
            type: 'ERP_OVERWRITE_CALENDAR',
            payload: { records: {
                '2026-09-01': { adi: { status: 'present', units: 1, attendedUnits: 1, source: 'erp' }, dbms: { status: 'present', units: 1, attendedUnits: 1, source: 'erp' } },
                '2026-09-03': { adi: { status: 'present', units: 2, attendedUnits: 2, source: 'erp' } },
            } },
        });
        expect(full.attendanceRecords['2026-09-02']).toBeUndefined();
        expect(full.attendanceRecords['2026-09-05']).toEqual({ _holiday: true });
        expect(full.attendanceRecords['2026-09-03'].adi.units).toBe(2);

        // Partial register (only adi): nothing about dbms is lost.
        const partial = appReducer(state, {
            type: 'ERP_OVERWRITE_CALENDAR',
            payload: { records: { '2026-09-03': { adi: { status: 'present', units: 1, attendedUnits: 1, source: 'erp' } } } },
        });
        expect(partial.attendanceRecords['2026-09-01'].dbms).toBeDefined();
        expect(partial.attendanceRecords['2026-09-02'].adi).toBeDefined();
    });
});

describe('sign-in state', () => {
    test('a dead session only shows the card; the sheet opens on demand and both clear on restore', () => {
        let s = appReducer(base(), { type: 'ERP_SESSION_EXPIRED', payload: { reason: 'dead' } });
        expect(s.erpSessionExpired).toEqual({ reason: 'dead' });
        expect(!!s.erpReconnectOpen).toBe(false);
        s = appReducer(s, { type: 'ERP_RECONNECT_OPEN' });
        expect(s.erpReconnectOpen).toBe(true);
        s = appReducer(s, { type: 'ERP_RECONNECT_CLOSE' });
        expect(s.erpReconnectOpen).toBe(false);
        expect(s.erpSessionExpired).toEqual({ reason: 'dead' });
        s = appReducer(s, { type: 'ERP_SESSION_RESTORED' });
        expect(s.erpSessionExpired).toBeNull();
    });
});
