/**
 * Insights read the register only. A day the college has not uploaded is not
 * a day the student missed.
 */
import { generateWeeklyReport, getNextClassDay, calculateBestBunkDay } from '../insights';
import { calculateOverallStreak, calculateSubjectStreak } from '../streak';
import { buildDayPlan } from '../notifications';

const TIME_SLOTS = [
    { id: 'p1', start: '09:00', end: '10:00' },
    { id: 'p2', start: '10:00', end: '11:00' },
];

// 2026-09-06 is a Sunday.
const SUNDAY = '2026-09-06T10:00:00';

function makeState(overrides = {}) {
    return {
        subjects: [
            { id: 'adi', name: 'Algorithm Design', color: '#111', initialAttended: 30, initialTotal: 40 },
            { id: 'dbms', name: 'DBMS', color: '#222', initialAttended: 15, initialTotal: 20 },
        ],
        timeSlots: TIME_SLOTS,
        timetable: {
            Monday: [{ slotId: 'p1', subjectId: 'adi' }, { slotId: 'p2', subjectId: 'dbms' }],
            Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [],
        },
        attendanceRecords: {},
        holidays: [],
        settings: { dangerThreshold: 75 },
        devDate: SUNDAY,
        ...overrides,
    };
}

describe('generateWeeklyReport', () => {
    test('counts only register records; an unrecorded scheduled day is not a miss', () => {
        const state = makeState({
            attendanceRecords: {
                // Mon 31 Aug — recorded: adi present, dbms absent
                '2026-08-31': {
                    adi: { status: 'present', units: 1, attendedUnits: 1, source: 'erp' },
                    dbms: { status: 'absent', units: 1, attendedUnits: 0, source: 'erp' },
                },
                // Wed 2 Sep — a stray manual mark must be ignored
                '2026-09-02': { adi: { status: 'absent', units: 1, source: 'manual' } },
            },
        });
        const r = generateWeeklyReport(state);
        expect(r.weekTotal).toBe(2);
        expect(r.weekAttended).toBe(1);
        expect(r.weekPercentage).toBe(50);
        expect(r.daysTracked).toBe(1);
        expect(r.bestSubject.name).toBe('Algorithm Design');
        expect(r.worstSubject.name).toBe('DBMS');
    });

    test('an empty week is honest, not zero-percent', () => {
        const r = generateWeeklyReport(makeState());
        expect(r.weekTotal).toBe(0);
        expect(r.daysTracked).toBe(0);
        expect(r.bestSubject).toBeNull();
    });
});

describe('getNextClassDay', () => {
    test('finds Monday from a Sunday with a verdict per class', () => {
        const next = getNextClassDay(makeState());
        expect(next.dayName).toBe('Monday');
        expect(next.isTomorrow).toBe(true);
        expect(next.classes.map((c) => [c.subjectId, c.safe])).toEqual([
            ['adi', false],  // exactly 75%: no margin
            ['dbms', false], // exactly 75%
        ]);
    });

    test('skips a holiday', () => {
        const next = getNextClassDay(makeState({ holidays: ['2026-09-07'] }));
        // Monday 7th is a holiday; the timetable only has Mondays → the 14th
        expect(next.dateKey).toBe('2026-09-14');
    });
});

describe('streaks ignore days the college has not recorded', () => {
    test('a gap between recorded days does not break the streak', () => {
        const state = makeState({
            attendanceRecords: {
                '2026-08-24': { adi: { status: 'present', units: 2, attendedUnits: 2, source: 'erp' } },
                // 31 Aug scheduled but not uploaded — nothing here
                '2026-09-01': { adi: { status: 'present', units: 1, attendedUnits: 1, source: 'erp' } },
            },
        });
        expect(calculateOverallStreak(state)).toBe(3);
        expect(calculateSubjectStreak('adi', state)).toBe(3);
    });

    test('an absence ends it', () => {
        const state = makeState({
            attendanceRecords: {
                '2026-08-24': { adi: { status: 'present', units: 2, attendedUnits: 2, source: 'erp' } },
                '2026-08-25': { adi: { status: 'absent', units: 1, attendedUnits: 0, source: 'erp' } },
                '2026-09-01': { adi: { status: 'present', units: 1, attendedUnits: 1, source: 'erp' } },
            },
        });
        expect(calculateOverallStreak(state)).toBe(1);
    });
});

describe('calculateBestBunkDay prefers a safe day', () => {
    test('marks a day unsafe when any subject cannot absorb its classes', () => {
        const r = calculateBestBunkDay(makeState());
        const monday = r.days.find((d) => d.day === 'Monday');
        expect(monday.safe).toBe(false);
        expect(r.bestDaySafe).toBe(false);
    });
});

describe('buildDayPlan (Android morning notification)', () => {
    test('says exactly what the numbers allow', () => {
        const state = makeState({
            subjects: [
                { id: 'adi', name: 'Algorithm Design', initialAttended: 36, initialTotal: 40 },  // 90%, can skip
                { id: 'dbms', name: 'DBMS', initialAttended: 15, initialTotal: 20 },            // 75%, no margin
            ],
        });
        const plan = buildDayPlan(state, new Date('2026-09-07T07:30:00')); // Monday
        expect(plan.title).toBe('Monday: 2 classes');
        expect(plan.body).toBe('Skip Algorithm Design if you must. Attend DBMS.');
    });

    test('nothing on a day with no classes or a holiday', () => {
        expect(buildDayPlan(makeState(), new Date('2026-09-08T07:30:00'))).toBeNull();
        expect(buildDayPlan(makeState({ holidays: ['2026-09-07'] }), new Date('2026-09-07T07:30:00'))).toBeNull();
    });
});
