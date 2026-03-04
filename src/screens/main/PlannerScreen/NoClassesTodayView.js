import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../../theme/theme';
import StatusDot from '../../../components/planner/shared/StatusDot';
import PlannerProgressBar from '../../../components/planner/shared/PlannerProgressBar';
import { determineStatus } from '../../../utils/planner/attendanceCalculations';
import { analyzePatterns, generateInsights } from '../../../utils/planner/patternRecognition';

/**
 * No classes today view — shows week report, subject movements, insights,
 * and next week preview. Displays when the user has no classes scheduled today.
 */
export default function NoClassesTodayView({ subjects }) {
    // Overall stats
    const overallStats = useMemo(() => {
        if (subjects.length === 0) return { attended: 0, total: 0, percentage: 0 };
        const attended = subjects.reduce((sum, s) => sum + s.attended, 0);
        const total = subjects.reduce((sum, s) => sum + s.total, 0);
        return {
            attended,
            total,
            percentage: total > 0 ? (attended / total) * 100 : 0,
        };
    }, [subjects]);

    // Sort by percentage
    const sortedSubjects = useMemo(
        () => [...subjects].sort((a, b) => a.percentage - b.percentage),
        [subjects]
    );

    // Safety counts
    const dangerCount = sortedSubjects.filter(s => determineStatus(s.percentage, s.target) === 'danger').length;
    const warningCount = sortedSubjects.filter(s => determineStatus(s.percentage, s.target) === 'warning').length;
    const safeCount = sortedSubjects.filter(s => determineStatus(s.percentage, s.target) === 'safe').length;

    // Collect all insights
    const allInsights = useMemo(() => {
        const insights = [];
        subjects.forEach(subject => {
            const patterns = analyzePatterns(subject);
            const subInsights = generateInsights(patterns, subject);
            subInsights.forEach(insight => {
                insights.push({ ...insight, subjectName: subject.name });
            });
        });
        return insights;
    }, [subjects]);

    return (
        <View style={styles.container}>
            {/* Hero */}
            <View style={styles.hero}>
                <Text style={styles.heroEmoji}>😎</Text>
                <Text style={styles.heroText}>No classes today!</Text>
                <Text style={styles.heroSub}>Here's how you're doing overall</Text>
            </View>

            {/* Overall stats */}
            <View style={styles.overallCard}>
                <Text style={styles.overallPercentage}>
                    {overallStats.percentage.toFixed(1)}%
                </Text>
                <Text style={styles.overallLabel}>Overall Attendance</Text>
                <PlannerProgressBar percentage={overallStats.percentage} target={75} height={8} />
                <View style={styles.countsRow}>
                    <View style={styles.countItem}>
                        <StatusDot status="danger" size={8} />
                        <Text style={styles.countText}>{dangerCount} critical</Text>
                    </View>
                    <View style={styles.countItem}>
                        <StatusDot status="warning" size={8} />
                        <Text style={styles.countText}>{warningCount} warning</Text>
                    </View>
                    <View style={styles.countItem}>
                        <StatusDot status="safe" size={8} />
                        <Text style={styles.countText}>{safeCount} safe</Text>
                    </View>
                </View>
            </View>

            {/* Subject standings */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Subject Standings</Text>
                {sortedSubjects.map(subject => {
                    const status = determineStatus(subject.percentage, subject.target);
                    return (
                        <View key={subject.id} style={styles.subjectRow}>
                            <View style={styles.subjectLeft}>
                                <View style={[styles.colorDot, { backgroundColor: subject.color || COLORS.primary }]} />
                                <Text style={styles.subjectName} numberOfLines={1}>{subject.name}</Text>
                            </View>
                            <View style={styles.subjectRight}>
                                <Text style={[styles.subjectPercentage, {
                                    color: status === 'danger' ? COLORS.danger :
                                        status === 'warning' ? COLORS.warningDark : COLORS.successDark
                                }]}>
                                    {subject.percentage.toFixed(1)}%
                                </Text>
                                <Text style={styles.subjectFraction}>
                                    {subject.attended}/{subject.total}
                                </Text>
                            </View>
                        </View>
                    );
                })}
            </View>

            {/* Insights */}
            {allInsights.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Insights</Text>
                    {allInsights.slice(0, 5).map((insight, idx) => (
                        <View key={idx} style={[
                            styles.insightRow,
                            insight.type === 'warning' && { backgroundColor: COLORS.warningLight },
                            insight.type === 'success' && { backgroundColor: COLORS.successLight },
                        ]}>
                            <Text style={styles.insightSubject}>{insight.subjectName}</Text>
                            <Text style={styles.insightText}>{insight.text}</Text>
                        </View>
                    ))}
                </View>
            )}

            <View style={{ height: SPACING.xxl }} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    hero: {
        alignItems: 'center',
        paddingVertical: SPACING.xl,
    },
    heroEmoji: {
        fontSize: 48,
        marginBottom: SPACING.sm,
    },
    heroText: {
        fontSize: FONT_SIZES.xl,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    heroSub: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        marginTop: SPACING.xs,
    },
    overallCard: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.lg,
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.md,
        alignItems: 'center',
        ...SHADOWS.medium,
    },
    overallPercentage: {
        fontSize: 40,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
    },
    overallLabel: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
        marginBottom: SPACING.md,
    },
    countsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        marginTop: SPACING.md,
    },
    countItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    countText: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
    },
    section: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.md,
        ...SHADOWS.small,
    },
    sectionTitle: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: SPACING.md,
    },
    subjectRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    subjectLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    colorDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    subjectName: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textPrimary,
        flex: 1,
    },
    subjectRight: {
        alignItems: 'flex-end',
    },
    subjectPercentage: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '700',
    },
    subjectFraction: {
        fontSize: 10,
        color: COLORS.textMuted,
    },
    insightRow: {
        backgroundColor: COLORS.background,
        borderRadius: BORDER_RADIUS.sm,
        padding: SPACING.sm,
        marginBottom: SPACING.xs,
    },
    insightSubject: {
        fontSize: 10,
        fontWeight: '600',
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    insightText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
    },
});
