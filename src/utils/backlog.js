import { getDateKey } from './dateHelpers';
import { getClassesForDay } from './attendance';

/**
 * Get all unmarked classes from the past 2 weeks.
 */
export function getUnmarkedClasses(state) {
    const unmarked = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(today.getDate() - 14);

    const records = state.attendanceRecords || {};
    const holidays = state.holidays || [];

    const trackingStartDate = state.trackingStartDate;
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (let d = new Date(twoWeeksAgo); d < today; d.setDate(d.getDate() + 1)) {
        const dateKey = getDateKey(d);

        // Skip days before tracking started
        if (dateKey < trackingStartDate) continue;

        const dayName = dayNames[d.getDay()];

        // Skip if holiday
        if (records[dateKey]?._holiday) continue;
        if (holidays.includes(dateKey)) continue;

        // Get scheduled classes for this day
        const scheduledClasses = getClassesForDay(state, dayName);

        scheduledClasses.forEach((classInfo) => {
            const record = records[dateKey]?.[classInfo.subjectId];
            if (!record) {
                unmarked.push({
                    date: dateKey,
                    dayName,
                    ...classInfo,
                });
            }
        });
    }

    return unmarked.reverse(); // newest first
}

/**
 * Get count of unmarked classes.
 */
export function getUnmarkedCount(state) {
    return getUnmarkedClasses(state).length;
}

/**
 * Group unmarked classes by date.
 * Returns array of { date, dayName, classes: [...] }
 */
export function getUnmarkedByDate(state) {
    const classes = getUnmarkedClasses(state);
    const grouped = {};

    classes.forEach((c) => {
        if (!grouped[c.date]) {
            grouped[c.date] = { date: c.date, dayName: c.dayName, classes: [] };
        }
        grouped[c.date].classes.push(c);
    });

    return Object.values(grouped);
}
