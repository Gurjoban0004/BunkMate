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

const makeState = (overrides = {}) => ({
  subjects: [
    { id: 'math', name: 'Mathematics', initialAttended: 8, initialTotal: 10 },
  ],
  attendanceRecords: {},
  holidays: [],
  settings: {},
  ...overrides,
});

const erpUpdate = (newAttended, newTotal) => ({
  type: 'ERP_OVERWRITE_ATTENDANCE',
  payload: {
    updates: [{ subjectId: 'math', newAttended, newTotal, source: 'erp', lastUpdated: '2026-07-09T08:00:00Z' }],
  },
});

describe('ERP summary delta GC (register-less portals)', () => {
  test('absorbs the oldest bridge marks when delivered total grows — no double count', () => {
    const state = makeState({
      attendanceRecords: {
        '2026-07-06': { math: { status: 'present', units: 1, source: 'manual' } },
        '2026-07-07': { math: { status: 'absent', units: 1, source: 'prediction' } },
        '2026-07-08': { math: { status: 'present', units: 1, source: 'manual' } },
      },
    });

    // ERP absorbed 2 classes (Mon + Tue): 10 → 12 delivered, 8 → 9 attended
    const next = appReducer(state, erpUpdate(9, 12));

    // Oldest two bridge marks scrapped, Wednesday's mark survives
    expect(next.attendanceRecords['2026-07-06'].math).toBeUndefined();
    expect(next.attendanceRecords['2026-07-07'].math).toBeUndefined();
    expect(next.attendanceRecords['2026-07-08'].math).toBeDefined();

    // Math: ERP baseline 9/12 + surviving bridge mark 1/1 = 10/13
    expect(getSubjectAttendance('math', next)).toMatchObject({
      attendedUnits: 10,
      totalUnits: 13,
      percentage: expect.closeTo(76.9, 1),
      hasPredictions: true,
    });
  });

  test('scraps all bridge marks when the delta covers them all', () => {
    const state = makeState({
      attendanceRecords: {
        '2026-07-06': { math: { status: 'present', units: 1, source: 'manual' } },
        '2026-07-07': { math: { status: 'present', units: 1, source: 'manual' } },
      },
    });

    const next = appReducer(state, erpUpdate(10, 13)); // delta 3 >= 2 marks

    expect(next.attendanceRecords['2026-07-06'].math).toBeUndefined();
    expect(next.attendanceRecords['2026-07-07'].math).toBeUndefined();
    expect(getSubjectAttendance('math', next)).toMatchObject({
      attendedUnits: 10,
      totalUnits: 13,
      percentage: expect.closeTo(76.9, 1),
      hasPredictions: false,
    });
  });

  test('leaves bridge marks alone when totals did not grow', () => {
    const state = makeState({
      attendanceRecords: {
        '2026-07-08': { math: { status: 'present', units: 1, source: 'manual' } },
      },
    });

    const next = appReducer(state, erpUpdate(8, 10)); // same totals

    expect(next.attendanceRecords['2026-07-08'].math).toBeDefined();
    expect(getSubjectAttendance('math', next).totalUnits).toBe(11);
  });

  test('skips cancelled marks and holiday dates when absorbing the delta', () => {
    const state = makeState({
      holidays: ['2026-07-06'],
      attendanceRecords: {
        '2026-07-06': { math: { status: 'present', units: 1, source: 'manual' } }, // holiday
        '2026-07-07': { math: { status: 'cancelled', units: 1, source: 'manual' } },
        '2026-07-08': { math: { status: 'present', units: 1, source: 'manual' } },
      },
    });

    const next = appReducer(state, erpUpdate(9, 11)); // delta 1

    // Holiday + cancelled marks untouched; the real mark is the one absorbed
    expect(next.attendanceRecords['2026-07-06'].math).toBeDefined();
    expect(next.attendanceRecords['2026-07-07'].math).toBeDefined();
    expect(next.attendanceRecords['2026-07-08'].math).toBeUndefined();
    expect(getSubjectAttendance('math', next)).toMatchObject({
      attendedUnits: 9,
      totalUnits: 11,
      percentage: expect.closeTo(81.8, 1),
      hasPredictions: false,
    });
  });

  test('a 2-unit mark counts as 2 toward the delta', () => {
    const state = makeState({
      attendanceRecords: {
        '2026-07-06': { math: { status: 'present', units: 2, source: 'manual' } },
        '2026-07-07': { math: { status: 'present', units: 1, source: 'manual' } },
      },
    });

    const next = appReducer(state, erpUpdate(10, 12)); // delta 2 = the 2-unit mark

    expect(next.attendanceRecords['2026-07-06'].math).toBeUndefined();
    expect(next.attendanceRecords['2026-07-07'].math).toBeDefined();
    expect(getSubjectAttendance('math', next).totalUnits).toBe(13); // 12 + 1
  });
});

describe('EDIT_ATTENDANCE source ownership', () => {
  test('editing a portal-confirmed record makes it a user mark', () => {
    const state = makeState({
      attendanceRecords: {
        '2026-07-06': { math: { status: 'absent', units: 1, source: 'erp' } },
      },
    });

    const next = appReducer(state, {
      type: 'EDIT_ATTENDANCE',
      payload: { date: '2026-07-06', subjectId: 'math', newStatus: 'present' },
    });

    expect(next.attendanceRecords['2026-07-06'].math.source).toBe('manual');
    expect(next.attendanceRecords['2026-07-06'].math.status).toBe('present');
  });
});

describe('empty timetable artifact cleanup', () => {
  test('removes only the unmatched empty ERP subject and its timetable slots', () => {
    const state = makeState({
      subjects: [
        { id: 'math', name: 'Mathematics', initialAttended: 8, initialTotal: 10 },
        { id: 'group-cell', name: 'Group elective', code: 'GROUP', source: 'erp', initialAttended: 0, initialTotal: 0 },
      ],
      timetable: { Monday: [{ subjectId: 'math' }, { subjectId: 'group-cell' }] },
      attendanceRecords: { '2026-07-09': { 'group-cell': { status: 'present', units: 1 } } },
    });

    const next = appReducer(state, {
      type: 'PRUNE_UNMATCHED_EMPTY_ERP_SUBJECTS',
      payload: ['group-cell'],
    });

    expect(next.subjects.map(subject => subject.id)).toEqual(['math']);
    expect(next.timetable.Monday).toEqual([{ subjectId: 'math' }]);
    expect(next.attendanceRecords['2026-07-09']['group-cell']).toBeUndefined();
  });
});
