// Mock heavy transitive deps of AppContext — only the reducer is under test.
jest.mock('../../config/firebase', () => ({ db: {} }));
jest.mock('../../utils/firebaseHelpers', () => ({
  initNetworkListener: jest.fn(),
  onNetworkStatusChange: jest.fn(),
}));
jest.mock('../../storage/storage', () => ({
  loadAppState: jest.fn(),
  saveAppState: jest.fn(),
  migrateToFirestore: jest.fn(),
}));
jest.mock('../../storage/erpTokenStorage', () => ({
  getErpToken: jest.fn(),
  getErpPersistentToken: jest.fn(),
}));
jest.mock('../../services/erpService', () => ({
  erpCheckSession: jest.fn(),
  erpFetchAttendance: jest.fn(),
  erpFetchCalendar: jest.fn(),
  erpFetchTimetable: jest.fn(),
  erpKeepAlive: jest.fn(),
}));

import { appReducer } from '../../context/AppContext';
import { getSubjectAttendance } from '../attendance';
import { isNonRegressingErpUpdate } from '../erpAttendanceMapper';

const makeState = (overrides = {}) => ({
  subjects: [
    { id: 'math', name: 'Mathematics', initialAttended: 8, initialTotal: 10 },
    { id: 'physics', name: 'Physics', initialAttended: 6, initialTotal: 8 },
  ],
  attendanceRecords: {},
  holidays: [],
  timetable: { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [] },
  timetableMeta: { source: 'none' },
  timeSlots: [],
  settings: {},
  ...overrides,
});

// ─── Calendar GC Tests ──────────────────────────────────────────────────

describe('ERP_OVERWRITE_CALENDAR GC — only deletes records with ERP replacement', () => {
  test('keeps local bridge records when ERP has no data for that date+subject', () => {
    const state = makeState({
      attendanceRecords: {
        '2026-07-06': { math: { status: 'present', units: 1, source: 'manual' } },
        '2026-07-07': { math: { status: 'present', units: 1, source: 'prediction' } },
        '2026-07-08': { physics: { status: 'absent', units: 1, source: 'manual' } },
      },
    });

    // ERP calendar only has data for 2026-07-06 math — not 07 or 08
    const next = appReducer(state, {
      type: 'ERP_OVERWRITE_CALENDAR',
      payload: {
        records: {
          '2026-07-06': { math: { status: 'present', units: 1, source: 'erp' } },
        },
        trackingStartDate: '2026-07-06',
        latestErpDate: '2026-07-08',
        lastSubjectSyncDates: { math: '2026-07-08' },
        erpSubjectIdStamps: {},
      },
    });

    // 07-06 math: ERP provided a replacement → local bridge should be replaced by ERP data
    expect(next.attendanceRecords['2026-07-06'].math.source).toBe('erp');

    // 07-07 math: NO ERP replacement → local bridge record must survive
    expect(next.attendanceRecords['2026-07-07'].math).toBeDefined();
    expect(next.attendanceRecords['2026-07-07'].math.source).toBe('prediction');

    // 07-08 physics: NO ERP replacement → must survive
    expect(next.attendanceRecords['2026-07-08'].physics).toBeDefined();
    expect(next.attendanceRecords['2026-07-08'].physics.source).toBe('manual');
  });

  test('deletes local bridge record when ERP provides a replacement for that exact slot', () => {
    const state = makeState({
      attendanceRecords: {
        '2026-07-06': { math: { status: 'present', units: 1, source: 'prediction' } },
      },
    });

    const next = appReducer(state, {
      type: 'ERP_OVERWRITE_CALENDAR',
      payload: {
        records: {
          '2026-07-06': { math: { status: 'absent', units: 1, source: 'erp' } },
        },
        trackingStartDate: '2026-07-06',
        latestErpDate: '2026-07-06',
        lastSubjectSyncDates: { math: '2026-07-06' },
        erpSubjectIdStamps: {},
      },
    });

    // ERP provided replacement → local prediction gone, ERP data present
    expect(next.attendanceRecords['2026-07-06'].math.source).toBe('erp');
    expect(next.attendanceRecords['2026-07-06'].math.status).toBe('absent');
  });

  test('leaves ERP-sourced records untouched by GC', () => {
    const state = makeState({
      attendanceRecords: {
        '2026-07-06': { math: { status: 'present', units: 1, source: 'erp' } },
      },
    });

    const next = appReducer(state, {
      type: 'ERP_OVERWRITE_CALENDAR',
      payload: {
        records: {},
        trackingStartDate: '2026-07-06',
        latestErpDate: '2026-07-08',
        lastSubjectSyncDates: {},
        erpSubjectIdStamps: {},
      },
    });

    // GC only targets 'prediction' and 'manual', not 'erp'
    expect(next.attendanceRecords['2026-07-06'].math.source).toBe('erp');
  });

  test('preserves attendance totals after calendar sync with gaps', () => {
    const state = makeState({
      subjects: [
        { id: 'math', name: 'Mathematics', initialAttended: 8, initialTotal: 10 },
      ],
      attendanceRecords: {
        '2026-07-06': { math: { status: 'present', units: 1, source: 'manual' } },
        '2026-07-07': { math: { status: 'present', units: 1, source: 'manual' } },
        '2026-07-08': { math: { status: 'absent', units: 1, source: 'manual' } },
      },
    });

    // ERP only has day 06 and 08 but not 07 (gap — e.g. not marked yet)
    const next = appReducer(state, {
      type: 'ERP_OVERWRITE_CALENDAR',
      payload: {
        records: {
          '2026-07-06': { math: { status: 'present', units: 1, source: 'erp' } },
          '2026-07-08': { math: { status: 'absent', units: 1, source: 'erp' } },
        },
        trackingStartDate: '2026-07-06',
        latestErpDate: '2026-07-08',
        lastSubjectSyncDates: { math: '2026-07-08' },
        erpSubjectIdStamps: {},
      },
    });

    // Day 07 bridge record should survive (ERP had no replacement)
    expect(next.attendanceRecords['2026-07-07'].math).toBeDefined();
    expect(next.attendanceRecords['2026-07-07'].math.source).toBe('manual');

    // Days 06 and 08 should be ERP data
    expect(next.attendanceRecords['2026-07-06'].math.source).toBe('erp');
    expect(next.attendanceRecords['2026-07-08'].math.source).toBe('erp');

    // The bridge record for day 07 is preserved (not GC'd — no ERP replacement exists),
    // but shouldCountLocalRecord won't count it toward totals because
    // lastSubjectSyncDates.math = '2026-07-08' covers that date.
    // Totals come from ERP summary only: initialTotal=10, initialAttended=8
    const stats = getSubjectAttendance('math', next);
    expect(stats.totalUnits).toBe(10);
    expect(stats.attendedUnits).toBe(8);
  });
});

// ─── Non-regression guard tests ─────────────────────────────────────────

describe('isNonRegressingErpUpdate', () => {
  test('accepts normal forward update', () => {
    const existing = { initialTotal: 10, initialAttended: 8 };
    const update = { newTotal: 12, newAttended: 9 };
    expect(isNonRegressingErpUpdate(existing, update)).toBe(true);
  });

  test('rejects total regression (portal returned lower total)', () => {
    const existing = { initialTotal: 10, initialAttended: 8 };
    const update = { newTotal: 5, newAttended: 3 };
    expect(isNonRegressingErpUpdate(existing, update)).toBe(false);
  });

  test('rejects attended regression', () => {
    const existing = { initialTotal: 10, initialAttended: 8 };
    const update = { newTotal: 12, newAttended: 7 };
    expect(isNonRegressingErpUpdate(existing, update)).toBe(false);
  });

  test('rejects zero total', () => {
    const existing = { initialTotal: 10, initialAttended: 8 };
    const update = { newTotal: 0, newAttended: 0 };
    expect(isNonRegressingErpUpdate(existing, update)).toBe(false);
  });

  test('rejects attended > total', () => {
    const existing = { initialTotal: 10, initialAttended: 8 };
    const update = { newTotal: 12, newAttended: 15 };
    expect(isNonRegressingErpUpdate(existing, update)).toBe(false);
  });

  test('accepts update for new subject (no existing)', () => {
    const update = { newTotal: 5, newAttended: 4 };
    expect(isNonRegressingErpUpdate(null, update)).toBe(true);
  });

  test('rejects zero-total new subject', () => {
    const update = { newTotal: 0, newAttended: 0 };
    expect(isNonRegressingErpUpdate(null, update)).toBe(false);
  });

  test('accepts same values (no regression)', () => {
    const existing = { initialTotal: 10, initialAttended: 8 };
    const update = { newTotal: 10, newAttended: 8 };
    expect(isNonRegressingErpUpdate(existing, update)).toBe(true);
  });
});
