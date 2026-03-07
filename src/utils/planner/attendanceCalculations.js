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
 * Calculate classes needed to reach target.
 * Returns null if impossible within 100 classes.
 */
export function calculateRecoveryClasses(attended, total, targetPercentage) {
    let tempAttended = attended;
    let tempTotal = total;
    let classesNeeded = 0;
    const maxIterations = 100;

    while (
        calculatePlannerPercentage(tempAttended, tempTotal) < targetPercentage &&
        classesNeeded < maxIterations
    ) {
        tempAttended++;
        tempTotal++;
        classesNeeded++;
    }

    if (classesNeeded >= maxIterations) {
        return null; // Impossible in reasonable range
    }

    return {
        classesNeeded,
        resultPercentage: calculatePlannerPercentage(tempAttended, tempTotal),
        newAttended: tempAttended,
        newTotal: tempTotal,
    };
}

/**
 * Calculate absolute skip allowance — how many consecutive classes you can skip right now while staying above target.
 */
export function calculateSkipAllowance(targetPercentage, currentAttended, currentTotal) {
    let maxSafeSkips = 0;

    while (calculatePlannerPercentage(currentAttended, currentTotal + maxSafeSkips + 1) >= targetPercentage) {
        maxSafeSkips++;
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
