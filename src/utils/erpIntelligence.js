/**
 * ERP Intelligence — derives rich analytics from full attendanceRecords history.
 *
 * Pure utility: no state mutations, no side effects.
 * Call with useMemo — cheap to recompute on state changes.
 *
 * Returns:
 *   weekdayPatterns: which days you miss most
 *   subjectTrends:   per-subject improvement/decline over semester
 *   recentRhythm:    last 10 classes attended/missed streak
 *   semesterSummary: totals across full ERP data range
 *   smartInsights:   array of human-readable sentences to surface in UI
 */

import { getSubjectAttendance } from './attendance';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Main entry point — call once with full state, memoize the result.
 *
 * @param {Object} state - AppContext state
 * @returns {Object} intelligence model
 */
export function deriveErpIntelligence(state) {
    const records = state.attendanceRecords || {};
    const subjects = state.subjects || [];
    const holidays = state.holidays || [];

    // Only compute if we have meaningful ERP data
    const erpDateKeys = Object.keys(records).filter(dk => {
        const dayData = records[dk];
        return dayData && Object.values(dayData).some(r => r && r.source === 'erp');
    });

    if (erpDateKeys.length < 5) {
        return emptyIntelligence();
    }

    const weekdayPatterns = computeWeekdayPatterns(records, subjects, holidays);
    const subjectTrends   = computeSubjectTrends(records, subjects, holidays);
    const recentRhythm    = computeRecentRhythm(records, subjects, holidays);
    const semesterSummary = computeSemesterSummary(erpDateKeys, records, subjects, holidays);
    const smartInsights   = generateSmartInsights(weekdayPatterns, subjectTrends, recentRhythm, semesterSummary, subjects, state);

    return {
        weekdayPatterns,
        subjectTrends,
        recentRhythm,
        semesterSummary,
        smartInsights,
        hasData: true,
    };
}

// ─── Weekday Patterns ─────────────────────────────────────────────────

function computeWeekdayPatterns(records, subjects, holidays) {
    // { dayIndex: { present, absent, total, percentage } }
    const byDay = {};
    for (let i = 1; i <= 5; i++) byDay[i] = { present: 0, absent: 0, total: 0 };

    Object.entries(records).forEach(([dateKey, dayData]) => {
        if (!dayData || dayData._holiday || holidays.includes(dateKey)) return;

        const d = new Date(dateKey + 'T12:00:00');
        const dayIndex = d.getDay();
        if (dayIndex === 0 || dayIndex === 6) return; // Skip weekends

        Object.entries(dayData).forEach(([sid, rec]) => {
            if (sid === '_holiday' || !rec || !rec.status || rec.status === 'cancelled') return;
            if (rec.source !== 'erp') return; // only use ERP data for patterns

            const units = rec.units || 1;
            byDay[dayIndex].total += units;
            if (rec.status === 'present') byDay[dayIndex].present += units;
            else byDay[dayIndex].absent += units;
        });
    });

    // Compute percentages and find worst day
    let worstDayIndex = -1;
    let worstPct = 101;
    Object.entries(byDay).forEach(([day, data]) => {
        data.percentage = data.total > 0 ? Math.round((data.present / data.total) * 1000) / 10 : null;
        data.name = WEEKDAY_NAMES[day];
        if (data.total >= 3 && data.percentage !== null && data.percentage < worstPct) {
            worstPct = data.percentage;
            worstDayIndex = parseInt(day, 10);
        }
    });

    return { byDay, worstDayIndex, worstDayName: worstDayIndex >= 0 ? WEEKDAY_NAMES[worstDayIndex] : null };
}

// ─── Subject Trends ───────────────────────────────────────────────────

function computeSubjectTrends(records, subjects, holidays) {
    // For each subject, split ERP history in half and compare first half % vs second half %
    const trends = {};

    subjects.forEach(sub => {
        const subHistory = [];

        Object.entries(records).sort(([a], [b]) => a.localeCompare(b)).forEach(([dateKey, dayData]) => {
            if (!dayData || dayData._holiday || holidays.includes(dateKey)) return;
            const rec = dayData[sub.id];
            if (!rec || rec.source !== 'erp' || rec.status === 'cancelled') return;

            subHistory.push({ date: dateKey, status: rec.status, units: rec.units || 1 });
        });

        if (subHistory.length < 6) return;

        const mid = Math.floor(subHistory.length / 2);
        const firstHalf  = subHistory.slice(0, mid);
        const secondHalf = subHistory.slice(mid);

        const pct = (arr) => {
            const p = arr.reduce((s, e) => s + (e.status === 'present' ? e.units : 0), 0);
            const t = arr.reduce((s, e) => s + e.units, 0);
            return t > 0 ? Math.round((p / t) * 1000) / 10 : 0;
        };

        const firstPct  = pct(firstHalf);
        const secondPct = pct(secondHalf);
        const delta = secondPct - firstPct;

        trends[sub.id] = {
            name: sub.name,
            color: sub.color,
            firstHalfPct: firstPct,
            secondHalfPct: secondPct,
            delta,
            direction: delta > 3 ? 'improving' : delta < -3 ? 'declining' : 'stable',
            totalClasses: subHistory.length,
        };
    });

    return trends;
}

// ─── Recent Rhythm ────────────────────────────────────────────────────

function computeRecentRhythm(records, subjects, holidays) {
    // Last 10 ERP class instances across all subjects
    const allEvents = [];

    Object.entries(records).forEach(([dateKey, dayData]) => {
        if (!dayData || dayData._holiday || holidays.includes(dateKey)) return;
        Object.entries(dayData).forEach(([sid, rec]) => {
            if (sid === '_holiday' || !rec || rec.source !== 'erp' || rec.status === 'cancelled') return;
            allEvents.push({ date: dateKey, subjectId: sid, status: rec.status });
        });
    });

    // Sort newest first, take last 10
    allEvents.sort((a, b) => b.date.localeCompare(a.date));
    const recent = allEvents.slice(0, 10).reverse(); // oldest→newest for display

    const presentCount = recent.filter(e => e.status === 'present').length;
    const absentCount  = recent.filter(e => e.status === 'absent').length;

    return {
        events: recent,
        presentCount,
        absentCount,
        total: recent.length,
        recentPercentage: recent.length > 0
            ? Math.round((presentCount / recent.length) * 1000) / 10 : 0,
    };
}

// ─── Semester Summary ─────────────────────────────────────────────────

function computeSemesterSummary(erpDateKeys, records, subjects, holidays) {
    const sortedDates = [...erpDateKeys].filter(dk => {
        const d = records[dk];
        return d && !d._holiday && !holidays.includes(dk);
    }).sort();

    let totalPresent = 0;
    let totalAbsent  = 0;

    erpDateKeys.forEach(dk => {
        const dayData = records[dk];
        if (!dayData || dayData._holiday || holidays.includes(dk)) return;
        Object.entries(dayData).forEach(([sid, rec]) => {
            if (sid === '_holiday' || !rec || rec.source !== 'erp') return;
            const units = rec.units || 1;
            if (rec.status === 'present') totalPresent += units;
            else if (rec.status === 'absent') totalAbsent += units;
        });
    });

    const totalClasses = totalPresent + totalAbsent;

    return {
        earliestDate: sortedDates[0] || null,
        latestDate:   sortedDates[sortedDates.length - 1] || null,
        totalDays:    sortedDates.length,
        totalPresent,
        totalAbsent,
        totalClasses,
        overallPercentage: totalClasses > 0
            ? Math.round((totalPresent / totalClasses) * 1000) / 10 : 0,
    };
}

// ─── Smart Insights (human-readable sentences) ───────────────────────

function generateSmartInsights(weekdayPatterns, subjectTrends, recentRhythm, semesterSummary, subjects, state) {
    const insights = [];
    const threshold = state.settings?.dangerThreshold || 75;

    // Weekday miss pattern
    if (weekdayPatterns.worstDayName && weekdayPatterns.byDay[weekdayPatterns.worstDayIndex]?.percentage < 70) {
        const pct = weekdayPatterns.byDay[weekdayPatterns.worstDayIndex].percentage;
        insights.push({
            type: 'pattern',
            severity: 'warning',
            text: `You attend only ${pct.toFixed(0)}% of ${weekdayPatterns.worstDayName} classes — your lowest day.`,
        });
    }

    // Declining subjects
    const declining = Object.values(subjectTrends).filter(t => t.direction === 'declining' && t.delta < -5);
    declining.forEach(t => {
        insights.push({
            type: 'trend',
            severity: 'warning',
            text: `${t.name} has dropped from ${t.firstHalfPct.toFixed(0)}% to ${t.secondHalfPct.toFixed(0)}% this semester.`,
        });
    });

    // Improving subjects
    const improving = Object.values(subjectTrends).filter(t => t.direction === 'improving' && t.delta > 5);
    if (improving.length > 0) {
        const best = improving.sort((a, b) => b.delta - a.delta)[0];
        insights.push({
            type: 'trend',
            severity: 'success',
            text: `${best.name} is improving — up ${best.delta.toFixed(0)}% since the start of the semester.`,
        });
    }

    // Recent rhythm
    if (recentRhythm.total >= 5) {
        if (recentRhythm.recentPercentage >= 90) {
            insights.push({
                type: 'rhythm',
                severity: 'success',
                text: `You've attended ${recentRhythm.presentCount} of your last ${recentRhythm.total} classes. Strong recent form.`,
            });
        } else if (recentRhythm.recentPercentage < 60) {
            insights.push({
                type: 'rhythm',
                severity: 'warning',
                text: `You've missed ${recentRhythm.absentCount} of your last ${recentRhythm.total} classes. Your attendance is trending down.`,
            });
        }
    }

    // At-risk subjects (full semester data)
    const atRisk = subjects.filter(sub => {
        const stats = getSubjectAttendance(sub.id, state);
        return stats && stats.percentage < threshold && stats.totalUnits >= 10;
    });
    if (atRisk.length > 0) {
        const names = atRisk.map(s => s.name.split(' ')[0]).slice(0, 2).join(', ');
        insights.push({
            type: 'risk',
            severity: 'danger',
            text: `${atRisk.length} subject${atRisk.length > 1 ? 's' : ''} below ${threshold}% target: ${names}${atRisk.length > 2 ? ' and more' : ''}.`,
        });
    }

    return insights;
}

function emptyIntelligence() {
    return {
        weekdayPatterns: { byDay: {}, worstDayIndex: -1, worstDayName: null },
        subjectTrends:   {},
        recentRhythm:    { events: [], presentCount: 0, absentCount: 0, total: 0, recentPercentage: 0 },
        semesterSummary: { earliestDate: null, latestDate: null, totalDays: 0, totalPresent: 0, totalAbsent: 0, totalClasses: 0, overallPercentage: 0 },
        smartInsights:   [],
        hasData:         false,
    };
}
