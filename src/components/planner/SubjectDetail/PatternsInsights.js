import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../../theme/theme';
import { analyzePatterns, generateInsights } from '../../../utils/planner/patternRecognition';

/**
 * Pattern insights and behavioral data for a subject.
 */
export default function PatternsInsights({ subjectData }) {
    const patterns = useMemo(() => analyzePatterns(subjectData), [subjectData]);
    const insights = useMemo(
        () => generateInsights(patterns, subjectData),
        [patterns, subjectData]
    );

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Get active days (days with data)
    const activeDays = Object.entries(patterns.byDay || {})
        .filter(([_, data]) => data.total > 0)
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Patterns & Insights</Text>

            {/* Insights */}
            {insights.length > 0 && (
                <View style={styles.insightsSection}>
                    {insights.map((insight, idx) => (
                        <View key={idx} style={[
                            styles.insightChip,
                            insight.type === 'warning' && styles.warningChip,
                            insight.type === 'success' && styles.successChip,
                        ]}>
                            <Text style={[
                                styles.insightText,
                                insight.type === 'warning' && { color: COLORS.warningDark },
                                insight.type === 'success' && { color: COLORS.successDark },
                            ]}>
                                {insight.text}
                            </Text>
                        </View>
                    ))}
                </View>
            )}

            {/* Day pattern */}
            {activeDays.length > 0 && (
                <View style={styles.daySection}>
                    <Text style={styles.sectionLabel}>By Day</Text>
                    <View style={styles.daysGrid}>
                        {activeDays.map(([day, data]) => (
                            <View key={day} style={styles.dayItem}>
                                <Text style={styles.dayName}>{dayNames[parseInt(day)]}</Text>
                                <View style={styles.miniBar}>
                                    <View style={[
                                        styles.miniBarFill,
                                        {
                                            width: `${Math.min(data.percentage, 100)}%`,
                                            backgroundColor: data.percentage >= 75 ? COLORS.success :
                                                data.percentage >= 60 ? COLORS.warning : COLORS.danger,
                                        },
                                    ]} />
                                </View>
                                <Text style={styles.dayPercentage}>
                                    {data.percentage.toFixed(0)}%
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}

            {/* Streaks */}
            {patterns.streaks?.current?.type && (
                <View style={styles.streakSection}>
                    <Text style={styles.sectionLabel}>Current Streak</Text>
                    <Text style={[styles.streakText, {
                        color: patterns.streaks.current.type === 'present' ? COLORS.successDark : COLORS.danger,
                    }]}>
                        {patterns.streaks.current.count}x {patterns.streaks.current.type}
                    </Text>
                </View>
            )}

            {/* Last 5 classes */}
            {patterns.last5?.length > 0 && (
                <View style={styles.last5Section}>
                    <Text style={styles.sectionLabel}>Last 5 Classes</Text>
                    <View style={styles.last5Row}>
                        {patterns.last5.map((entry, idx) => (
                            <View key={idx} style={[
                                styles.last5Dot,
                                {
                                    backgroundColor: entry.status === 'present'
                                        ? COLORS.success : COLORS.danger,
                                },
                            ]} />
                        ))}
                    </View>
                </View>
            )}

            {/* Trend */}
            {patterns.trends?.direction && patterns.trends.direction !== 'stable' && (
                <View style={styles.trendSection}>
                    <Text style={styles.sectionLabel}>Trend</Text>
                    <Text style={[styles.trendText, {
                        color: patterns.trends.direction === 'improving'
                            ? COLORS.successDark : COLORS.danger,
                    }]}>
                        {patterns.trends.direction === 'improving' ? '📈 Improving' : '📉 Declining'}
                    </Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        ...SHADOWS.small,
    },
    title: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: SPACING.md,
    },
    insightsSection: {
        marginBottom: SPACING.md,
    },
    insightChip: {
        backgroundColor: COLORS.background,
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs + 2,
        borderRadius: BORDER_RADIUS.sm,
        marginBottom: SPACING.xs,
    },
    warningChip: {
        backgroundColor: COLORS.warningLight,
    },
    successChip: {
        backgroundColor: COLORS.successLight,
    },
    insightText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
    },
    daySection: {
        marginBottom: SPACING.md,
    },
    sectionLabel: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '600',
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: SPACING.sm,
    },
    daysGrid: {
        gap: SPACING.xs,
    },
    dayItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    dayName: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
        width: 30,
    },
    miniBar: {
        flex: 1,
        height: 6,
        backgroundColor: COLORS.border,
        borderRadius: 3,
    },
    miniBarFill: {
        height: 6,
        borderRadius: 3,
    },
    dayPercentage: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
        width: 35,
        textAlign: 'right',
    },
    streakSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    streakText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '700',
    },
    last5Section: {
        marginBottom: SPACING.md,
    },
    last5Row: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    last5Dot: {
        width: 16,
        height: 16,
        borderRadius: 8,
    },
    trendSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    trendText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
    },
});
