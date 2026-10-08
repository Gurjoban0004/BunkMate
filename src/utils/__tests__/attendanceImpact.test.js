import fc from 'fast-check';
import { getTodaySkipPairs, pairsToReachFraction, simulateAttendanceImpact } from '../attendanceImpact';

const state = () => ({
    subjects: [
        { id: 'math', name: 'Math', initialAttended: 50, initialTotal: 60, target: 85 },
        { id: 'physics', name: 'Physics', initialAttended: 44, initialTotal: 54, target: 75 },
    ],
    // These records are included in the college totals, never add them again.
    attendanceRecords: { '2026-10-07': { math: { units: 2, status: 'present', source: 'erp' } } },
    settings: {}, timetable: {}, timeSlots: [], holidays: [], devDate: '2026-10-08T12:00:00',
});

test('uses combined college totals and only adds two conducted lectures per skipped pair', () => {
    const input = state();
    const original = JSON.stringify(input);
    const result = simulateAttendanceImpact(input, { unassignedPairs: 1 });
    expect(result).toMatchObject({ attended: 94, conducted: 114, skipped: 2, afterTotal: 116 });
    expect(result.percentage).toBeCloseTo(82.45614035087719, 12);
    expect(result.afterPercentage).toBeCloseTo(81.03448275862068, 12);
    expect(result.change).toBeCloseTo(-1.4216575922565116, 12);
    expect(result.recovery.map((r) => r.pairs)).toEqual([5, 0, 0, 16, 52]);
    expect(result.recovery[0]).toMatchObject({ attended: 104, conducted: 126, lectures: 10 });
    expect(result.subjects.every((s) => s.change === 0)).toBe(true);
    expect(JSON.stringify(input)).toBe(original);
});

test('allocates each skip only to its chosen subject and uses subject requirements', () => {
    const result = simulateAttendanceImpact(state(), { subjectPairs: { math: 2, physics: 1 } });
    expect(result.afterTotal).toBe(120);
    expect(result.subjects.find((s) => s.id === 'math')).toMatchObject({ attended: 50, conducted: 60, afterTotal: 64, skipped: 4, requirement: 85, recoverPrevious: { pairs: 10 } });
    expect(result.subjects.find((s) => s.id === 'physics')).toMatchObject({ attended: 44, afterTotal: 56, skipped: 2 });
    const onlyMath = simulateAttendanceImpact(state(), { subjectPairs: { math: 1 } });
    expect(onlyMath.subjects.find((s) => s.id === 'physics').afterTotal).toBe(54);
});

test('no skip needs no recovery, and perfect attendance cannot be restored after skipping', () => {
    expect(simulateAttendanceImpact(state()).recovery[0].pairs).toBe(0);
    const input = state();
    input.subjects = [{ id: 'perfect', initialAttended: 20, initialTotal: 20, target: 100 }];
    const result = simulateAttendanceImpact(input, { subjectPairs: { perfect: 1 } });
    expect(result.recovery[0].pairs).toBeNull();
    expect(result.subjects[0].recoverRequirement.pairs).toBeNull();
    expect(result.recovery[1].pairs).toBe(0);
});

test('normalizes configured percentage strings and rejects non-finite recovery targets', () => {
    expect(pairsToReachFraction(20, 22, '100', 100)).toBeNull();
    expect(pairsToReachFraction(20, 22, NaN, 100)).toBeNull();
    const input = state();
    input.subjects[0].target = '85';
    expect(simulateAttendanceImpact(input).subjects.find((s) => s.id === 'math').requirement).toBe(85);
});

test('handles missing records, no totals and invalid counts without inventing attendance', () => {
    const result = simulateAttendanceImpact({ subjects: [] });
    expect(result).toMatchObject({ attended: 0, conducted: 0, percentage: 0 });
    expect(result.recovery[0].targetPercentage).toBeNull();
    expect(result.recovery.slice(1).every((r) => r.pairs === 1)).toBe(true);
    expect(() => simulateAttendanceImpact(state(), { unassignedPairs: 0.5 })).toThrow();
    expect(() => simulateAttendanceImpact(state(), { subjectPairs: { math: -1 } })).toThrow();
    expect(() => simulateAttendanceImpact(state(), { subjectPairs: { unknown: 1 } })).toThrow();
    const input = state();
    input.subjects[0].initialAttended = 1000;
    expect(simulateAttendanceImpact(input).attended).toBe(104);
});

test('automatically discovers today’s full pairs and respects holidays', () => {
    const input = state();
    input.timeSlots = [{ id: 'p1', start: '09:00', end: '10:00' }, { id: 'p2', start: '10:00', end: '11:00' }, { id: 'p3', start: '13:00', end: '15:00' }];
    input.timetable.Thursday = [{ slotId: 'p1', subjectId: 'math' }, { slotId: 'p2', subjectId: 'math' }, { slotId: 'p3', subjectId: 'physics' }];
    const pairs = getTodaySkipPairs(input);
    expect(pairs.map((p) => p.subjectId)).toEqual(['math', 'physics']);
    expect(new Set(pairs.map((p) => p.id)).size).toBe(2);
    input.holidays = ['2026-10-08'];
    expect(getTodaySkipPairs(input)).toEqual([]);
});

test('minimum recovery agrees with exact fraction boundaries across varied records', () => {
    fc.assert(fc.property(
        fc.integer({ min: 1, max: 1000 }), fc.integer({ min: 0, max: 1000 }), fc.integer({ min: 0, max: 30 }), fc.integer({ min: 1, max: 99 }),
        (total, rawAttended, skips, target) => {
            const attended = Math.min(total, rawAttended);
            const conducted = total + 2 * skips;
            for (const [numerator, denominator] of [[attended, total], [target, 100]]) {
                const pairs = pairsToReachFraction(attended, conducted, numerator, denominator);
                if (pairs === null) { expect(numerator).toBe(denominator); continue; }
                expect((attended + 2 * pairs) * denominator).toBeGreaterThanOrEqual(numerator * (conducted + 2 * pairs));
                if (pairs > 0) expect((attended + 2 * (pairs - 1)) * denominator).toBeLessThan(numerator * (conducted + 2 * (pairs - 1)));
            }
        }
    ), { numRuns: 500 });
});
