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
    // Handle 100% target edge case
    if (targetPercentage >= 100) {
        if (attended < total) return null; // Impossible — already missed classes
        return { classesNeeded: 0, resultPercentage: 100, newAttended: attended, newTotal: total };
    }

    if (total === 0) {
        return { classesNeeded: 0, resultPercentage: 100, newAttended: 0, newTotal: 0 };
    }

    const currentExact = (attended * 100) / total;
    if (currentExact >= targetPercentage) {
        return { 
            classesNeeded: 0, 
            resultPercentage: parseFloat(currentExact.toFixed(1)), 
            newAttended: attended, 
            newTotal: total 
        };
    }

    // Integer-friendly math to avoid floating point precision errors (e.g., ceil(2.0000000000004) -> 3)
    // F >= (P * T - 100 * A) / (100 - P)
    const divisor = 100 - targetPercentage;
    const rawAttend = (targetPercentage * total - 100 * attended) / divisor;
    const classesNeeded = Math.ceil(rawAttend - 1e-9);

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
    if (targetPercentage <= 0) return { skips: Infinity, outOf: Infinity, ratio: '∞', simplified: '∞' };

    let maxSafeSkips = 0;
    const currentExact = currentTotal === 0 ? 0 : (currentAttended * 100) / currentTotal;

    if (currentExact >= targetPercentage) {
        // Integer-friendly math: S <= (100 * A - P * T) / P
        const rawSkips = (100 * currentAttended - targetPercentage * currentTotal) / targetPercentage;
        maxSafeSkips = Math.max(0, Math.floor(rawSkips + 1e-9));
    }

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
