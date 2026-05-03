import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../../theme/theme';
import PlannerProgressBar from '../shared/PlannerProgressBar';
import { determineStatus } from '../../../utils/planner/attendanceCalculations';

/**
 * Large status header for subject detail.
 * Shows big percentage, counts, progress bar.
 */
export default function StatusHeader({ subjectData }) {
    const styles = getStyles();
    const { name, color, attended, total, percentage, target } = subjectData;
    const status = determineStatus(percentage, target);
    const statusColor = status === 'danger'
        ? COLORS.danger
        : status === 'warning'
            ? COLORS.warningDark
            : COLORS.success;

    return (
        <View style={styles.container}>
            <View style={styles.titleRow}>
                <View style={[styles.subjectDot, { backgroundColor: color || COLORS.primary }]} />
                <Text style={styles.name} numberOfLines={2}>{name}</Text>
            </View>

            <Text style={[styles.bigPercentage, { color: statusColor }]}>
                {percentage.toFixed(1)}%
            </Text>

            <PlannerProgressBar percentage={percentage} target={target} height={10} />

            <View style={styles.statsRow}>
                <Text style={styles.stat}>{attended} attended</Text>
                <Text style={styles.statSep}>·</Text>
                <Text style={styles.stat}>{total} total</Text>
                <Text style={styles.statSep}>·</Text>
                <Text style={styles.stat}>Target: {target}%</Text>
            </View>
        </View>
    );
}

const getStyles = () => StyleSheet.create({
    container: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
        ...SHADOWS.small,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: SPACING.sm,
        marginBottom: SPACING.md,
    },
    subjectDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginTop: 7,
    },
    name: {
        fontSize: FONT_SIZES.lg,
        lineHeight: 22,
        fontWeight: '700',
        color: COLORS.textPrimary,
        flex: 1,
    },
    bigPercentage: {
        fontSize: 56,
        lineHeight: 62,
        fontWeight: '800',
        marginBottom: SPACING.md,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: SPACING.sm,
        gap: 6,
        flexWrap: 'wrap',
    },
    stat: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
    statSep: {
        color: COLORS.textMuted,
    },
});
