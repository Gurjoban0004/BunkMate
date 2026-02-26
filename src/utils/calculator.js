import { getSubjectAttendance, calculatePercentage } from './attendance';
import { getClassesForDay } from './planner';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Calculate new percentage after bunking X classes.
 */
export function calculateImpact(attended, total, bunkCount) {
    if (total + bunkCount === 0) return 0;
    const newPercentage = (attended / (total + bunkCount)) * 100;
    return Math.round(newPercentage * 10) / 10;
}

/**
 * Max classes that can be bunked while staying at or above target%.
 */
export function calculateMaxBunks(attended, total, targetPercent) {
    const target = targetPercent / 100;
    if (total === 0) return 0;
    const currentPercent = attended / total;
    if (currentPercent < target) return 0;

    const maxBunks = Math.floor((attended - target * total) / target);
    return Math.max(0, maxBunks);
}

/**
 * How many consecutive classes needed to reach target% from below.
 */
export function calculateRecovery(attended, total, targetPercent) {
    const target = targetPercent / 100;
    const currentPercent = total === 0 ? 0 : attended / total;
    if (currentPercent >= target) return 0;

    const needed = Math.ceil((target * total - attended) / (1 - target));
    return Math.max(0, needed);
}

/**
 * Detect which day of the week the user bunks a subject most.
 * Returns { patternDay, bunkCount, totalBunks, percentage } or null.
 */
export function detectPattern(subjectId, state) {
    const dayCounts = {};
    DAY_NAMES.forEach(d => { dayCounts[d] = 0; });
    let totalBunks = 0;

    // Check which days this subject falls on
    const subjectDays = {};
    DAY_NAMES.forEach(day => {
        const slots = state.timetable[day] || [];
        slots.forEach(slot => {
            if (slot.subjectId === subjectId) {
                subjectDays[day] = true;
            }
        });
    });

    // Count bunks per day
    Object.entries(state.attendanceRecords).forEach(([dateKey, dayRecord]) => {
        if (dayRecord._holiday) return;
        const record = dayRecord[subjectId];
        if (record && record.status === 'absent') {
            // Determine day of week from date
            const date = new Date(dateKey);
            const dayIndex = date.getDay(); // 0=Sun, 1=Mon, ...
            const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayIndex];
            if (DAY_NAMES.includes(dayName)) {
                dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;
                totalBunks++;
            }
        }
    });

    if (totalBunks < 2) return null;

    // Find the day with most bunks
    let maxDay = null;
    let maxCount = 0;
    Object.entries(dayCounts).forEach(([day, count]) => {
        if (count > maxCount) {
            maxCount = count;
            maxDay = day;
        }
    });

    const percentage = Math.round((maxCount / totalBunks) * 100);
    if (percentage < 40) return null; // No strong pattern

    return {
        patternDay: maxDay,
        bunkCount: maxCount,
        totalBunks,
        percentage,
    };
}

/**
 * Compare recent vs older attendance to detect trend.
 * Returns 'improving' | 'declining' | 'stable'.
 */
export function calculateTrend(subjectId, state) {
    const now = new Date();
    const records = [];

    Object.entries(state.attendanceRecords).forEach(([dateKey, dayRecord]) => {
        if (dayRecord._holiday) return;
        const record = dayRecord[subjectId];
        if (record && record.status !== 'cancelled') {
            records.push({
                date: new Date(dateKey),
                present: record.status === 'present',
                units: record.units || 1,
            });
        }
    });

    if (records.length < 4) return 'stable';

    records.sort((a, b) => a.date - b.date);

    // Split into two halves
    const mid = Math.floor(records.length / 2);
    const olderHalf = records.slice(0, mid);
    const recentHalf = records.slice(mid);

    const calcRate = (arr) => {
        let attended = 0, total = 0;
        arr.forEach(r => {
            total += r.units;
            if (r.present) attended += r.units;
        });
        return total === 0 ? 0 : (attended / total) * 100;
    };

    const olderRate = calcRate(olderHalf);
    const recentRate = calcRate(recentHalf);

    if (recentRate > olderRate + 5) return 'improving';
    if (recentRate < olderRate - 5) return 'declining';
    return 'stable';
}

/**
 * Find the safest day to bunk a subject, considering all subjects on that day.
 * Returns { bestDay, reason } or null.
 */
export function findBestBunkDay(subjectId, state, threshold = 75) {
    const target = threshold / 100;
    let bestDay = null;
    let bestScore = -Infinity;
    let bestReason = '';

    DAY_NAMES.forEach(day => {
        const daySlots = state.timetable[day] || [];
        // Check if this subject is on this day
        const hasSubject = daySlots.some(s => s.subjectId === subjectId);
        if (!hasSubject) return;

        // Get unique subjects on this day
        const subjectIds = [...new Set(daySlots.map(s => s.subjectId))];

        let allSafe = true;
        let totalBuffer = 0;

        subjectIds.forEach(sid => {
            const stats = getSubjectAttendance(sid, state);
            if (!stats) return;
            const buffer = stats.percentage - threshold;
            totalBuffer += buffer;
            if (stats.percentage < threshold + 3) {
                allSafe = false;
            }
        });

        const score = totalBuffer / subjectIds.length;
        if (score > bestScore) {
            bestScore = score;
            bestDay = day;
            bestReason = allSafe
                ? 'Other subjects are safe too'
                : 'Best option considering other classes';
        }
    });

    return bestDay ? { bestDay, reason: bestReason } : null;
}

/**
 * Rank all subjects by attendance percentage.
 * Returns sorted array with rank info.
 */
export function compareSubjects(state) {
    const results = state.subjects.map(subject => {
        const stats = getSubjectAttendance(subject.id, state);
        return {
            id: subject.id,
            name: subject.name,
            color: subject.color,
            percentage: stats?.percentage || 0,
            attendedUnits: stats?.attendedUnits || 0,
            totalUnits: stats?.totalUnits || 0,
        };
    });

    results.sort((a, b) => b.percentage - a.percentage);
    return results.map((item, index) => ({
        ...item,
        rank: index + 1,
        total: results.length,
    }));
}

/**
 * Get personalized greeting message based on subject performance.
 */
export function getPersonalizedMessage(percentage, subjectName) {
    if (percentage >= 85) return `You're doing great in ${subjectName}! 🎉`;
    if (percentage >= 75) return `Keep it steady in ${subjectName}`;
    if (percentage >= 70) return `${subjectName} needs some attention ⚠️`;
    return `Let's fix ${subjectName} together 💪`;
}

/**
 * Get contextual bunk result message.
 */
export function getResultMessage(count, status) {
    if (status === 'safe') {
        if (count >= 5) return 'Nice cushion! You have room to breathe';
        if (count >= 2) return 'A few bunks available, use them wisely!';
        if (count === 1) return 'Tight! Only 1 bunk — save it for emergencies';
        return 'No bunks available. Time to be regular!';
    }
    return `Focus mode: Attend ${count} classes to recover`;
}

/**
 * Get trend display info (emoji, label, color key).
 */
export function getTrendInfo(trend) {
    switch (trend) {
        case 'improving':
            return { emoji: '📈', label: 'Improving', colorKey: 'success' };
        case 'declining':
            return { emoji: '📉', label: 'Declining', colorKey: 'danger' };
        default:
            return { emoji: '➡️', label: 'Stable', colorKey: 'info' };
    }
}

/**
 * Estimate remaining classes for a subject based on timetable.
 * Assumes ~10 weeks remaining by default.
 */
export function estimateRemainingClasses(subjectId, state, weeksLeft = 10) {
    let classesPerWeek = 0;
    DAY_NAMES.forEach(day => {
        const slots = state.timetable[day] || [];
        slots.forEach(slot => {
            if (slot.subjectId === subjectId) {
                classesPerWeek++;
            }
        });
    });
    return classesPerWeek * weeksLeft;
}

/**
 * Get next class info for a subject from timetable.
 * Returns { day, startTime, endTime } or null.
 */
export function getNextClass(subjectId, state) {
    const now = new Date();
    const currentDayIndex = now.getDay(); // 0=Sun
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Map JS day index to our day names
    const jsToDay = [null, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Check today first, then upcoming days
    for (let offset = 0; offset < 7; offset++) {
        const checkDayIndex = ((currentDayIndex + offset) % 7);
        const dayName = jsToDay[checkDayIndex];
        if (!dayName) continue; // Skip Sunday

        const slots = state.timetable[dayName] || [];
        for (const slot of slots) {
            if (slot.subjectId !== subjectId) continue;

            const timeSlot = state.timeSlots.find(ts => ts.id === slot.slotId);
            if (!timeSlot) continue;

            const [startH, startM] = timeSlot.start.split(':').map(Number);
            const slotMinutes = startH * 60 + startM;

            // If today, only future slots
            if (offset === 0 && slotMinutes <= currentMinutes) continue;

            return {
                day: offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : dayName,
                startTime: timeSlot.start,
                endTime: timeSlot.end,
            };
        }
    }
    return null;
}
