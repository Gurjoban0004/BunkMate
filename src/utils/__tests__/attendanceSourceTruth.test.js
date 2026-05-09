import { getSubjectAttendance } from '../attendance';
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

    expect(getSubjectAttendance('math', state)).toEqual({
      attendedUnits: 9,
      totalUnits: 11,
      percentage: 81.8,
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

    expect(getSubjectAttendance('math', state)).toEqual({
      attendedUnits: 9,
      totalUnits: 11,
      percentage: 81.8,
      hasPredictions: true,
    });
  });
});
