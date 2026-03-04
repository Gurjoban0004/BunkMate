/**
 * Pattern recognition and analytics for attendance data.
 * Works with the history[] array from our data adapter.
 */

/**
 * Analyze attendance patterns for a subject.
 */
export function analyzePatterns(subject) {
    const { history } = subject;

    if (!history || history.length === 0) {
        return getDefaultPatterns();
    }

    return {
        byDay: analyzeByDay(history),
        byTime: analyzeByTime(history),
        streaks: analyzeStreaks(history),
        trends: analyzeTrends(subject),
        last5: getLast5Classes(history),
    };
}

/**
 * Analyze attendance by day of week.
 */
function analyzeByDay(history) {
    const byDay = {};

    // Initialize all days
    for (let i = 0; i < 7; i++) {
        byDay[i] = { attended: 0, total: 0, percentage: 0 };
    }

    history.forEach(entry => {
        const day = new Date(entry.date).getDay();
        byDay[day].total++;
        if (entry.status === 'present') {
            byDay[day].attended++;
        }
    });

    // Calculate percentages
    Object.keys(byDay).forEach(day => {
        const data = byDay[day];
        data.percentage = data.total > 0 ? (data.attended / data.total) * 100 : 0;
    });

    return byDay;
}

/**
 * Analyze by time of day (morning/afternoon/evening).
 */
function analyzeByTime(history) {
    const byTime = {
        morning: { attended: 0, total: 0 },
        afternoon: { attended: 0, total: 0 },
        evening: { attended: 0, total: 0 },
    };

    history.forEach(entry => {
        const hour = new Date(entry.date).getHours();
        let period;

        if (hour >= 6 && hour < 12) period = 'morning';
        else if (hour >= 12 && hour < 18) period = 'afternoon';
        else period = 'evening';

        byTime[period].total++;
        if (entry.status === 'present') {
            byTime[period].attended++;
        }
    });

    return byTime;
}

/**
 * Analyze attendance streaks.
 */
function analyzeStreaks(history) {
    if (history.length === 0) return getDefaultStreaks();

    // Sort by date (newest first for current streak)
    const sorted = [...history].sort((a, b) =>
        new Date(b.date) - new Date(a.date)
    );

    // Current streak
    let currentType = sorted[0].status;
    let currentCount = 1;
    let currentStart = sorted[0].date;

    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].status === currentType) {
            currentCount++;
            currentStart = sorted[i].date;
        } else {
            break;
        }
    }

    // Longest streaks
    let longestPresent = { count: 0, start: null, end: null };
    let longestAbsent = { count: 0, start: null, end: null };

    let tempPresent = 0, tempAbsent = 0;
    let tempPresentStart = null, tempAbsentStart = null;

    const chronological = [...history].sort((a, b) =>
        new Date(a.date) - new Date(b.date)
    );

    chronological.forEach(entry => {
        if (entry.status === 'present') {
            tempAbsent = 0;
            tempAbsentStart = null;

            if (tempPresent === 0) tempPresentStart = entry.date;
            tempPresent++;

            if (tempPresent > longestPresent.count) {
                longestPresent = {
                    count: tempPresent,
                    start: tempPresentStart,
                    end: entry.date,
                };
            }
        } else {
            tempPresent = 0;
            tempPresentStart = null;

            if (tempAbsent === 0) tempAbsentStart = entry.date;
            tempAbsent++;

            if (tempAbsent > longestAbsent.count) {
                longestAbsent = {
                    count: tempAbsent,
                    start: tempAbsentStart,
                    end: entry.date,
                };
            }
        }
    });

    return {
        current: {
            type: currentType,
            count: currentCount,
            start: currentStart,
        },
        longestPresent,
        longestAbsent,
    };
}

/**
 * Analyze percentage trends over time.
 */
function analyzeTrends(subject) {
    const { history, attended, total } = subject;

    if (!history || history.length < 5) {
        return {
            direction: 'stable',
            dataPoints: [],
            projectedDate: null,
        };
    }

    const sorted = [...history].sort((a, b) =>
        new Date(a.date) - new Date(b.date)
    );

    const interval = Math.floor(sorted.length / 5);
    const dataPoints = [];

    for (let i = 0; i < 5; i++) {
        const index = i * interval;
        if (index >= sorted.length) break;

        const upToHere = sorted.slice(0, index + 1);
        const attendedCount = upToHere.filter(e => e.status === 'present').length;
        const totalCount = upToHere.length;

        dataPoints.push({
            date: sorted[index].date,
            percentage: (attendedCount / totalCount) * 100,
        });
    }

    // Add current
    if (total > 0) {
        dataPoints.push({
            date: new Date().toISOString(),
            percentage: (attended / total) * 100,
        });
    }

    // Determine direction
    const first = dataPoints[0]?.percentage || 0;
    const last = dataPoints[dataPoints.length - 1]?.percentage || 0;
    const diff = last - first;

    let direction;
    if (diff < -3) direction = 'declining';
    else if (diff > 3) direction = 'improving';
    else direction = 'stable';

    return {
        direction,
        dataPoints,
        projectedDate: null,
    };
}

/**
 * Get last 5 classes (oldest to newest for display).
 */
function getLast5Classes(history) {
    return [...history]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5)
        .reverse();
}

function getDefaultPatterns() {
    return {
        byDay: {},
        byTime: {},
        streaks: getDefaultStreaks(),
        trends: { direction: 'stable', dataPoints: [] },
        last5: [],
    };
}

function getDefaultStreaks() {
    return {
        current: { type: null, count: 0, start: null },
        longestPresent: { count: 0, start: null, end: null },
        longestAbsent: { count: 0, start: null, end: null },
    };
}

/**
 * Generate smart insights from patterns.
 */
export function generateInsights(patterns, subject) {
    const insights = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Day pattern insight
    const dayData = Object.entries(patterns.byDay || {});
    if (dayData.length > 0) {
        const sorted = dayData
            .filter(([_, data]) => data.total > 0)
            .sort((a, b) => a[1].percentage - b[1].percentage);

        if (sorted.length > 0) {
            const worstDay = sorted[0];
            if (worstDay[1].percentage < 60 && worstDay[1].total >= 3) {
                insights.push({
                    type: 'warning',
                    text: `You skip ${dayNames[worstDay[0]]}s often (${worstDay[1].percentage.toFixed(0)}% attendance)`,
                });
            }
        }
    }

    // Streak insight
    if (patterns.streaks?.current?.type === 'absent' && patterns.streaks.current.count >= 2) {
        insights.push({
            type: 'warning',
            text: `${patterns.streaks.current.count} skips in a row — don't make it ${patterns.streaks.current.count + 1}!`,
        });
    }

    // Trend insight
    if (patterns.trends?.direction === 'declining') {
        const first = patterns.trends.dataPoints?.[0];
        const last = patterns.trends.dataPoints?.[patterns.trends.dataPoints.length - 1];

        if (first && last) {
            insights.push({
                type: 'warning',
                text: `Trending down from ${first.percentage.toFixed(0)}%`,
            });
        }
    }

    // Positive insight
    if (patterns.streaks?.current?.type === 'present' && patterns.streaks.current.count >= 5) {
        insights.push({
            type: 'success',
            text: `🔥 ${patterns.streaks.current.count} classes attended in a row! Keep it up!`,
        });
    }

    return insights;
}
