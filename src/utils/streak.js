import { recordUnits, recordAttendedUnits } from './attendance';

/**
 * Streaks, counted from the college register only.
 *
 * Walking backwards from the most recent recorded day: a fully attended day
 * adds its periods, any absence ends the streak, holidays and days the
 * college has not recorded are simply skipped — an unrecorded day means "not
 * uploaded yet", never "missed".
 */

const MAX_LOOKBACK = 180;

function recordedDays(state) {
    const records = state.attendanceRecords || {};
    const holidays = new Set(state.holidays || []);
    return Object.keys(records)
        .filter((d) => records[d] && !records[d]._holiday && !holidays.has(d))
        .sort()
        .reverse()
        .slice(0, MAX_LOOKBACK);
}

/** Consecutive fully attended periods across all subjects, newest first. */
export function calculateOverallStreak(state) {
    const records = state.attendanceRecords || {};
    let streak = 0;
    for (const dateKey of recordedDays(state)) {
        let dayUnits = 0;
        let broken = false;
        for (const [subjectId, rec] of Object.entries(records[dateKey])) {
            if (subjectId === '_holiday' || !rec || rec.source !== 'erp' || rec.status === 'cancelled') continue;
            const units = recordUnits(rec);
            if (recordAttendedUnits(rec) < units) { broken = true; break; }
            dayUnits += units;
        }
        if (broken) break;
        streak += dayUnits;
    }
    return streak;
}

/** Consecutive fully attended periods for one subject, newest first. */
export function calculateSubjectStreak(subjectId, state) {
    const records = state.attendanceRecords || {};
    let streak = 0;
    for (const dateKey of recordedDays(state)) {
        const rec = records[dateKey][subjectId];
        if (!rec || rec.source !== 'erp' || rec.status === 'cancelled') continue;
        const units = recordUnits(rec);
        if (recordAttendedUnits(rec) < units) break;
        streak += units;
    }
    return streak;
}

export function getStreakMessage(streak) {
    if (streak < 3) return null;
    if (streak >= 100) return 'Perfect attendance';
    if (streak >= 50) return 'Legendary streak';
    if (streak >= 25) return 'Unstoppable';
    if (streak >= 10) return 'On fire';
    if (streak >= 5) return 'Nice streak';
    return 'Keep it going';
}
