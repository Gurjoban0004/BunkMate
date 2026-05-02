import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../../theme/theme';
import PercentageBadge from '../shared/PercentageBadge';
import PlannerProgressBar from '../shared/PlannerProgressBar';
import { calculateSkipImpact, determineStatus } from '../../../utils/planner/attendanceCalculations';
import { getNextClass, formatRelativeDate } from '../../../utils/planner/scheduleProcessor';

/**
 * Expanded subject card for today's classes.
 * Prototype impact-card style: colored left border, badge, arrow stats.
 */
export default function TodaySubjectCard({ subjectData, onPress }) {
    const styles = getStyles();
    const { name, color, attended, total, percentage, target } = subjectData;

    const skipImpact = calculateSkipImpact(attended, total);
    const currentStatus = determineStatus(percentage, target);
    const skipStatus = determineStatus(skipImpact.newPercentage, target);

    const nextClass = getNextClass(subjectData);

    const borderColor = currentStatus === 'danger' ? COLORS.danger
        : currentStatus === 'warning' ? COLORS.warning
        : COLORS.success;

    const skipNewColor = skipStatus === 'danger' ? COLORS.danger
        : skipStatus === 'warning' ? COLORS.warningDark
        : COLORS.successDark;

    return (
        <TouchableOpacity
            style={[styles.card, { borderLeftColor: borderColor }]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <View style={[styles.colorDot, { backgroundColor: color || borderColor }]} />
                    <Text style={styles.subjectName} numberOfLines={1}>{name}</Text>
                </View>
                <PercentageBadge percentage={percentage} status={currentStatus} size="sm" />
            </View>

            {/* Progress bar */}
            <PlannerProgressBar percentage={percentage} target={target} height={5} />

            <View style={styles.impactRow}>
                <View style={styles.impactStat}>
                    <Text style={styles.impactValue}>{percentage.toFixed(0)}%</Text>
                    <Text style={styles.impactArrow}>to</Text>
                    <Text style={[styles.impactValueNew, { color: skipNewColor }]}>
                        {skipImpact.newPercentage.toFixed(0)}%
                    </Text>
                    <Text style={styles.impactDetail}>if skipped</Text>
                </View>
                {nextClass && (
                    <Text style={styles.nextClass}>
                        {nextClass.isToday ? `Today ${nextClass.time}` : `Next: ${formatRelativeDate(nextClass.date)}`}
                    </Text>
                )}
            </View>

            {currentStatus === 'danger' && (
                <View style={styles.warningRow}>
                    <Text style={styles.warningText}>Attend this class. Attendance is below target.</Text>
                </View>
            )}
        </TouchableOpacity>
    );
}

const getStyles = () => StyleSheet.create({
    card: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.sm,
        borderLeftWidth: 4,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
        ...SHADOWS.small,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    colorDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        flexShrink: 0,
    },
    subjectName: {
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
        color: COLORS.textPrimary,
        flex: 1,
    },
    impactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: SPACING.sm,
    },
    impactStat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    impactValue: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '800',
        color: COLORS.textPrimary,
    },
    impactArrow: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textMuted,
        fontWeight: '600',
    },
    impactValueNew: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '800',
    },
    impactDetail: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
        marginLeft: 2,
    },
    nextClass: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
    },
    warningRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: SPACING.sm,
        padding: SPACING.sm,
        backgroundColor: COLORS.dangerLight,
        borderRadius: BORDER_RADIUS.sm,
        borderWidth: 1,
        borderColor: COLORS.danger,
    },
    warningText: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '600',
        color: COLORS.dangerDark,
        flex: 1,
    },
});
