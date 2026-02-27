import { getTodayDayName } from './dateHelpers';

/**
 * Calculate attendance percentage, rounded to 1 decimal.
 * Returns 0 if total is 0 (avoids division by zero).
 */
export function calculatePercentage(attended, total) {
    if (total === 0) return 0;
    return Math.round((attended / total) * 100 * 10) / 10;
}

/**
 * Get full attendance stats for a single subject.
 * Combines initial values with all recorded attendance marks.
 * Skips holidays and cancelled classes.
 */
export function getSubjectAttendance(subjectId, state) {
    const subject = state.subjects.find((s) => s.id === subjectId);
    if (!subject) return null;

    let recordedTotal = 0;
    let recordedAttended = 0;

    const records = state.attendanceRecords || {};
    const holidays = state.holidays || [];
    const trackingStartDate = state.trackingStartDate;

    Object.entries(records).forEach(([dateKey, dayRecord]) => {
        // Skip records before tracking started
        if (trackingStartDate && dateKey < trackingStartDate) return;

        // Skip holidays
        if (dayRecord._holiday) return;
        if (holidays.includes(dateKey)) return;

        const record = dayRecord[subjectId];
        if (record) {
            // Skip cancelled individual classes
            if (record.status === 'cancelled') return;

            recordedTotal += record.units;
            if (record.status === 'present') {
                recordedAttended += record.units;
            }
        }
    });

    const totalUnits = (subject.initialTotal || 0) + recordedTotal;
    const attendedUnits = (subject.initialAttended || 0) + recordedAttended;
    const percentage = calculatePercentage(attendedUnits, totalUnits);

    return {
        totalUnits,
        attendedUnits,
        percentage,
    };
}

/**
 * Get classes for a specific day name (e.g., 'Monday'), grouped by subject.
 * This handles multiple sessions of the same subject in one day by summing their units.
 */
export function getClassesForDay(state, dayName) {
    const timetable = state.timetable || {};
    const daySchedule = timetable[dayName] || [];

    if (daySchedule.length === 0) return [];

    const groupedClasses = [];
    let lastClass = null;

    // Sort schedule by time slot start time
    const sortedSchedule = [...daySchedule].sort((a, b) => {
        const slotA = state.timeSlots.find((ts) => ts.id === a.slotId);
        const slotB = state.timeSlots.find((ts) => ts.id === b.slotId);
        if (!slotA || !slotB) return 0;
        return parseTimeToMinutes(slotA.start) - parseTimeToMinutes(slotB.start);
    });

    sortedSchedule.forEach((slot) => {
        const timeSlot = state.timeSlots.find((ts) => ts.id === slot.slotId);
        const subject = state.subjects.find((s) => s.id === slot.subjectId);

        if (!timeSlot || !subject) return;

        const startTime = slot.customStart || timeSlot.start;
        const endTime = slot.customEnd || timeSlot.end;

        // Check if this slot is consecutive with the last one for the same subject
        if (lastClass && lastClass.subjectId === slot.subjectId && lastClass.endTime === startTime) {
            lastClass.endTime = endTime;
            lastClass.units += 1;
        } else {
            const newClass = {
                subjectId: slot.subjectId,
                subjectName: subject.name,
                teacher: subject.teacher,
                color: subject.color,
                startTime: startTime,
                endTime: endTime,
                units: 1,
            };
            groupedClasses.push(newClass);
            lastClass = newClass;
        }
    });

    return groupedClasses;
}

/**
 * Get today's classes, grouped by subject to handle multiple sessions per day.
 */
export function getTodayClasses(state) {
    const dayName = getTodayDayName();
    return getClassesForDay(state, dayName);
}

/**
 * Get the typical units for a subject based on its timetable entries.
 * Returns the max consecutive slots found for this subject.
 */
export function getSubjectUnits(subjectId, state) {
    let maxUnits = 1;
    const timetable = state.timetable || {};

    Object.values(timetable).forEach((daySlots) => {
        let consecutiveCount = 0;
        let lastSubject = null;

        daySlots.forEach((slot) => {
            if (slot.subjectId === subjectId) {
                consecutiveCount = lastSubject === subjectId ? consecutiveCount + 1 : 1;
                maxUnits = Math.max(maxUnits, consecutiveCount);
            }
            lastSubject = slot.subjectId;
        });
    });

    return maxUnits;
}

/**
 * Bunk Calculator: how many classes can be bunked or need to attend.
 */
export function calculateBunks(attended, total, targetPercent) {
    const target = targetPercent / 100;
    const currentPercent = calculatePercentage(attended, total);

    if (currentPercent >= targetPercent) {
        // canBunk = (attended / target) - total
        const canBunk = target > 0 ? Math.floor(attended / target - total) : 0;
        return {
            status: 'safe',
            count: Math.max(0, canBunk),
            message: `You can bunk ${Math.max(0, canBunk)} more classes`,
        };
    } else {
        // needAttend = (target * total - attended) / (1 - target)
        const divisor = 1 - target;
        if (divisor <= 0) {
            // Target is 100% or more, you'll never reach it if you've missed even one class
            // But if total is 0, technically you're at 0%
            return {
                status: 'danger',
                count: Infinity,
                message: `You missed a class, you can't reach 100% attendance!`,
            };
        }
        const needAttend = Math.ceil((target * total - attended) / divisor);
        return {
            status: 'danger',
            count: Math.max(0, needAttend),
            message: `You need to attend ${Math.max(0, needAttend)} more classes`,
        };
    }
}

/**
 * Get the index of the currently running class based on time.
 * Returns -1 if no class is currently happening.
 */
export function getCurrentClassIndex(classes) {
    if (!classes || classes.length === 0) return -1;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (let i = 0; i < classes.length; i++) {
        const classInfo = classes[i];
        const [startH, startM] = classInfo.startTime.split(':').map(Number);
        const [endH, endM] = classInfo.endTime.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
            return i;
        }
    }

    return -1;
}

/**
 * Calculate overall attendance percentage across all subjects.
 */
export function calculateOverallPercentage(state) {
    if (!state.subjects || state.subjects.length === 0) return 0;

    let totalAttended = 0;
    let totalUnits = 0;

    state.subjects.forEach((subject) => {
        const stats = getSubjectAttendance(subject.id, state);
        if (stats) {
            totalAttended += stats.attendedUnits;
            totalUnits += stats.totalUnits;
        }
    });

    if (totalUnits === 0) return 0;
    return Math.round((totalAttended / totalUnits) * 100 * 10) / 10;
}
