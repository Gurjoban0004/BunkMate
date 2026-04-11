import { getTodayDayName, parseTimeToMinutes } from './dateHelpers';

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
    // Option A: Just use `subject.initialAttended` (which is ERP's exact summary numbers) AND add ONLY 'prediction' marks.
    // This perfectly solves double counting. The ERP calendar data just sits there for UI/History, 
    // but the summary numbers are the source of truth.
    Object.entries(records).forEach(([dateKey, dayRecord]) => {
        // Skip holidays
        if (dayRecord._holiday) return;
        if (holidays.includes(dateKey)) return;

        const record = dayRecord[subjectId];
        if (record) {
            // Skip cancelled individual classes
            if (record.status === 'cancelled') return;

            // CRITICAL fix to prevent double-counting ERP records.
            // `subject.initialTotal` already contains the ERP's total count.
            // We ONLY add units that are 'prediction' (manual gap-days).
            // 'erp' sourced daily records are purely for historic calendar UI.
            if (record.source !== 'prediction') return;

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

        const currentStartMins = parseTimeToMinutes(startTime);
        const lastEndMins = lastClass ? parseTimeToMinutes(lastClass.endTime) : 0;

        // Check if this slot is consecutive with the last one for the same subject
        // Allow up to a 30-minute gap to still consider it a single block
        // Overlapping slots (negative gap) are also merged, which happens for 2-hour classes
        if (
            lastClass &&
            lastClass.subjectId === slot.subjectId &&
            (currentStartMins - lastEndMins) >= 0 &&
            (currentStartMins - lastEndMins) <= 30
        ) {
            // Extend end time only if this slot ends later
            if (parseTimeToMinutes(endTime) > parseTimeToMinutes(lastClass.endTime)) {
                lastClass.endTime = endTime;
            }
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
 * Get today's classes from the timetable based on current day name.
 */
export function getTodayClasses(state, devDate = null) {
    const dayName = getTodayDayName(devDate);
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

export function calculateSkips(attended, total, targetPercent) {
    if (total === 0) {
        return {
            status: 'safe',
            count: 0,
            message: 'No classes recorded yet',
        };
    }

    const exactCurrentPercent = (attended / total) * 100;

    if (exactCurrentPercent >= targetPercent) {
        // Integer-friendly math: S <= (100 * A - P * T) / P
        let canSkip = 0;
        if (targetPercent > 0) {
            const rawSkips = (100 * attended - targetPercent * total) / targetPercent;
            canSkip = Math.floor(rawSkips + 1e-9);
        }
        
        return {
            status: 'safe',
            count: Math.max(0, canSkip),
            message: `You can skip ${Math.max(0, canSkip)} more classes`,
        };
    } else {
        // Integer-friendly math: F >= (P * T - 100 * A) / (100 - P)
        const divisor = 100 - targetPercent;
        if (divisor <= 0) {
            // Target is 100% or more, you'll never reach it if you've missed even one class
            return {
                status: 'danger',
                count: Infinity,
                message: `You missed a class, you can't reach 100% attendance!`,
            };
        }

        const rawAttend = (targetPercent * total - 100 * attended) / divisor;
        const needAttend = Math.ceil(rawAttend - 1e-9);

        return {
            status: 'danger',
            count: Math.max(0, needAttend),
            message: needAttend > 9999
                ? `You can't realistically reach ${targetPercent}% anymore`
                : `You need to attend ${Math.max(0, needAttend)} more classes`,
        };
    }
}

/**
 * Find index of the class currently happening.
 * Returns -1 if no class is happening now.
 */
export function getCurrentClassIndex(todayClasses, devDate = null) {
    const now = devDate ? new Date(devDate) : new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    return todayClasses.findIndex((c) => {
        const start = parseTimeToMinutes(c.startTime);
        const end = parseTimeToMinutes(c.endTime);
        return currentMinutes >= start && currentMinutes < end;
    });
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
