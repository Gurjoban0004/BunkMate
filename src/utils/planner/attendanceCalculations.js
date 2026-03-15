/**
 * Core attendance calculation functions for the planner.
 * All functions work with simple attended/total numbers.
 */

/**
 * Calculate attendance percentage.
 */
export function calculatePlannerPercentage(attended, total) {
    if (total === 0) return 0;
    return (attended / total) * 100;
}

/**
 * Calculate impact of skipping next class.
 */
export function calculateSkipImpact(attended, total) {
    const current = calculatePlannerPercentage(attended, total);
    const newTotal = total + 1;
    const newPercentage = calculatePlannerPercentage(attended, newTotal);

    return {
        newAttended: attended,
        newTotal,
        newPercentage: parseFloat(newPercentage.toFixed(1)),
        change: parseFloat((newPercentage - current).toFixed(1)),
    };
}

/**
 * Calculate impact of attending next class.
 */
export function calculateAttendImpact(attended, total) {
    const current = calculatePlannerPercentage(attended, total);
    const newAttended = attended + 1;
    const newTotal = total + 1;
    const newPercentage = calculatePlannerPercentage(newAttended, newTotal);

    return {
        newAttended,
        newTotal,
        newPercentage: parseFloat(newPercentage.toFixed(1)),
        change: parseFloat((newPercentage - current).toFixed(1)),
    };
}

/**
 * Simulate skip/attend N classes.
 * offset > 0 = attend, offset < 0 = skip
 */
export function simulateAttendance(attended, total, offset) {
    let newAttended = attended;
    let newTotal = total;

    if (offset > 0) {
        newAttended += offset;
        newTotal += offset;
    } else if (offset < 0) {
        newTotal += Math.abs(offset);
    }

    return {
        attended: newAttended,
        total: newTotal,
        percentage: calculatePlannerPercentage(newAttended, newTotal),
    };
}

/**
 * Calculate classes needed to reach target using closed-form formula.
 * Derivation: (attended + n) / (total + n) >= target → n >= (target*total - attended) / (1 - target)
 * Returns null only if target is 100% and student has missed at least one class.
 */
export function calculateRecoveryClasses(attended, total, targetPercentage) {
    const target = targetPercentage / 100;

    // Handle 100% target edge case
    if (target >= 1) {
        if (attended < total) return null; // Impossible — already missed classes
        return { classesNeeded: 0, resultPercentage: 100, newAttended: attended, newTotal: total };
    }

    const current = total === 0 ? 0 : attended / total;
    if (current * 100 >= targetPercentage) {
        return { classesNeeded: 0, resultPercentage: parseFloat((current * 100).toFixed(1)), newAttended: attended, newTotal: total };
    }

    const classesNeeded = Math.ceil((target * total - attended) / (1 - target));
    const newAttended = attended + classesNeeded;
    const newTotal = total + classesNeeded;

    return {
        classesNeeded,
        resultPercentage: parseFloat(((newAttended / newTotal) * 100).toFixed(1)),
        newAttended,
        newTotal,
    };
}

/**
 * Calculate absolute skip allowance using closed-form formula.
 * Derivation: attended / (total + n) >= target → n <= attended/target - total
 */
export function calculateSkipAllowance(targetPercentage, currentAttended, currentTotal) {
    const target = targetPercentage / 100;
    if (target <= 0) return { skips: Infinity, outOf: Infinity, ratio: '∞', simplified: '∞' };

    const maxSafeSkips = Math.max(0, Math.floor(currentAttended / target - currentTotal));

    return {
        skips: maxSafeSkips,
        outOf: maxSafeSkips,
        ratio: `${maxSafeSkips} consecutive`,
        simplified: `${maxSafeSkips} consecutive`,
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
