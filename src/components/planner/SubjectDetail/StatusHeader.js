import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../../theme/theme';
import PlannerProgressBar from '../shared/PlannerProgressBar';
import PercentageBadge from '../shared/PercentageBadge';
import { determineStatus } from '../../../utils/planner/attendanceCalculations';

/**
 * Large status header for subject detail.
 * Shows big percentage, counts, progress bar.
 */
export default function StatusHeader({ subjectData }) {
    const styles = getStyles();
    const { name, color, attended, total, percentage, target } = subjectData;
    const status = determineStatus(percentage, target);

    return (
        <View style={[styles.container, { borderTopColor: color || COLORS.primary }]}>
            <Text style={styles.name}>{name}</Text>

            <Text style={[styles.bigPercentage, {
                color: status === 'danger' ? COLORS.danger :
                    status === 'warning' ? COLORS.warningDark : COLORS.success
            }]}>
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
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.lg,
        marginBottom: SPACING.md,
        borderTopWidth: 4,
        alignItems: 'center',
    },
    name: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: SPACING.sm,
    },
    bigPercentage: {
        fontSize: 48,
        fontWeight: 'bold',
        marginBottom: SPACING.md,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: SPACING.sm,
        gap: 6,
    },
    stat: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
    },
    statSep: {
        color: COLORS.textMuted,
    },
});
