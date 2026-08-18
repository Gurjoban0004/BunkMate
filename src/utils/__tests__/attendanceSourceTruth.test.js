import { getSubjectAttendance } from '../attendance';
import { isNonRegressingErpUpdate } from '../erpAttendanceMapper';
import { calculateProjectionBreakdown } from '../transparency';

const baseState = {
  subjects: [
    {
      id: 'math',
      name: 'Mathematics',
      initialAttended: 8,
      initialTotal: 10,
    },
  ],
  attendanceRecords: {},
  holidays: [],
  settings: {
    lastSubjectSyncDates: {
      math: '2026-05-06',
    },
  },
};

describe('ERP source of truth for local bridge records', () => {
  test('counts manual records only after the latest ERP date for that subject', () => {
    const state = {
      ...baseState,
      attendanceRecords: {
        '2026-05-05': {
          math: { status: 'absent', units: 1, source: 'manual' },
        },
        '2026-05-07': {
          math: { status: 'present', units: 1, source: 'manual' },
        },
      },
    };

    expect(getSubjectAttendance('math', state)).toMatchObject({
      attendedUnits: 9,
      totalUnits: 11,
      percentage: expect.closeTo(81.8, 1),
      hasPredictions: true,
    });
  });

  test('projection breakdown excludes manual records once ERP has caught up to their date', () => {
    const state = {
      ...baseState,
      attendanceRecords: {
        '2026-05-06': {
          math: { status: 'absent', units: 1, source: 'manual' },
        },
        '2026-05-07': {
          math: { status: 'present', units: 1, source: 'manual' },
        },
      },
    };

    expect(calculateProjectionBreakdown(state, 'math')).toEqual({
      erp: { attended: 8, total: 10, percentage: 80 },
      local: { attended: 1, missed: 0, cancelled: 0, total: 1 },
      projected: { attended: 9, total: 11, percentage: 81.8 },
    });
  });

  test('uses the global latest ERP date when a subject-specific sync date is missing', () => {
    const state = {
      ...baseState,
      latestErpDate: '2026-05-07',
      settings: {},
      attendanceRecords: {
        '2026-05-07': {
          math: { status: 'absent', units: 1, source: 'manual' },
        },
        '2026-05-08': {
          math: { status: 'present', units: 1, source: 'manual' },
        },
      },
    };

    expect(getSubjectAttendance('math', state)).toMatchObject({
      attendedUnits: 9,
      totalUnits: 11,
      percentage: expect.closeTo(81.8, 1),
      hasPredictions: true,
    });
  });

  test('normalizes legacy string counts instead of producing corrupted totals', () => {
    const state = {
      ...baseState,
      subjects: [{ ...baseState.subjects[0], initialAttended: '8', initialTotal: '10' }],
      settings: {},
      attendanceRecords: {
        '2026-05-08': { math: { status: 'present', units: '2', source: 'manual' } },
      },
    };

    expect(getSubjectAttendance('math', state)).toMatchObject({
      attendedUnits: 10,
      totalUnits: 12,
      percentage: expect.closeTo(83.3, 1),
      hasPredictions: true,
    });
  });

  test('rejects a partial portal response that would replace confirmed totals with 0%', () => {
    expect(isNonRegressingErpUpdate(
      { initialAttended: 42, initialTotal: 50 },
      { newAttended: 0, newTotal: 0 },
    )).toBe(false);
    expect(isNonRegressingErpUpdate(
      { initialAttended: 42, initialTotal: 50 },
      { newAttended: 43, newTotal: 51 },
    )).toBe(true);
  });
});
