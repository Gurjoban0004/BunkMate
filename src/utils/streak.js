import { getDateKey } from './dateHelpers';
import { getClassesForDay } from './attendance';

/**
 * Streak Calculations for Presence
 *
 * Overall streak: consecutive classes attended across ALL subjects
 * Per-subject streak: consecutive classes attended for ONE subject
 */

/**
 * Calculate overall streak across all subjects.
 * Counts backward from most recent record.
 * Holidays/cancelled do NOT break streak.
 * ANY absent mark breaks the streak.
 * @returns {number} streak count in units (hours)
 */
export function calculateOverallStreak(state) {
    const records = state.attendanceRecords || {};
    const holidays = state.holidays || [];
    const trackingStartDate = state.trackingStartDate;

    // Find the latest date that has any record
    const sortedDates = Object.keys(records).sort();
    if (sortedDates.length === 0) return 0;

    let streak = 0;
    let currentDate = new Date(sortedDates[sortedDates.length - 1] + 'T12:00:00');
    const startDate = trackingStartDate ? new Date(trackingStartDate + 'T12:00:00') : null;
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const MAX_LOOKBACK_DAYS = 180;
    let daysChecked = 0;
    const todayKey = getDateKey(new Date());

    while ((!startDate || currentDate >= startDate) && daysChecked < MAX_LOOKBACK_DAYS) {
        daysChecked++;
        const dateKey = getDateKey(currentDate);

        // Skip today and future dates — they may not be fully marked yet
        if (dateKey >= todayKey) {
            currentDate.setDate(currentDate.getDate() - 1);
            continue;
        }

        const dayRecords = records[dateKey];
        const dayName = dayNames[currentDate.getDay()];

        // Check if it's a holiday
        const isHoliday = (dayRecords && dayRecords._holiday) || holidays.includes(dateKey);

        if (isHoliday) {
            // Holidays don't break streak, just skip
        } else {
            const scheduledClasses = getClassesForDay(state, dayName);
            const hasScheduled = scheduledClasses.length > 0;

            if (dayRecords) {
                // If we have records for this day
                let allPresent = true;
                let hasMarkedClasses = false;
                let dayUnits = 0;

                // Check all marked classes
                for (const subjectId in dayRecords) {
                    if (subjectId.startsWith('_')) continue;
                    const record = dayRecords[subjectId];
                    if (record.status === 'cancelled') continue;

                    hasMarkedClasses = true;
                    if (record.status === 'absent') {
                        allPresent = false;
                        break;
                    }
                    dayUnits += record.units || 1;
                }

                if (hasMarkedClasses && allPresent) {
                    streak += dayUnits;
                } else if (hasMarkedClasses && !allPresent) {
                    break; // Streak broken by absence
                } else if (hasScheduled) {
                    // Has scheduled classes but none marked?
                    // This case should ideally not happen if user is diligent,
                    // but if it does, it breaks the streak.
                    break;
                }
            } else if (hasScheduled) {
                // No records but had scheduled classes? Streak broken.
                break;
            }
            // If no records and no scheduled classes (weekend), just continue
        }

        // Move to previous day
        currentDate.setDate(currentDate.getDate() - 1);
    }

    return streak;
}

/**
 * Calculate streak for a specific subject.
 * @param {string} subjectId
 * @param {object} state
 * @returns {number} streak count in units
 */
export function calculateSubjectStreak(subjectId, state) {
    const records = state.attendanceRecords || {};
    const holidays = state.holidays || [];
    const trackingStartDate = state.trackingStartDate;

    const sortedDates = Object.keys(records).sort();
    if (sortedDates.length === 0) return 0;

    let streak = 0;
    let currentDate = new Date(sortedDates[sortedDates.length - 1] + 'T12:00:00');
    const startDate = trackingStartDate ? new Date(trackingStartDate + 'T12:00:00') : null;
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const MAX_LOOKBACK_DAYS = 180;
    let daysChecked = 0;
    const todayKeySubject = getDateKey(new Date());

    while ((!startDate || currentDate >= startDate) && daysChecked < MAX_LOOKBACK_DAYS) {
        daysChecked++;
        const dateKey = getDateKey(currentDate);

        // Skip today and future dates
        if (dateKey >= todayKeySubject) {
            currentDate.setDate(currentDate.getDate() - 1);
            continue;
        }

        const dayRecords = records[dateKey];
        const dayName = dayNames[currentDate.getDay()];

        const isHoliday = (dayRecords && dayRecords._holiday) || holidays.includes(dateKey);

        if (!isHoliday) {
            const scheduledClasses = getClassesForDay(state, dayName);
            const isScheduled = scheduledClasses.some(c => c.subjectId === subjectId);

            const record = dayRecords ? dayRecords[subjectId] : null;

            if (record) {
                if (record.status === 'cancelled') {
                    // skip
                } else if (record.status === 'present') {
                    streak += record.units || 1;
                } else {
                    break; // absent = broken
                }
            } else if (isScheduled) {
                // Scheduled but not marked = broken
                break;
            }
        }

        currentDate.setDate(currentDate.getDate() - 1);
    }

    return streak;
}

/**
 * Get the streak milestone message.
 * @param {number} streak
 * @returns {string|null} message or null if below minimum
 */
export function getStreakMessage(streak) {
    if (streak < 3) return null;
    if (streak >= 100) return '🔥 Perfect attendance!';
    if (streak >= 50) return '🔥 Legendary!';
    if (streak >= 25) return '🔥 Unstoppable!';
    if (streak >= 10) return '🔥 On fire!';
    if (streak >= 5) return '🔥 Nice start!';
    return '🔥 Keep it going!';
}
