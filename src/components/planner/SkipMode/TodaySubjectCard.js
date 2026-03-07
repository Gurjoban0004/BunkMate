import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../../theme/theme';
import PercentageBadge from '../shared/PercentageBadge';
import PlannerProgressBar from '../shared/PlannerProgressBar';
import ImpactText from '../shared/ImpactText';
import StatusDot from '../shared/StatusDot';
import { calculateSkipImpact, calculateAttendImpact, determineStatus } from '../../../utils/planner/attendanceCalculations';
import { getNextClass, formatRelativeDate } from '../../../utils/planner/scheduleProcessor';

/**
 * Expanded subject card for today's classes.
 * Shows skip/attend impact, next class info, tap to detail.
 */
export default function TodaySubjectCard({ subjectData, onPress }) {
    const styles = getStyles();
    const { name, color, attended, total, percentage, target } = subjectData;

    const skipImpact = calculateSkipImpact(attended, total);
    const attendImpact = calculateAttendImpact(attended, total);
    const currentStatus = determineStatus(percentage, target);
    const skipStatus = determineStatus(skipImpact.newPercentage, target);
    const attendStatus = determineStatus(attendImpact.newPercentage, target);

    const nextClass = getNextClass(subjectData);

    return (
        <TouchableOpacity
            style={styles.card}
            onPress={onPress}
            activeOpacity={0.7}
        >
            {/* Header: Name + Percentage */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <StatusDot status={currentStatus} size={10} />
                    <Text style={styles.subjectName} numberOfLines={1}>{name}</Text>
                </View>
                <PercentageBadge percentage={percentage} status={currentStatus} size="md" />
            </View>

            {/* Progress bar */}
            <PlannerProgressBar percentage={percentage} target={target} height={6} />

            {/* Stats row */}
            <View style={styles.statsRow}>
                <Text style={styles.statsText}>{attended}/{total} classes</Text>
                {nextClass && (
                    <Text style={styles.nextClass}>
                        {nextClass.isToday ? `Today ${nextClass.time}` : `Next: ${formatRelativeDate(nextClass.date)}`}
                    </Text>
                )}
            </View>

            {/* Impact section */}
            <View style={styles.impactRow}>
                <ImpactText
                    label="Skip"
                    percentage={skipImpact.newPercentage}
                    status={skipStatus}
                    change={skipImpact.change}
                />
                <ImpactText
                    label="Attend"
                    percentage={attendImpact.newPercentage}
                    status={attendStatus}
                    change={attendImpact.change}
                />
            </View>

            {/* Tap hint */}
            <Text style={styles.tapHint}>Tap for details →</Text>
        </TouchableOpacity>
    );
}

const getStyles = () => StyleSheet.create({
    card: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: 20,
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.md,
        ...SHADOWS.medium,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.sm + 2,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    subjectName: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '600',
        color: COLORS.textPrimary,
        flex: 1,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: SPACING.sm + 2,
    },
    statsText: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
    },
    nextClass: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
    },
    impactRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: SPACING.md,
        paddingTop: SPACING.md,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    tapHint: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
        textAlign: 'right',
        marginTop: SPACING.sm + 2,
    },
});
