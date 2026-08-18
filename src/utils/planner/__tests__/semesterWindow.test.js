import {
    getPlannerEndDate,
    getUpcomingSubjectClasses,
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
});
