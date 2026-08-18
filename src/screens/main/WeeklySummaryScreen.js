import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { generateWeeklySummary } from '../../utils/summary';
import { calculateOverallStreak } from '../../utils/streak';
import { getSubjectAttendance } from '../../utils/attendance';
import Card from '../../components/common/Card';
import ProgressBar from '../../components/common/ProgressBar';
import Button from '../../components/common/Button';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../../theme/theme';
import ScreenHeader from '../../components/common/ScreenHeader';

const DAY_STATUS_COLOR = {
    perfect: COLORS.success,
    partial: COLORS.warning,
    poor: COLORS.danger,
    no_class: COLORS.border,
};

export default function WeeklySummaryScreen({ navigation }) {
    const styles = getStyles();
    const { state } = useApp();

    const summary = useMemo(() => generateWeeklySummary(state), [state]);
    const streak = useMemo(() => calculateOverallStreak(state), [state]);

    const pct = summary.overallPercentage;
    const isGood = pct >= 75;

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScreenHeader title="Week in Review" />
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Text style={styles.weekRange}>{summary.weekRange}</Text>

                {/* Overall */}
                <Card style={styles.overallCard}>
                    <Text style={[styles.bigPercentage, isGood ? styles.textGreen : styles.textRed]}>
                        {pct}%
                    </Text>
                    <ProgressBar percentage={pct} style={styles.progressBar} />
                    <Text style={styles.statsText}>
                        {summary.attendedClasses} / {summary.totalClasses} classes
                    </Text>
                </Card>

                {/* Streak */}
                {streak >= 3 && (
                    <Card style={styles.streakCard}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.warning, marginRight: SPACING.sm }} />
                        <View>
                            <Text style={styles.streakTitle}>Current Streak</Text>
                            <Text style={styles.streakCount}>{streak} classes in a row!</Text>
                        </View>
                    </Card>
                )}

                {/* Subject Breakdown */}
                {summary.sortedSubjects.length > 0 && (
                    <>
                        <Text style={styles.sectionTitle}>Subject Breakdown</Text>
                        {summary.sortedSubjects.map((sub, idx) => (
                            <View key={sub.id} style={styles.subjectRow}>
                                <View style={styles.subjectHeader}>
                                    <View style={styles.nameRow}>
                                        <View style={[styles.colorDot, { backgroundColor: sub.color || COLORS.primary }]} />
                                        <Text style={styles.subjectName}>
                                            {sub.name}
                                        </Text>
                                    </View>
                                    <Text style={[styles.subjectPct, sub.percentage >= 75 ? styles.textGreen : styles.textRed]}>
                                        {sub.percentage}%
                                    </Text>
                                </View>
                                <ProgressBar percentage={sub.percentage} style={styles.subjectProgress} />
                            </View>
                        ))}
                    </>
                )}

                {/* Tip */}
                <Card style={styles.tipCard}>
                    <Text style={styles.tipTitle}>Tip of the Week</Text>
                    <Text style={styles.tipText}>{summary.tip}</Text>
                </Card>

                {/* Day-by-Day */}
                <Text style={styles.sectionTitle}>Day-by-Day</Text>
                <Card style={styles.dayCard}>
                    <View style={styles.dayRow}>
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                            <View key={day} style={styles.dayItem}>
                                <View style={[styles.dayDot, { backgroundColor: DAY_STATUS_COLOR[summary.dailyStatus[day]] || COLORS.border }]} />
                                <Text style={styles.dayLabel}>{day[0]}</Text>
                            </View>
                        ))}
                    </View>
                </Card>

                {/* Action buttons */}
                <View style={styles.actions}>
                    <Button
                        title="View All Subjects"
                        onPress={() => navigation.navigate('Subjects')}
                        style={{ flex: 1 }}
                    />
                    <Button
                        title="Dismiss"
                        variant="secondary"
                        onPress={() => navigation.goBack()}
                        style={{ flex: 1 }}
                    />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const getStyles = () => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        paddingHorizontal: SPACING.screenPadding,
        paddingTop: SPACING.md,
        paddingBottom: SPACING.xxl,
    },
    header: {
        ...TYPOGRAPHY.headerLarge,
        color: COLORS.textPrimary,
    },
    weekRange: {
        ...TYPOGRAPHY.bodySmall,
        color: COLORS.textSecondary,
        marginBottom: SPACING.lg,
    },
    overallCard: {
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    bigPercentage: {
        fontWeight: '700',
        fontSize: 26,
        letterSpacing: -0.5,
        marginBottom: SPACING.sm,
    },
    progressBar: {
        width: '100%',
        marginBottom: SPACING.sm,
    },
    statsText: {
        ...TYPOGRAPHY.bodyMedium,
        color: COLORS.textSecondary,
    },
    textGreen: { color: COLORS.successText },
    textRed: { color: COLORS.dangerText },
    streakCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
        marginBottom: SPACING.md,
        backgroundColor: COLORS.warningLight,


    },
    streakEmoji: {
        fontSize: 32,
    },
    streakTitle: {
        ...TYPOGRAPHY.bodyMedium,
        fontWeight: '600',
        color: COLORS.warningDark,
    },
    streakCount: {
        ...TYPOGRAPHY.captionMedium,
        color: COLORS.warningText,
    },
    sectionTitle: {
        ...TYPOGRAPHY.headingSmall,
        color: COLORS.textPrimary,
        marginTop: SPACING.md,
        marginBottom: SPACING.sm,
    },
    subjectRow: {
        backgroundColor: COLORS.cardBackground,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.sm,
        marginBottom: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    subjectHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.xs,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
    },
    colorDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    subjectName: {
        ...TYPOGRAPHY.bodyMedium,
        color: COLORS.textPrimary,
        fontWeight: '600',
    },
    subjectPct: {
        ...TYPOGRAPHY.bodyMedium,
        fontWeight: '700',
    },
    subjectProgress: {
        marginTop: SPACING.xs,
    },
    tipCard: {
        marginTop: SPACING.md,
        marginBottom: SPACING.md,
        backgroundColor: COLORS.primaryBg,


    },
    tipTitle: {
        ...TYPOGRAPHY.bodyMedium,
        fontWeight: '600',
        color: COLORS.primary,
        marginBottom: SPACING.xs,
    },
    tipText: {
        ...TYPOGRAPHY.bodySmall,
        color: COLORS.textPrimary,
    },
    dayCard: {
        marginBottom: SPACING.lg,
    },
    dayRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    dayItem: {
        alignItems: 'center',
        gap: SPACING.xs,
    },
    dayDot: {
        width: 14,
        height: 14,
        borderRadius: 7,
    },
    dayLabel: {
        ...TYPOGRAPHY.captionMedium,
        color: COLORS.textMuted,
    },
    actions: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
});
