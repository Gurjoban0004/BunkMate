/**
 * Intelligence engine — generates smart recommendations,
 * week strategies, and consequence warnings.
 */

import { getTodaysClasses, getNext7DaysClasses } from './scheduleProcessor';
import {
    calculateSkipImpact,
    calculateAttendImpact,
    determineStatus,
} from './attendanceCalculations';
import { analyzePatterns } from './patternRecognition';

/**
 * Generate smart recommendations for today's classes.
 */
export function generateTodayRecommendations(subjects) {
    const todayClasses = getTodaysClasses(subjects);

    if (todayClasses.length === 0) return null;

    const analysis = todayClasses.map(({ subject, time }) => {
        const skipImpact = calculateSkipImpact(subject.attended, subject.total);
        const attendImpact = calculateAttendImpact(subject.attended, subject.total);

        const skipStatus = determineStatus(
            skipImpact.newPercentage,
            subject.target || 75
        );
        const attendStatus = determineStatus(
            attendImpact.newPercentage,
            subject.target || 75
        );

        return {
            subject,
            time,
            skipImpact: { ...skipImpact, status: skipStatus },
            attendImpact: { ...attendImpact, status: attendStatus },
            priority: skipStatus === 'danger' ? 1 : skipStatus === 'warning' ? 2 : 3,
        };
    });
    // Sort by priority (risky first)
    analysis.sort((a, b) => a.priority - b.priority);

    // Generate overall recommendation
    const dangerCount = analysis.filter(a => a.skipImpact.status === 'danger').length;
    const warningCount = analysis.filter(a => a.skipImpact.status === 'warning').length;

    let recommendation;
    if (dangerCount > 0) {
        recommendation = {
            verdict: 'danger',
            message: `⚠️ ${dangerCount} critical class${dangerCount > 1 ? 'es' : ''} today`,
            advice: 'Attend all risky subjects',
        };
    } else if (warningCount > 0) {
        recommendation = {
            verdict: 'warning',
            message: `🟡 ${warningCount} class${warningCount > 1 ? 'es' : ''} need attention`,
            advice: 'Be selective about skipping',
        };
    } else {
        recommendation = {
            verdict: 'safe',
            message: '✅ All classes safe today',
            advice: 'Skip freely if needed',
        };
    }

    return {
        analysis,
        recommendation,
    };
}

/**
 * Generate week-level strategy for a subject.
 */
export function generateWeekStrategy(subject) {
    const next7Days = getNext7DaysClasses(subject);

    if (next7Days.length === 0) return null;

    const scenarios = next7Days.map((classInfo) => {
        // Simulate attending this one class (independent scenario per class)
        const newAttended = subject.attended + 1;
        const newTotal = subject.total + 1;
        const percentage = newTotal > 0 ? (newAttended / newTotal) * 100 : 0;

        return {
            classInfo,
            percentage,
            status: determineStatus(percentage, subject.target || 75),
        };
    });

    const critical = scenarios.filter(s => s.status === 'danger');
    const safe = scenarios.filter(s => s.status === 'safe');

    return {
        next7Days: scenarios,
        criticalClasses: critical,
        safeClasses: safe,
        advice: generateWeekAdvice(critical, safe, next7Days.length),
    };
}

function generateWeekAdvice(critical, safe, total) {
    if (critical.length === 0) {
        return `All ${total} classes this week are safe to skip`;
    } else if (critical.length === total) {
        return `All ${total} classes are critical — attend everything`;
    } else {
        return `${critical.length} critical, ${safe.length} safe — be selective`;
    }
}

/**
 * Generate consequence chain warnings.
 */
export function generateConsequenceChains(subject) {
    const warnings = [];
    const patterns = analyzePatterns(subject);

    // Check for consecutive skips
    if (patterns.streaks?.current?.type === 'absent') {
        const count = patterns.streaks.current.count;

        // Simulate one more skip
        const afterOneMore = calculateSkipImpact(subject.attended, subject.total + count);

        if (determineStatus(afterOneMore.newPercentage, subject.target || 75) === 'danger') {
            warnings.push({
                type: 'consecutive_skip',
                message: `Skipping again drops you to ${afterOneMore.newPercentage}% (danger zone)`,
            });
        }
    }

    return warnings;
}
