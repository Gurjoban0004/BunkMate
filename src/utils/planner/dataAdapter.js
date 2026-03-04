/**
 * Data Adapter — bridges our AppContext state shape to
 * the format expected by planner utility functions.
 *
 * Our state:
 *   - subjects[]: { id, name, color, initialTotal, initialAttended, target? }
 *   - attendanceRecords[dateKey][subjectId]: { status, units, isExtra? }
 *   - timetable[dayName]: [{ slotId, subjectId }]
 *   - timeSlots[]: { id, start, end }
 *
 * Planner expects per-subject:
 *   { id, name, color, attended, total, percentage, target, history[], schedule }
 */

import { getSubjectAttendance, calculatePercentage } from '../attendance';

const DAY_NAME_TO_NUMBER = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
};

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Build a chronological history array for a subject from attendanceRecords.
 * Each entry: { date: ISO string, status: 'present'|'absent', time: 'HH:MM'|null }
 */
function buildHistory(subjectId, state) {
    const records = state.attendanceRecords || {};
    const holidays = state.holidays || [];
    const trackingStartDate = state.trackingStartDate;
    const history = [];

    Object.entries(records).forEach(([dateKey, dayRecord]) => {
        // Skip records before tracking started
        if (trackingStartDate && dateKey < trackingStartDate) return;
        // Skip holidays
        if (dayRecord._holiday) return;
        if (holidays.includes(dateKey)) return;

        const record = dayRecord[subjectId];
        if (record && record.status !== 'cancelled') {
            // Figure out which day of the week to find the time slot
            const d = new Date(dateKey + 'T12:00:00');
            const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()];

            // Try to find the time for this class
            let time = null;
            const daySlots = (state.timetable || {})[dayName] || [];
            const matchingSlot = daySlots.find(s => s.subjectId === subjectId);
            if (matchingSlot) {
                const timeSlot = (state.timeSlots || []).find(ts => ts.id === matchingSlot.slotId);
                if (timeSlot) {
                    time = timeSlot.start;
                }
            }

            // Each unit counts as a separate entry for pattern analysis
            const units = record.units || 1;
            for (let u = 0; u < units; u++) {
                history.push({
                    date: dateKey + (time ? `T${time}:00` : 'T12:00:00'),
                    status: record.status === 'present' ? 'present' : 'absent',
                    time,
                });
            }
        }
    });

    // Sort chronologically
    history.sort((a, b) => a.date.localeCompare(b.date));
    return history;
}

/**
 * Build schedule object from timetable for a specific subject.
 * Returns: { type: 'recurring', slots: [{ day, time, duration }] }
 */
function buildSchedule(subjectId, state) {
    const timetable = state.timetable || {};
    const timeSlots = state.timeSlots || [];
    const slots = [];

    DAY_NAMES.forEach(dayName => {
        const daySchedule = timetable[dayName] || [];
        daySchedule.forEach(entry => {
            if (entry.subjectId === subjectId) {
                const timeSlot = timeSlots.find(ts => ts.id === entry.slotId);
                if (timeSlot) {
                    const startMins = parseTime(timeSlot.start);
                    const endMins = parseTime(timeSlot.end);
                    const duration = endMins - startMins;

                    // Avoid duplicates for the same day+time (consecutive slots merged)
                    const existing = slots.find(
                        s => s.day === DAY_NAME_TO_NUMBER[dayName] && s.time === timeSlot.start
                    );
                    if (!existing) {
                        slots.push({
                            day: DAY_NAME_TO_NUMBER[dayName],
                            time: timeSlot.start,
                            duration: duration > 0 ? duration : 60,
                        });
                    }
                }
            }
        });
    });

    return { type: 'recurring', slots };
}

function parseTime(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':');
    return parseInt(h, 10) * 60 + parseInt(m, 10);
}

/**
 * Get full planner-ready data for a single subject.
 */
export function getSubjectPlannerData(subjectId, state) {
    const subject = state.subjects.find(s => s.id === subjectId);
    if (!subject) return null;

    const stats = getSubjectAttendance(subjectId, state);
    if (!stats) return null;

    const attended = stats.attendedUnits;
    const total = stats.totalUnits;
    const percentage = stats.percentage;
    const target = subject.target || 75;
    const history = buildHistory(subjectId, state);
    const schedule = buildSchedule(subjectId, state);

    return {
        id: subject.id,
        name: subject.name,
        color: subject.color,
        teacher: subject.teacher,
        attended,
        total,
        percentage,
        target,
        history,
        schedule,
    };
}

/**
 * Get planner-ready data for ALL subjects.
 */
export function getAllSubjectsPlannerData(state) {
    return (state.subjects || [])
        .map(subject => getSubjectPlannerData(subject.id, state))
        .filter(Boolean);
}
