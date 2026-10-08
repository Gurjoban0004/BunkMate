import { calculatePercentage, getSubjectAttendance, getTodayClasses } from './attendance';
import { getTodayKey } from './dateHelpers';

export const LECTURES_PER_PAIR = 2;

function pairCount(value) {
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('Use a whole, non-negative number of class pairs');
    return value;
}

/** Minimum full pairs, comparing ratios directly (including the original fraction). */
export function pairsToReachFraction(attended, conducted, numerator, denominator) {
    numerator = Number(numerator);
    denominator = Number(denominator);
    if (![attended, conducted, numerator, denominator].every(Number.isFinite)) return null;
    if (!(denominator > 0) || numerator < 0 || numerator > denominator) return null;
    const reaches = (n) => (attended + 2 * n) * denominator >= numerator * (conducted + 2 * n);
    if (reaches(0) && (conducted > 0 || numerator === 0)) return 0;
    if (numerator === denominator) return attended === conducted ? 1 : null;
    let pairs = Math.max(0, Math.ceil((numerator * conducted - attended * denominator) / (2 * (denominator - numerator))));
    if (!Number.isSafeInteger(pairs)) return null;
    // No attendance yet requires attending the first pair, not claiming 0/0 reaches a goal.
    if (conducted === 0 && numerator > 0) pairs = Math.max(1, pairs);
    while (pairs > 0 && (conducted + 2 * (pairs - 1)) > 0 && reaches(pairs - 1)) pairs--;
    while (!reaches(pairs)) pairs++;
    return pairs;
}

function recovery(attended, conducted, numerator, denominator, label) {
    const pairs = pairsToReachFraction(attended, conducted, numerator, denominator);
    return {
        label, targetPercentage: denominator > 0 ? numerator * 100 / denominator : null,
        pairs, lectures: pairs === null ? null : pairs * 2,
        attended: pairs === null ? null : attended + pairs * 2,
        conducted: pairs === null ? null : conducted + pairs * 2,
    };
}

/** Each selectable event is a full pair; larger grouped sessions expose their pairs. */
export function getTodaySkipPairs(state) {
    const date = getTodayKey(state.devDate);
    if ((state.holidays || []).includes(date) || state.attendanceRecords?.[date]?._holiday) return [];
    return getTodayClasses(state, state.devDate).flatMap((cls, index) => {
        const count = Math.max(1, Math.ceil(cls.units / 2));
        return Array.from({ length: count }, (_, pair) => ({
            ...cls, id: `${date}:${cls.subjectId}:${index}:${pair}`, pair: pair + 1, pairCount: count,
        }));
    });
}

/** Pure projection over the existing college totals. Records already belong to these totals. */
export function simulateAttendanceImpact(state, { unassignedPairs = 0, subjectPairs = {} } = {}) {
    const unassigned = pairCount(unassignedPairs);
    const ids = new Set((state.subjects || []).map((s) => s.id));
    Object.entries(subjectPairs).forEach(([id, count]) => {
        pairCount(count);
        if (!ids.has(id)) throw new RangeError('Unknown subject');
    });
    let attended = 0, conducted = 0, assigned = 0;
    const subjects = (state.subjects || []).map((subject) => {
        const stats = getSubjectAttendance(subject.id, state);
        const pairs = subjectPairs[subject.id] || 0;
        const skipped = pairs * 2;
        const afterTotal = stats.totalUnits + skipped;
        const afterPercentage = calculatePercentage(stats.attendedUnits, afterTotal);
        const configuredRequirement = Number(subject.target ?? state.settings?.dangerThreshold ?? 75);
        const requirement = Number.isFinite(configuredRequirement) && configuredRequirement >= 0 && configuredRequirement <= 100 ? configuredRequirement : 75;
        attended += stats.attendedUnits;
        conducted += stats.totalUnits;
        assigned += pairs;
        return {
            id: subject.id, name: subject.name, color: subject.color, requirement,
            attended: stats.attendedUnits, conducted: stats.totalUnits, percentage: stats.percentage,
            pairs, skipped, afterTotal, afterPercentage, change: afterPercentage - stats.percentage,
            recoverPrevious: recovery(stats.attendedUnits, afterTotal, stats.attendedUnits, stats.totalUnits, 'Previous attendance'),
            recoverRequirement: recovery(stats.attendedUnits, afterTotal, requirement, 100, 'Subject requirement'),
        };
    });
    const skipped = (unassigned + assigned) * 2;
    const afterTotal = conducted + skipped;
    const percentage = calculatePercentage(attended, conducted);
    const afterPercentage = calculatePercentage(attended, afterTotal);
    return {
        attended, conducted, percentage, skipped, pairs: unassigned + assigned, unassignedPairs: unassigned,
        afterTotal, afterPercentage, change: afterPercentage - percentage,
        recovery: [
            recovery(attended, afterTotal, attended, conducted, 'Previous overall attendance'),
            ...[75, 80, 85, 90].map((target) => recovery(attended, afterTotal, target, 100, `${target}%`)),
        ],
        subjects: subjects.sort((a, b) => a.change - b.change),
    };
}
