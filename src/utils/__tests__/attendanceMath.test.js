import fc from 'fast-check';
import {
    calculatePercentage,
    maxSkippableUnits,
    unitsToReachTarget,
    unitsToSkippableClasses,
    unitsToNeededClasses,
    calculateSkips,
    getSubjectSessionUnits,
    getSubjectSkipBudget,
    getClassesForDay,
    recordUnits,
    recordAttendedUnits,
} from '../attendance';
import { canSkipClass, getEndGameStats } from '../planner';
import { getRiskLevel } from '../endgame';

/**
 * College rule: a 2-hour class is ONE class covering two ERP periods, and it is
 * all-or-nothing — attend one hour and leave, you get nothing for either.
 * So the maths runs in periods (what the ERP counts) and only ever reports
 * whole classes to the student.
 */

// ── Building blocks ─────────────────────────────────────────────────
const TIME_SLOTS = [
    { id: 'p1', start: '09:00', end: '10:00' },
    { id: 'p2', start: '10:00', end: '11:00' },
    { id: 'p3', start: '11:00', end: '12:00' },
    { id: 'p4', start: '13:00', end: '14:00' },
];

function makeState({ timetable = {}, subjects, records = {}, holidays = [] } = {}) {
    return {
        subjects: subjects || [{ id: 'math', name: 'Math', initialAttended: 0, initialTotal: 0, target: 75 }],
        timeSlots: TIME_SLOTS,
        timetable,
        attendanceRecords: records,
        holidays,
        settings: {},
    };
}

// ── Closed-form solvers: the predicate must hold exactly at the boundary ──
describe('skip / recovery solvers are exact at the boundary', () => {
    const args = fc.tuple(
        fc.integer({ min: 0, max: 400 }),
        fc.integer({ min: 1, max: 400 }),
        fc.integer({ min: 1, max: 99 })
    ).map(([a, t, p]) => [Math.min(a, t), t, p]);

    it('maxSkippableUnits returns the largest safe skip and no more', () => {
        fc.assert(fc.property(args, ([attended, total, target]) => {
            const s = maxSkippableUnits(attended, total, target);
            // one more skip must break the target
            expect(calculatePercentage(attended, total + s + 1)).toBeLessThan(target);
            if (s > 0) {
                expect(calculatePercentage(attended, total + s)).toBeGreaterThanOrEqual(target);
            }
        }));
    });

    it('unitsToReachTarget returns the smallest sufficient run and no less', () => {
        fc.assert(fc.property(args, ([attended, total, target]) => {
            const n = unitsToReachTarget(attended, total, target);
            expect(Number.isFinite(n)).toBe(true);
            expect(calculatePercentage(attended + n, total + n)).toBeGreaterThanOrEqual(target);
            if (n > 0) {
                expect(calculatePercentage(attended + n - 1, total + n - 1)).toBeLessThan(target);
            }
        }));
    });

    it('a subject is either skippable or in recovery, never both', () => {
        fc.assert(fc.property(args, ([attended, total, target]) => {
            const skip = maxSkippableUnits(attended, total, target);
            const need = unitsToReachTarget(attended, total, target);
            expect(skip > 0 && need > 0).toBe(false);
        }));
    });

    it('100% target is unreachable once a period is missed', () => {
        expect(unitsToReachTarget(9, 10, 100)).toBe(Infinity);
        expect(unitsToReachTarget(10, 10, 100)).toBe(0);
    });
});

// ── Rounding must never reach a decision ────────────────────────────
describe('decisions use exact percentages', () => {
    it('an exactly-on-target ratio is not dragged under by float error', () => {
        // 87/150 is exactly 58%. Computed as (87/150)*100 it comes out as
        // 57.99999999999999 and reads as below target.
        expect(calculatePercentage(87, 150)).toBe(58);
        expect(unitsToReachTarget(4, 67, 58)).toBe(83); // lands exactly on 58%
    });

    it('agrees with exact integer arithmetic across the whole grid', () => {
        // The solvers compare integers; calculatePercentage must not disagree.
        for (let total = 1; total <= 160; total++) {
            for (let attended = 0; attended <= total; attended++) {
                for (const target of [50, 58, 65, 75, 80, 85]) {
                    const exact = 100 * attended >= target * total;
                    expect(calculatePercentage(attended, total) >= target).toBe(exact);
                }
            }
        }
    });

    it('74.96% does not count as 75%', () => {
        // 1874 / 2500 = 74.96% — rounds to 75.0 for display
        expect(calculatePercentage(1874, 2500)).toBeCloseTo(74.96, 5);
        expect(maxSkippableUnits(1874, 2500, 75)).toBe(0);
        expect(unitsToReachTarget(1874, 2500, 75)).toBeGreaterThan(0);
        expect(calculateSkips(1874, 2500, 75).status).toBe('danger');
    });
});

// ── The all-or-nothing rule ─────────────────────────────────────────
describe('a 2-hour class is one atomic class worth 2 periods', () => {
    const twoHourTimetable = {
        Monday: [{ slotId: 'p1', subjectId: 'math' }, { slotId: 'p2', subjectId: 'math' }],
    };

    it('merges consecutive periods of one subject into a single 2-unit class', () => {
        const state = makeState({ timetable: twoHourTimetable });
        const classes = getClassesForDay(state, 'Monday');
        expect(classes).toHaveLength(1);
        expect(classes[0].units).toBe(2);
        expect(getSubjectSessionUnits('math', state)).toEqual({ min: 2, max: 2 });
    });

    it('does not merge the same subject across a gap', () => {
        const state = makeState({
            timetable: { Monday: [{ slotId: 'p1', subjectId: 'math' }, { slotId: 'p4', subjectId: 'math' }] },
        });
        const classes = getClassesForDay(state, 'Monday');
        expect(classes).toHaveLength(2);
        expect(getSubjectSessionUnits('math', state)).toEqual({ min: 1, max: 1 });
    });

    it('a 3-period skip budget buys only one 2-hour class', () => {
        expect(unitsToSkippableClasses(3, { min: 2, max: 2 })).toBe(1);
        expect(unitsToSkippableClasses(4, { min: 2, max: 2 })).toBe(2);
        expect(unitsToSkippableClasses(1, { min: 2, max: 2 })).toBe(0);
    });

    it('needing 3 periods means attending two 2-hour classes', () => {
        expect(unitsToNeededClasses(3, { min: 2, max: 2 })).toBe(2);
    });

    it('skipping a 2-hour class is unsafe when only 1 period of slack is left', () => {
        // 76/100 = 76%. One skip → 76/101 = 75.2% (safe). Two → 76/102 = 74.5% (not).
        expect(maxSkippableUnits(76, 100, 75)).toBe(1);
        expect(canSkipClass(76, 100, 1, 75).safe).toBe(true);
        expect(canSkipClass(76, 100, 2, 75).safe).toBe(false);
    });

    it('reports whole classes, not periods, to the student', () => {
        const state = makeState({
            timetable: twoHourTimetable,
            subjects: [{ id: 'math', name: 'Math', initialAttended: 80, initialTotal: 100, target: 75 }],
        });
        const budget = getSubjectSkipBudget('math', state);
        expect(budget.skipUnits).toBe(6);   // 80/106 = 75.47%
        expect(budget.skipClasses).toBe(3); // three 2-hour classes
        expect(budget.onTrack).toBe(true);
    });

    it('mixed session lengths never overstate skips or understate recovery', () => {
        const state = makeState({
            timetable: {
                Monday: [{ slotId: 'p1', subjectId: 'math' }, { slotId: 'p2', subjectId: 'math' }],
                Tuesday: [{ slotId: 'p1', subjectId: 'math' }],
            },
            subjects: [{ id: 'math', name: 'Math', initialAttended: 80, initialTotal: 100, target: 75 }],
        });
        expect(getSubjectSessionUnits('math', state)).toEqual({ min: 1, max: 2 });
        const budget = getSubjectSkipBudget('math', state);
        expect(budget.skipUnits).toBe(6);
        expect(budget.skipClasses).toBe(3); // 6 / longest session — safe under-count
    });
});

// ── End-game projection ─────────────────────────────────────────────
describe('end-game projection', () => {
    // Two 2-hour classes a week (Mon + Wed), 4 periods weekly.
    const endGameState = (attended, total) => makeState({
        timetable: {
            Monday: [{ slotId: 'p1', subjectId: 'math' }, { slotId: 'p2', subjectId: 'math' }],
            Wednesday: [{ slotId: 'p1', subjectId: 'math' }, { slotId: 'p2', subjectId: 'math' }],
        },
        subjects: [{ id: 'math', name: 'Math', initialAttended: attended, initialTotal: total, target: 75 }],
    });

    it('skipping every allowed class still lands on or above target', () => {
        const { results } = getEndGameStats(endGameState(80, 100), 75, 6);
        const r = results[0];

        expect(r.remainingUnits).toBe(24); // 4 periods × 6 weeks
        expect(r.remainingClasses).toBe(12);
        expect(r.canSkip + r.mustAttend).toBe(r.remainingUnits);

        const worstCase = calculatePercentage(r.attendedUnits + r.mustAttend, r.futureTotal);
        expect(worstCase).toBeGreaterThanOrEqual(75);
        // and one period more would break it
        expect(calculatePercentage(r.attendedUnits + r.mustAttend - 1, r.futureTotal)).toBeLessThan(75);
    });

    it('never promises more skips than there are classes left', () => {
        const { results } = getEndGameStats(endGameState(100, 100), 75, 6);
        expect(results[0].canSkip).toBe(results[0].remainingUnits);
        expect(results[0].mustAttend).toBe(0);
    });

    it('flags an unreachable target instead of quietly clamping', () => {
        const { results } = getEndGameStats(endGameState(10, 100), 75, 1);
        const r = results[0];
        expect(r.canSkip).toBe(0);
        expect(r.mustAttendClasses).toBeGreaterThan(r.remainingClasses);
        expect(getRiskLevel(r)).toBe('impossible');
    });
});

// ── Partial ERP days must not lose attendance ───────────────────────
// The register marks each period separately, and a subject can hold two
// non-adjacent periods in one day (period 1 and period 5). Collapsing those to
// a single present/absent used to throw away real attendance.
describe('records keep their attended periods', () => {
    it('reads the explicit attended count when the day was part attended', () => {
        expect(recordAttendedUnits({ status: 'partial', units: 2, attendedUnits: 1 })).toBe(1);
        expect(recordUnits({ status: 'partial', units: 2, attendedUnits: 1 })).toBe(2);
    });

    it('falls back to status for records without an explicit count', () => {
        expect(recordAttendedUnits({ status: 'present', units: 2 })).toBe(2);
        expect(recordAttendedUnits({ status: 'absent', units: 2 })).toBe(0);
    });

    it('never reports more attended than delivered', () => {
        expect(recordAttendedUnits({ status: 'present', units: 1, attendedUnits: 5 })).toBe(1);
    });

});
