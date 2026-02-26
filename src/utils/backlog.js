import { getDateKey } from './dateHelpers';
import { getTodayClasses } from './attendance';

/**
 * Get classes from a specific day, grouped by consecutive same-subject slots.
 */
function getClassesForDay(dayName, state) {
    const daySchedule = state.timetable[dayName] || [];
    if (daySchedule.length === 0) return [];

    const groupedClasses = [];
    let currentGroup = null;

    daySchedule.forEach((slot) => {
        const timeSlot = state.timeSlots.find((ts) => ts.id === slot.slotId);
        const subject = state.subjects.find((s) => s.id === slot.subjectId);
        if (!timeSlot || !subject) return;

        if (currentGroup && currentGroup.subjectId === slot.subjectId) {
            currentGroup.endTime = timeSlot.end;
            currentGroup.units += 1;
        } else {
            if (currentGroup) groupedClasses.push(currentGroup);
            currentGroup = {
                subjectId: slot.subjectId,
                subjectName: subject.name,
                teacher: subject.teacher,
                color: subject.color,
                startTime: timeSlot.start,
                endTime: timeSlot.end,
                units: 1,
            };
        }
    });

    if (currentGroup) groupedClasses.push(currentGroup);
    return groupedClasses;
}

/**
 * Get all unmarked classes from the past 2 weeks.
 * Returns array of { date, dayName, ...classInfo } sorted newest first.
 */
export function getUnmarkedClasses(state) {
    const unmarked = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(today.getDate() - 14);

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (let d = new Date(twoWeeksAgo); d < today; d.setDate(d.getDate() + 1)) {
        const dateKey = getDateKey(d);
        const dayName = dayNames[d.getDay()];

        // Skip if holiday
        if (state.attendanceRecords[dateKey]?._holiday) continue;
        if ((state.holidays || []).includes(dateKey)) continue;

        // Get scheduled classes for this day
        const scheduledClasses = getClassesForDay(dayName, state);

        scheduledClasses.forEach((classInfo) => {
            const record = state.attendanceRecords[dateKey]?.[classInfo.subjectId];
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
