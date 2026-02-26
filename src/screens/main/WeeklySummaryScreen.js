import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { generateWeeklySummary } from '../../utils/summary';
import { calculateOverallStreak } from '../../utils/streak';
import Card from '../../components/common/Card';
import ProgressBar from '../../components/common/ProgressBar';
import Button from '../../components/common/Button';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../../theme/theme';

const DAY_STATUS_EMOJI = {
    perfect: '🟢',
    partial: '🟡',
    poor: '🔴',
    no_class: '⚪',
};

export default function WeeklySummaryScreen({ navigation }) {
    const { state } = useApp();

    const summary = useMemo(() => generateWeeklySummary(state), [state]);
    const streak = useMemo(() => calculateOverallStreak(state), [state]);

    const pct = summary.overallPercentage;
    const isGood = pct >= 75;

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <Text style={styles.header}>📊 Week in Review</Text>
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
                        <Text style={styles.streakEmoji}>🔥</Text>
                        <View>
                            <Text style={styles.streakTitle}>Current Streak</Text>
                            <Text style={styles.streakCount}>{streak} classes in a row!</Text>
                        </View>
                    </Card>
                )}

                {/* Subject Breakdown */}
                {summary.sortedSubjects.length > 0 && (
                    <>
                        <Text style={styles.sectionTitle}>📚 Subject Breakdown</Text>
                        {summary.sortedSubjects.map((sub, idx) => (
                            <View key={sub.id} style={styles.subjectRow}>
                                <View style={styles.subjectHeader}>
                                    <View style={styles.nameRow}>
                                        <View style={[styles.colorDot, { backgroundColor: sub.color || COLORS.purple }]} />
                                        <Text style={styles.subjectName}>
                                            {idx === 0 ? '🏆 ' : idx === summary.sortedSubjects.length - 1 ? '⚠️ ' : ''}
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
                    <Text style={styles.tipTitle}>💡 Tip of the Week</Text>
                    <Text style={styles.tipText}>{summary.tip}</Text>
                </Card>

                {/* Day-by-Day */}
                <Text style={styles.sectionTitle}>📅 Day-by-Day</Text>
                <Card style={styles.dayCard}>
                    <View style={styles.dayRow}>
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                            <View key={day} style={styles.dayItem}>
                                <Text style={styles.dayEmoji}>
                                    {DAY_STATUS_EMOJI[summary.dailyStatus[day]] || '⚪'}
                                </Text>
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        padding: SPACING.screenPadding,
    },
    scrollContent: {
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
        fontSize: 48,
        fontWeight: 'bold',
        marginBottom: SPACING.sm,
    },
    progressBar: {
        width: '100%',
        marginBottom: SPACING.sm,
    },
    statsText: {
        ...TYPOGRAPHY.body,
        color: COLORS.textSecondary,
    },
    textGreen: { color: COLORS.success },
    textRed: { color: COLORS.danger },
    streakCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
        marginBottom: SPACING.md,
        backgroundColor: COLORS.yellowBg,
        borderWidth: 1,
        borderColor: COLORS.yellow,
    },
    streakEmoji: {
        fontSize: 32,
    },
    streakTitle: {
        ...TYPOGRAPHY.body,
        fontWeight: '600',
        color: COLORS.yellowDark,
    },
    streakCount: {
        ...TYPOGRAPHY.caption,
        color: COLORS.yellow,
    },
    sectionTitle: {
        ...TYPOGRAPHY.headerSmall,
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
        ...SHADOWS.small,
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
        ...TYPOGRAPHY.body,
        color: COLORS.textPrimary,
        fontWeight: '600',
    },
    subjectPct: {
        ...TYPOGRAPHY.body,
        fontWeight: '700',
    },
    subjectProgress: {
        marginTop: SPACING.xs,
    },
    tipCard: {
        marginTop: SPACING.md,
        marginBottom: SPACING.md,
        backgroundColor: COLORS.primaryBg,
        borderWidth: 1,
        borderColor: COLORS.primary,
    },
    tipTitle: {
        ...TYPOGRAPHY.body,
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
    dayEmoji: {
        fontSize: 20,
    },
    dayLabel: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textDisabled,
    },
    actions: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
});
