/**
 * Generate Realistic Attendance History
 */

import { subDays, addDays, startOfDay, format, isSameDay } from 'date-fns';

const getDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Generate attendance history with realistic patterns
 */
export function generateRealisticHistory({
    subjects,
    timetable,
    weeksBack = 8,
    currentDate = new Date(),
    pattern = 'realistic',
}) {
    const records = {};
    const startDate = subDays(startOfDay(currentDate), weeksBack * 7);
    const endDate = new Date(currentDate);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    let currentCheckDate = new Date(startDate);

    // Initialize tracking per subject to hit the subject's initialAttended / initialTotal if possible
    const subjectTracking = {};
    subjects.forEach(sub => {
        subjectTracking[sub.id] = {
            targetPercentage: sub.initialTotal > 0 ? (sub.initialAttended / sub.initialTotal) : 0.75,
            attendedSoFar: 0,
            classesSoFar: 0,
        };
    });

    while (currentCheckDate <= endDate) {
        const dayName = days[currentCheckDate.getDay()];
        const daySlots = timetable[dayName] || [];

        if (daySlots.length > 0) {
            const dateKey = getDateKey(currentCheckDate);
            records[dateKey] = {};

            // Group by subject to handle multiple slots per day
            const subjectSlots = {};
            daySlots.forEach(slot => {
                if (!subjectSlots[slot.subjectId]) subjectSlots[slot.subjectId] = 0;
                subjectSlots[slot.subjectId] += 1; // Number of units (e.g. 2 hours)
            });

            Object.keys(subjectSlots).forEach(subjectId => {
                const units = subjectSlots[subjectId];
                const tracker = subjectTracking[subjectId];

                if (tracker) {
                    tracker.classesSoFar += units;
                    const shouldAttend = Math.random() < tracker.targetPercentage;
                    if (shouldAttend) {
                        tracker.attendedSoFar += units;
                    }

                    records[dateKey][subjectId] = {
                        status: shouldAttend ? 'present' : 'absent',
                        units: units,
                        isExtra: false,
                    };
                }
            });
        }
        currentCheckDate = addDays(currentCheckDate, 1);
    }

    return records;
}

export const HISTORY_TEMPLATES = {
    DECLINING_SEMESTER: {
        name: 'Declining Semester',
        weeklyPercentages: [90, 88, 85, 80, 75, 70, 68, 65],
    },
    IMPROVING_SEMESTER: {
        name: 'Improving Semester',
        weeklyPercentages: [60, 65, 68, 72, 75, 78, 82, 85],
    },
};
