import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../../theme/theme';
import PlannerProgressBar from '../shared/PlannerProgressBar';
import { calculateSkipAllowance } from '../../../utils/planner/attendanceCalculations';

/**
 * Card for a subject at or above target — shows skip allowance.
 * Props: subjectData, target (override), onPress
 */
export default function OnTrackCard({ subjectData, target, onPress }) {
    const { name, color, attended, total, percentage } = subjectData;
    const effectiveTarget = target || subjectData.target;
    const skipAllowance = calculateSkipAllowance(effectiveTarget, attended, total);

    return (
        <TouchableOpacity
            style={styles.card}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={styles.row}>
                <View style={styles.left}>
                    <View style={[styles.subjectAccent, { backgroundColor: color || COLORS.success }]} />
                    <Text style={styles.name} numberOfLines={1}>{name}</Text>
                </View>
                <View style={styles.right}>
                    <Text style={[styles.percentage, { color: COLORS.successDark }]}>
                        {percentage.toFixed(1)}%
                    </Text>
                    <Text style={styles.skipInfo}>
                        Can skip {skipAllowance.skips}
                    </Text>
                </View>
            </View>

            <View style={styles.progressContainer}>
                <PlannerProgressBar
                    percentage={percentage}
                    height={3}
                    color={COLORS.success}
                />
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        paddingVertical: 14,
        paddingHorizontal: SPACING.md,
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
        ...SHADOWS.small,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        flex: 1,
    },
    subjectAccent: {
        width: 8,
        height: 8,
        borderRadius: 4,
        flexShrink: 0,
    },
    name: {
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
        color: COLORS.textPrimary,
        flex: 1,
    },
    right: {
        alignItems: 'flex-end',
    },
    percentage: {
        fontSize: FONT_SIZES.md,
        fontWeight: '800',
    },
    skipInfo: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
        marginTop: 2,
    },
    progressContainer: {
        marginTop: SPACING.sm + 2,
    },
});
