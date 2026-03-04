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
 * Calculate skip allowance — how many you can skip out of next N while staying above target.
 */
export function calculateSkipAllowance(targetPercentage, currentAttended, currentTotal) {
    const testRange = 20;
    let maxSkips = 0;

    for (let skips = 0; skips <= testRange; skips++) {
        const attends = testRange - skips;
        const newAttended = currentAttended + attends;
        const newTotal = currentTotal + testRange;
        const newPercentage = calculatePlannerPercentage(newAttended, newTotal);

        if (newPercentage >= targetPercentage) {
            maxSkips = skips;
        } else {
            break;
        }
    }

    return {
        skips: maxSkips,
        outOf: testRange,
        ratio: `${maxSkips} of ${testRange}`,
        simplified: simplifyRatio(maxSkips, testRange),
    };
}

function simplifyRatio(skips, total) {
    if (skips === 0) return '0';
    const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(skips, total);
    return `${skips / divisor} in ${total / divisor}`;
}

/**
 * Determine status: 'danger' (🔴), 'warning' (🟡), or 'safe' (🟢)
 */
export function determineStatus(percentage, target, threshold = 75) {
    if (percentage < threshold) return 'danger';
    if (percentage < target) return 'warning';
    return 'safe';
}
