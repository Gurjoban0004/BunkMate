import { getDateKey } from './dateHelpers';
import { recordUnits, recordAttendedUnits, calculatePercentage, roundPct, getSubjectSkipBudget } from './attendance';

/**
 * Get the start of the current week (Monday).
 */
function getStartOfWeek(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday = start
    d.setDate(d.getDate() + diff);
    return d;
}

/**
 * Get the end of the current week (Sunday).
 */
function getEndOfWeek(date) {
    const start = getStartOfWeek(date);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return end;
}

/**
 * Format a date as "Jan 13".
 */
function formatShortDate(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Generate a weekly summary of attendance data.
 */
export function generateWeeklySummary(state) {
    const weekStart = getStartOfWeek(new Date());
    const weekEnd = getEndOfWeek(new Date());

    const records = state.attendanceRecords || {};
    const holidays = state.holidays || [];
    const trackingStartDate = state.trackingStartDate;

    let totalClasses = 0;
    let attendedClasses = 0;
    const subjectStats = {};
    const dailyStatus = {};

    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        const dateKey = getDateKey(d);
        const dayRecord = records[dateKey];
        const isHoliday = dayRecord?._holiday || holidays.includes(dateKey);

        // Skip days before tracking started
        if (trackingStartDate && dateKey < trackingStartDate) {
            dailyStatus[dayNames[i]] = 'no_class';
            continue;
        }

        if (!dayRecord || isHoliday) {
            dailyStatus[dayNames[i]] = 'no_class';
            continue;
        }

        let dayTotal = 0;
        let dayAttended = 0;

        Object.entries(dayRecord).forEach(([subjectId, record]) => {
            if (subjectId.startsWith('_')) return;
            if (record.status === 'cancelled') return;

            const units = recordUnits(record);
            const attended = recordAttendedUnits(record);

            dayTotal += units;
            dayAttended += attended;

            if (!subjectStats[subjectId]) {
                subjectStats[subjectId] = { total: 0, attended: 0 };
            }
            subjectStats[subjectId].total += units;
            subjectStats[subjectId].attended += attended;
        });

        totalClasses += dayTotal;
        attendedClasses += dayAttended;

        if (dayTotal === 0) {
            dailyStatus[dayNames[i]] = 'no_class';
        } else if (dayAttended === dayTotal) {
            dailyStatus[dayNames[i]] = 'perfect';
        } else if (dayAttended / dayTotal >= 0.5) {
            dailyStatus[dayNames[i]] = 'partial';
        } else {
            dailyStatus[dayNames[i]] = 'poor';
        }
    }

    const sortedSubjects = Object.entries(subjectStats)
        .map(([id, stats]) => ({
            id,
            name: state.subjects.find((s) => s.id === id)?.name || 'Unknown',
            color: state.subjects.find((s) => s.id === id)?.color,
            percentage: roundPct(calculatePercentage(stats.attended, stats.total)),
            total: stats.total,
            attended: stats.attended,
        }))
        .sort((a, b) => b.percentage - a.percentage);

    const overallPercentage = roundPct(calculatePercentage(attendedClasses, totalClasses));

    // Generate tip.
    // The recovery number has to come from the subject's SEMESTER totals — one
    // bad week says nothing about how many classes actually get you to 75%.
    let tip = 'Great work! Keep maintaining your attendance.';
    const worst = sortedSubjects[sortedSubjects.length - 1];
    if (worst) {
        const budget = getSubjectSkipBudget(worst.id, state);
        if (budget && !budget.onTrack && Number.isFinite(budget.needClasses)) {
            const n = budget.needClasses;
            tip = `Attend ${n} more ${worst.name} ${n === 1 ? 'class' : 'classes'} to reach ${budget.target}%.`;
        }
    }

    return {
        weekRange: `${formatShortDate(weekStart)} – ${formatShortDate(weekEnd)}`,
        overallPercentage,
        totalClasses,
        attendedClasses,
        bestSubject: sortedSubjects[0] || null,
        worstSubject: worst || null,
        sortedSubjects,
        dailyStatus,
        tip,
    };
}
