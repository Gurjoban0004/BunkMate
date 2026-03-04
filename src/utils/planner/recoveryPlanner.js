/**
 * Recovery path planning for subjects below target.
 * Uses adapted schedule format to find specific upcoming classes.
 */

import { calculateRecoveryClasses, calculateSkipAllowance } from './attendanceCalculations';

/**
 * Generate recovery paths for a subject at multiple target levels.
 */
export function generateRecoveryPaths(subject, targets = [75, 80, 85]) {
    const { attended, total, target: userTarget } = subject;
    const currentPercentage = total > 0 ? (attended / total) * 100 : 0;

    // Filter targets above current percentage
    const relevantTargets = targets.filter(t => t > currentPercentage);

    const paths = relevantTargets.map(targetPercentage => {
        const recovery = calculateRecoveryClasses(attended, total, targetPercentage);

        if (!recovery) return null; // Impossible

        // Get specific upcoming classes
        const specificClasses = getSpecificClassesForRecovery(
            subject,
            recovery.classesNeeded
        );

        // Calculate timeline
        const timeline = specificClasses.length > 0 ? {
            days: Math.ceil(
                (new Date(specificClasses[specificClasses.length - 1].date) - new Date()) /
                (1000 * 60 * 60 * 24)
            ),
            startDate: new Date().toISOString(),
            endDate: specificClasses[specificClasses.length - 1].date,
        } : null;

        // Calculate skip allowance after reaching target
        const skipAllowance = calculateSkipAllowance(
            targetPercentage,
            recovery.newAttended,
            recovery.newTotal
        );

        return {
            targetPercentage,
            classesNeeded: recovery.classesNeeded,
            timeline,
            specificClasses,
            resultPercentage: recovery.resultPercentage,
            skipAllowance,
        };
    }).filter(Boolean);

    return {
        subjectId: subject.id,
        currentPercentage,
        target: userTarget,
        gap: userTarget - currentPercentage,
        paths,
    };
}

/**
 * Get specific upcoming classes for recovery planning.
 */
function getSpecificClassesForRecovery(subject, count) {
    const classes = [];
    let checkDate = new Date();
    const maxDaysToCheck = 90;

    const { schedule } = subject;
    if (!schedule || !schedule.slots || schedule.slots.length === 0) return classes;

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let i = 0; i < maxDaysToCheck && classes.length < count; i++) {
        const dayOfWeek = checkDate.getDay();
        const matchingSlot = schedule.slots.find(slot => slot.day === dayOfWeek);

        if (matchingSlot) {
            const classDateTime = new Date(checkDate);
            const [hours, minutes] = matchingSlot.time.split(':');
            classDateTime.setHours(parseInt(hours), parseInt(minutes), 0);

            // Only future classes
            if (classDateTime > new Date()) {
                classes.push({
                    date: classDateTime.toISOString(),
                    day: dayNames[classDateTime.getDay()],
                    dateFormatted: `${monthNames[classDateTime.getMonth()]} ${classDateTime.getDate()}`,
                    time: matchingSlot.time,
                    isNext: classes.length === 0,
                });
            }
        }

        const nextDay = new Date(checkDate);
        nextDay.setDate(nextDay.getDate() + 1);
        checkDate = nextDay;
    }

    return classes;
}

/**
 * Generate motivational rewards text based on target percentage.
 */
export function generateRewards(targetPercentage) {
    if (targetPercentage <= 75) {
        return "Legal attendance secured — you're safe!";
    } else if (targetPercentage <= 80) {
        return 'Safe buffer + flexible skipping enabled!';
    } else {
        return 'Maximum freedom — coast till semester end!';
    }
}
