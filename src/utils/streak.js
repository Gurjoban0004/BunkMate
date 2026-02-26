/**
 * Streak Calculations for BunkMate
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
    let streak = 0;
    const records = state.attendanceRecords || {};
    const holidays = state.holidays || [];
    const sortedDates = Object.keys(records).sort().reverse();

    for (const dateKey of sortedDates) {
        const dayRecords = records[dateKey];

        // Skip holidays
        if (dayRecords._holiday) continue;
        if (holidays.includes(dateKey)) continue;

        let allPresent = true;
        let hasClasses = false;
        let dayUnits = 0;

        for (const subjectId in dayRecords) {
            if (subjectId.startsWith('_')) continue; // skip meta keys
            const record = dayRecords[subjectId];

            // Skip cancelled
            if (record.status === 'cancelled') continue;

            hasClasses = true;

            if (record.status === 'absent') {
                allPresent = false;
                break;
            }

            dayUnits += record.units || 1;
        }

        if (hasClasses && allPresent) {
            streak += dayUnits;
        } else if (hasClasses && !allPresent) {
            break; // streak broken
        }
        // If no classes (weekend/holiday), continue checking
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
    let streak = 0;
    const records = state.attendanceRecords || {};
    const holidays = state.holidays || [];
    const sortedDates = Object.keys(records).sort().reverse();

    for (const dateKey of sortedDates) {
        const dayRecords = records[dateKey];

        // Skip holidays
        if (dayRecords._holiday) continue;
        if (holidays.includes(dateKey)) continue;

        const record = dayRecords[subjectId];
        if (!record) continue; // No class that day
        if (record.status === 'cancelled') continue;

        if (record.status === 'present') {
            streak += record.units || 1;
        } else {
            break; // absent = streak broken
        }
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
