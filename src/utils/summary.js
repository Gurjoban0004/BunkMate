import { getDateKey } from './dateHelpers';

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

        if (!dayRecord || isHoliday) {
            dailyStatus[dayNames[i]] = 'no_class';
            continue;
        }

        let dayTotal = 0;
        let dayAttended = 0;

        Object.entries(dayRecord).forEach(([subjectId, record]) => {
            if (subjectId.startsWith('_')) return;
            if (record.status === 'cancelled') return;

            dayTotal += record.units || 1;
            if (record.status === 'present') {
                dayAttended += record.units || 1;
            }

            if (!subjectStats[subjectId]) {
                subjectStats[subjectId] = { total: 0, attended: 0 };
            }
            subjectStats[subjectId].total += record.units || 1;
            if (record.status === 'present') {
                subjectStats[subjectId].attended += record.units || 1;
            }
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
            percentage: stats.total > 0 ? Math.round((stats.attended / stats.total) * 100) : 0,
            total: stats.total,
            attended: stats.attended,
        }))
        .sort((a, b) => b.percentage - a.percentage);

    const overallPercentage = totalClasses > 0 ? Math.round((attendedClasses / totalClasses) * 100) : 0;

    // Generate tip
    let tip = 'Great work! Keep maintaining your attendance.';
    const worst = sortedSubjects[sortedSubjects.length - 1];
    if (worst && worst.percentage < 75) {
        const needed = Math.ceil((0.75 * worst.total - worst.attended) / (1 - 0.75));
        tip = `Attend ${Math.max(1, needed)} more ${worst.name} classes to reach 75%!`;
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
