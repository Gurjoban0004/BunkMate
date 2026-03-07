import { getDateKey, getTodayKey } from './dateHelpers';
import { getClassesForDay } from './attendance';

/**
 * Get all unmarked classes from the past 2 weeks.
 */
export function getUnmarkedClasses(state, includeAutoMarked = false) {
    const unmarked = [];
    const todayObj = state.devDate ? new Date(state.devDate) : new Date();
    const twoWeeksAgo = new Date(todayObj);
    twoWeeksAgo.setHours(0, 0, 0, 0);
    twoWeeksAgo.setDate(todayObj.getDate() - 14);

    const todayKey = getTodayKey(state.devDate);

    const records = state.attendanceRecords || {};
    const holidays = state.holidays || [];

    const trackingStartDate = state.trackingStartDate;
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // We loop up to and including todayObj
    // for past days, we include unmarked. for today, we ONLY include auto-marked (if requested)
    const d = new Date(twoWeeksAgo);
    d.setHours(12, 0, 0, 0); // Use noon to avoid DST issues
    
    const target = new Date(todayObj);
    target.setHours(23, 59, 59, 999);

    while (d <= target) {
        const dateKey = getDateKey(d);
        const dayName = dayNames[d.getDay()];

        // Skip days before tracking started (UNLESS we are in time-travel past trackingStartDate)
        const isBeforeTracking = trackingStartDate && dateKey < trackingStartDate;
        const isTimeTravel = !!state.devDate;
        
        if (isBeforeTracking && !isTimeTravel) {
            d.setDate(d.getDate() + 1);
            continue;
        }

        // Skip if holiday
        if (records[dateKey]?._holiday || holidays.includes(dateKey)) {
            d.setDate(d.getDate() + 1);
            continue;
        }

        // Get scheduled classes for this day
        const scheduledClasses = getClassesForDay(state, dayName);

        scheduledClasses.forEach((classInfo) => {
            const record = records[dateKey]?.[classInfo.subjectId];
            const isAutoMarked = record?.autoMarked;
            const isToday = dateKey === todayKey;

            // Past days: include if unmarked OR if auto-marked (when requested)
            if (!isToday) {
                if (!record || (includeAutoMarked && isAutoMarked)) {
                    unmarked.push({
                        date: dateKey,
                        dayName,
                        ...classInfo,
                    });
                }
            } 
            // Today: only include if auto-marked (when requested)
            else if (includeAutoMarked && isAutoMarked) {
                unmarked.push({
                    date: dateKey,
                    dayName,
                    ...classInfo,
                });
            }
        });

        d.setDate(d.getDate() + 1);
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
export function getUnmarkedByDate(state, includeAutoMarked = false) {
    const classes = getUnmarkedClasses(state, includeAutoMarked);
    const grouped = {};

    classes.forEach((c) => {
        if (!grouped[c.date]) {
            grouped[c.date] = { date: c.date, dayName: c.dayName, classes: [] };
        }
        grouped[c.date].classes.push(c);
    });

    return Object.values(grouped);
}
