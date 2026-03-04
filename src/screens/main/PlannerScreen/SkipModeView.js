import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../../theme/theme';
import SectionHeader from '../../../components/planner/shared/SectionHeader';
import TodaySubjectCard from '../../../components/planner/SkipMode/TodaySubjectCard';
import OtherSubjectCard from '../../../components/planner/SkipMode/OtherSubjectCard';
import { getTodaysClasses } from '../../../utils/planner/scheduleProcessor';
import { determineStatus, calculateSkipAllowance } from '../../../utils/planner/attendanceCalculations';

/**
 * Skip? mode view — now with a summary card showing total skippable classes.
 */
export default function SkipModeView({ subjects, onSubjectPress }) {
    const todayClasses = useMemo(() => getTodaysClasses(subjects), [subjects]);

    const { todaySubjects, otherSubjects } = useMemo(() => {
        const todayIds = new Set(todayClasses.map(c => c.subject.id));
        const today = todayClasses
            .map(c => c.subject)
            .sort((a, b) => {
                const statusA = determineStatus(a.percentage, a.target);
                const statusB = determineStatus(b.percentage, b.target);
                const priority = { danger: 0, warning: 1, safe: 2 };
                return (priority[statusA] || 2) - (priority[statusB] || 2);
            });

        const others = subjects
            .filter(s => !todayIds.has(s.id))
            .sort((a, b) => a.percentage - b.percentage);

        return { todaySubjects: today, otherSubjects: others };
    }, [subjects, todayClasses]);

    // Calculate skip summary across all subjects
    const skipSummary = useMemo(() => {
        let totalSkippable = 0;
        let safeCount = 0;
        let warningCount = 0;
        let dangerCount = 0;

        subjects.forEach(s => {
            const status = determineStatus(s.percentage, s.target);
            if (status === 'safe') {
                safeCount++;
                const allowance = calculateSkipAllowance(s.target, s.attended, s.total);
                totalSkippable += allowance.skips;
            } else if (status === 'warning') {
                warningCount++;
            } else {
                dangerCount++;
            }
        });

        // Determine message
        let message = '';
        let emoji = '';
        if (dangerCount > 0) {
            emoji = '⚠️';
            message = `${dangerCount} subject${dangerCount > 1 ? 's' : ''} need${dangerCount === 1 ? 's' : ''} attention`;
        } else if (totalSkippable > 5) {
            emoji = '😎';
            message = 'You\'re in great shape!';
        } else if (totalSkippable > 0) {
            emoji = '📊';
            message = 'Manage your skips wisely';
        } else {
            emoji = '📚';
            message = 'Better attend everything for now';
        }

        return { totalSkippable, safeCount, warningCount, dangerCount, message, emoji };
    }, [subjects]);

    return (
        <View style={styles.container}>
            {/* Skip Summary Card */}
            <View style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                    <Text style={styles.summaryEmoji}>{skipSummary.emoji}</Text>
                    <View style={styles.summaryInfo}>
                        <Text style={styles.summaryTitle}>
                            {skipSummary.totalSkippable} skippable classes
                        </Text>
                        <Text style={styles.summaryMessage}>{skipSummary.message}</Text>
                    </View>
                </View>
                <View style={styles.summaryBreakdown}>
                    <View style={styles.breakdownItem}>
                        <View style={[styles.breakdownDot, { backgroundColor: COLORS.success }]} />
                        <Text style={styles.breakdownText}>{skipSummary.safeCount} safe</Text>
                    </View>
                    <View style={styles.breakdownItem}>
                        <View style={[styles.breakdownDot, { backgroundColor: COLORS.warning }]} />
                        <Text style={styles.breakdownText}>{skipSummary.warningCount} warning</Text>
                    </View>
                    <View style={styles.breakdownItem}>
                        <View style={[styles.breakdownDot, { backgroundColor: COLORS.danger }]} />
                        <Text style={styles.breakdownText}>{skipSummary.dangerCount} danger</Text>
                    </View>
                </View>
            </View>

            {/* TODAY Section */}
            {todaySubjects.length > 0 && (
                <>
                    <SectionHeader title="TODAY" count={todaySubjects.length} />
                    {todaySubjects.map(subject => (
                        <TodaySubjectCard
                            key={subject.id}
                            subjectData={subject}
                            onPress={() => onSubjectPress(subject)}
                        />
                    ))}
                </>
            )}

            {/* OTHER SUBJECTS Section */}
            {otherSubjects.length > 0 && (
                <>
                    <SectionHeader title="OTHER SUBJECTS" count={otherSubjects.length} />
                    {otherSubjects.map(subject => (
                        <OtherSubjectCard
                            key={subject.id}
                            subjectData={subject}
                            onPress={() => onSubjectPress(subject)}
                        />
                    ))}
                </>
            )}

            <View style={{ height: SPACING.lg }} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    summaryCard: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.lg,
        ...SHADOWS.small,
    },
    summaryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        marginBottom: SPACING.sm,
    },
    summaryEmoji: {
        fontSize: 28,
    },
    summaryInfo: {
        flex: 1,
    },
    summaryTitle: {
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    summaryMessage: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    summaryBreakdown: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingTop: SPACING.sm,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    breakdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    breakdownDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    breakdownText: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
    },
});
