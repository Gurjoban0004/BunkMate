import {
    getPlannerEndDate,
    getUpcomingSubjectClasses,
    getPlannableSubjectClasses,
    isWithinPlannerWindow,
} from '../semesterWindow';

describe('semesterWindow planner helpers', () => {
    const state = {
        subjects: [{ id: 'math', name: 'Math', initialAttended: 0, initialTotal: 0 }],
        settings: { semesterEndDate: '2026-05-08T00:00:00.000Z' },
        holidays: ['2026-05-06'],
        timetable: {
            Monday: [{ slotId: 'slot-1', subjectId: 'math' }],
            Wednesday: [{ slotId: 'slot-1', subjectId: 'math' }],
            Friday: [{ slotId: 'slot-1', subjectId: 'math' }],
        },
        timeSlots: [{ id: 'slot-1', start: '09:00', end: '10:00' }],
    };

    test('parses semester end dates as the local end of that calendar day', () => {
        const endDate = getPlannerEndDate(state);

        expect(endDate.getFullYear()).toBe(2026);
        expect(endDate.getMonth()).toBe(4);
        expect(endDate.getDate()).toBe(8);
        expect(endDate.getHours()).toBe(23);
        expect(endDate.getMinutes()).toBe(59);
    });

    test('rejects classes after the configured semester end date', () => {
        expect(isWithinPlannerWindow('2026-05-08', state)).toBe(true);
        expect(isWithinPlannerWindow('2026-05-09', state)).toBe(false);
    });

    test('returns only relevant upcoming subject classes before semester end and skips holidays', () => {
        const classes = getUpcomingSubjectClasses(state, 'math', {
            fromDate: new Date(2026, 4, 4, 12, 0, 0),
            maxClasses: 14,
        });

        expect(classes.map(cls => cls.dateKey)).toEqual(['2026-05-08']);
        expect(classes.every(cls => cls.subjectId === 'math')).toBe(true);
    });

    test('does not invent weekday classes when the actual timetable has no remaining sessions', () => {
        const classes = getPlannableSubjectClasses(state, 'math', { fromDate: new Date(2026, 4, 7), maxDays: 1 });
        expect(classes.map((cls) => cls.dateKey)).toEqual(['2026-05-08']);
        expect(getPlannableSubjectClasses(state, 'math', { fromDate: new Date(2026, 4, 8) })).toEqual([]);
    });

    test('excludes register holidays and cancelled classes from real and estimated calendars', () => {
        const input = { ...state, holidays: [], attendanceRecords: { '2026-05-06': { _holiday: true }, '2026-05-08': { math: { status: 'cancelled' } } } };
        const options = { fromDate: new Date(2026, 4, 4) };
        expect(getPlannableSubjectClasses(input, 'math', options)).toEqual([]);
        expect(getPlannableSubjectClasses({ ...input, timetable: {} }, 'math', options).map((cls) => cls.dateKey)).toEqual(['2026-05-05', '2026-05-07']);
    });
});
