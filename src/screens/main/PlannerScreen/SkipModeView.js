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
export default function SkipModeView({ subjects, onSubjectPress, activeDate = new Date() }) {
    const styles = getStyles();
    const todayClasses = useMemo(() => getTodaysClasses(subjects, activeDate), [subjects, activeDate]);

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
        if (dangerCount > 0) {
            message = `${dangerCount} subject${dangerCount > 1 ? 's' : ''} need${dangerCount === 1 ? 's' : ''} attention`;
        } else if (totalSkippable > 5) {
            message = 'You\'re in great shape!';
        } else if (totalSkippable > 0) {
            message = 'Manage your skips wisely';
        } else {
            message = 'Better attend everything for now';
        }

        return { totalSkippable, safeCount, warningCount, dangerCount, message };
    }, [subjects]);

    return (
        <View style={styles.container}>
            <View style={[
                styles.quickAnswerCard,
                skipSummary.dangerCount > 0 ? styles.quickAnswerDanger :
                skipSummary.warningCount > 0 ? styles.quickAnswerWarning :
                styles.quickAnswerSafe,
            ]}>
                <View style={styles.quickAnswerContent}>
                    <Text style={styles.quickAnswerLabel}>Today’s answer</Text>
                    <Text style={styles.quickAnswerTitle}>
                        {skipSummary.dangerCount > 0
                            ? `${skipSummary.dangerCount} subject${skipSummary.dangerCount > 1 ? 's' : ''} need attention`
                            : skipSummary.totalSkippable > 0
                            ? `${skipSummary.totalSkippable} skippable classes`
                            : 'Better attend everything'}
                    </Text>
                    <Text style={styles.quickAnswerSubtitle}>{skipSummary.message}</Text>
                </View>
                <View style={styles.quickAnswerStats}>
                    <View style={styles.statDot}>
                        <View style={[styles.dot, { backgroundColor: COLORS.success }]} />
                        <Text style={styles.statNum}>{skipSummary.safeCount}</Text>
                    </View>
                    <View style={styles.statDot}>
                        <View style={[styles.dot, { backgroundColor: COLORS.warning }]} />
                        <Text style={styles.statNum}>{skipSummary.warningCount}</Text>
                    </View>
                    <View style={styles.statDot}>
                        <View style={[styles.dot, { backgroundColor: COLORS.danger }]} />
                        <Text style={styles.statNum}>{skipSummary.dangerCount}</Text>
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

const getStyles = () => StyleSheet.create({
    container: {
        flex: 1,
    },
    quickAnswerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
        borderLeftWidth: 4,
        ...SHADOWS.small,
    },
    quickAnswerSafe: {
        borderLeftColor: COLORS.success,
    },
    quickAnswerWarning: {
        borderLeftColor: COLORS.warning,
    },
    quickAnswerDanger: {
        borderLeftColor: COLORS.danger,
    },
    quickAnswerContent: {
        flex: 1,
    },
    quickAnswerLabel: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '700',
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        marginBottom: 2,
    },
    quickAnswerTitle: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '800',
        color: COLORS.textPrimary,
        marginBottom: 2,
    },
    quickAnswerSubtitle: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
    },
    quickAnswerStats: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    statDot: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statNum: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
});
