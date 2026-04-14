import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../../theme/theme';
import PercentageBadge from '../shared/PercentageBadge';
import PlannerProgressBar from '../shared/PlannerProgressBar';
import StatusDot from '../shared/StatusDot';
import { calculateSkipImpact, calculateAttendImpact, determineStatus } from '../../../utils/planner/attendanceCalculations';
import { getNextClass, formatRelativeDate } from '../../../utils/planner/scheduleProcessor';

/**
 * Expanded subject card for today's classes.
 * Prototype impact-card style: colored left border, badge, arrow stats.
 */
export default function TodaySubjectCard({ subjectData, onPress }) {
    const styles = getStyles();
    const { name, color, attended, total, percentage, target } = subjectData;

    const skipImpact = calculateSkipImpact(attended, total);
    const attendImpact = calculateAttendImpact(attended, total);
    const currentStatus = determineStatus(percentage, target);
    const skipStatus = determineStatus(skipImpact.newPercentage, target);

    const nextClass = getNextClass(subjectData);

    const borderColor = currentStatus === 'danger' ? COLORS.danger
        : currentStatus === 'warning' ? COLORS.warning
        : COLORS.success;

    const badgeLabel = currentStatus === 'danger' ? 'Risk'
        : currentStatus === 'warning' ? 'Edge'
        : 'Safe';

    const skipNewColor = skipStatus === 'danger' ? COLORS.danger
        : skipStatus === 'warning' ? COLORS.warningDark
        : COLORS.successDark;

    return (
        <TouchableOpacity
            style={[styles.card, { borderLeftColor: borderColor }]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            {/* Header: color dot + name + badge */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <View style={[styles.colorDot, { backgroundColor: color || borderColor }]} />
                    <Text style={styles.subjectName} numberOfLines={1}>{name}</Text>
                </View>
                <PercentageBadge percentage={percentage} status={currentStatus} size="sm" />
            </View>

            {/* Progress bar */}
            <PlannerProgressBar percentage={percentage} target={target} height={5} />

            {/* Impact stats: current → skip */}
            <View style={styles.impactRow}>
                <View style={styles.impactStat}>
                    <Text style={styles.impactValue}>{percentage.toFixed(0)}%</Text>
                    <Text style={styles.impactArrow}>→</Text>
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

            {/* Danger warning */}
            {currentStatus === 'danger' && (
                <View style={styles.warningRow}>
                    <Text style={styles.warningText}>⚠ Attend this class! Attendance is critical.</Text>
                </View>
            )}

            <Text style={styles.tapHint}>Tap for details →</Text>
        </TouchableOpacity>
    );
}

const getStyles = () => StyleSheet.create({
    card: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.sm,
        borderLeftWidth: 3,
        borderWidth: 1,
        borderColor: COLORS.border,
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
        width: 14,
        height: 14,
        borderRadius: 7,
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
    },
    warningText: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '600',
        color: COLORS.dangerDark,
        flex: 1,
    },
    tapHint: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
        textAlign: 'right',
        marginTop: SPACING.sm,
    },
});
