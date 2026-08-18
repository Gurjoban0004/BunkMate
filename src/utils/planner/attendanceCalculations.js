/**
 * Planner-facing wrappers over the shared attendance math.
 *
 * The formulas live in ../attendance.js — one implementation, one place to be
 * wrong. Everything here works in UNITS (ERP periods) and reports classes
 * separately, because a 2-hour class is 2 units that can only be taken or
 * missed together.
 */

import {
    calculatePercentage,
    maxSkippableUnits,
    unitsToReachTarget,
    unitsToSkippableClasses,
    unitsToNeededClasses,
    roundPct,
} from '../attendance';

/**
 * Calculate attendance percentage (exact, unrounded — round at display).
 */
export function calculatePlannerPercentage(attended, total) {
    return calculatePercentage(attended, total);
}

/**
 * Impact of skipping the next class.
 * `units` is the size of that class: a 2-hour class adds 2 to the total.
 */
export function calculateSkipImpact(attended, total, units = 1) {
    const step = Math.max(1, units);
    const current = calculatePercentage(attended, total);
    const newTotal = total + step;
    const newPercentage = calculatePercentage(attended, newTotal);

    return {
        newAttended: attended,
        newTotal,
        units: step,
        newPercentage: roundPct(newPercentage),
        exactPercentage: newPercentage,
        change: roundPct(newPercentage - current),
    };
}

/**
 * Impact of attending the next class.
 */
export function calculateAttendImpact(attended, total, units = 1) {
    const step = Math.max(1, units);
    const current = calculatePercentage(attended, total);
    const newAttended = attended + step;
    const newTotal = total + step;
    const newPercentage = calculatePercentage(newAttended, newTotal);

    return {
        newAttended,
        newTotal,
        units: step,
        newPercentage: roundPct(newPercentage),
        exactPercentage: newPercentage,
        change: roundPct(newPercentage - current),
    };
}

/**
 * Simulate attending/skipping N classes of `units` each.
 * offset > 0 = attend, offset < 0 = skip
 */
export function simulateAttendance(attended, total, offset, units = 1) {
    const step = Math.max(1, units);
    const delta = Math.abs(offset) * step;
    const newAttended = offset > 0 ? attended + delta : attended;
    const newTotal = offset === 0 ? total : total + delta;

    return {
        attended: newAttended,
        total: newTotal,
        percentage: calculatePercentage(newAttended, newTotal),
    };
}

/**
 * Classes needed to reach a target, attending every one of them.
 * Returns null only when the target is unreachable (100% with a miss on record).
 */
export function calculateRecoveryClasses(attended, total, targetPercentage, sessionUnits = 1) {
    if (total === 0) {
        return { classesNeeded: 0, unitsNeeded: 0, resultPercentage: 100, newAttended: 0, newTotal: 0 };
    }

    const unitsNeeded = unitsToReachTarget(attended, total, targetPercentage);
    if (!Number.isFinite(unitsNeeded)) return null; // impossible

    const newAttended = attended + unitsNeeded;
    const newTotal = total + unitsNeeded;

    return {
        classesNeeded: unitsToNeededClasses(unitsNeeded, sessionUnits),
        unitsNeeded,
        resultPercentage: roundPct(calculatePercentage(newAttended, newTotal)),
        newAttended,
        newTotal,
    };
}

/**
 * How much can be skipped and still hold the target.
 */
export function calculateSkipAllowance(targetPercentage, currentAttended, currentTotal, sessionUnits = 1) {
    if (targetPercentage <= 0) {
        return { skips: Infinity, units: Infinity, outOf: Infinity, ratio: '∞', simplified: '∞' };
    }

    const units = maxSkippableUnits(currentAttended, currentTotal, targetPercentage);
    const skips = unitsToSkippableClasses(units, sessionUnits);

    return {
        skips,
        units,
        outOf: skips,
        ratio: `${skips} consecutive`,
        simplified: `${skips} consecutive`,
    };
}

/**
 * Determine status: 'danger' (🔴), 'warning' (🟡), or 'safe' (🟢)
 * Target is the goal (e.g. 75%), threshold is the "danger" line (e.g. 70%).
 * If target = threshold, there's no warning zone.
 */
export function determineStatus(percentage, target, threshold) {
    const dangerLine = threshold || target;
    if (percentage < dangerLine) return 'danger';
    if (percentage < target) return 'warning';
    return 'safe';
}
