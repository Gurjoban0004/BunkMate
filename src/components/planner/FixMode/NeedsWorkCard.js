import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../../theme/theme';
import PlannerProgressBar from '../shared/PlannerProgressBar';
import { calculateRecoveryClasses } from '../../../utils/planner/attendanceCalculations';

/**
 * Card for a subject below target — shows how many classes needed.
 * Props: subjectData, target (override), onPress
 */
export default function NeedsWorkCard({ subjectData, target, onPress }) {
    const { name, color, attended, total, percentage, unitsPerClass } = subjectData;
    const effectiveTarget = target || subjectData.target;
    const recovery = calculateRecoveryClasses(attended, total, effectiveTarget, unitsPerClass);
    const classesNeeded = recovery ? recovery.classesNeeded : '∞';

    return (
        <TouchableOpacity
            style={styles.card}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <View style={[styles.subjectAccent, { backgroundColor: color || COLORS.danger }]} />
                    <Text style={styles.name} numberOfLines={1}>{name}</Text>
                </View>
                <Text style={[styles.percentage, { color: COLORS.dangerText }]}>
                    {percentage.toFixed(1)}%
                </Text>
            </View>

            <PlannerProgressBar
                percentage={percentage}
                target={effectiveTarget}
                height={6}
            />

            <View style={styles.footer}>
                <Text style={styles.gap}>
                    {(effectiveTarget - percentage).toFixed(1)}% below target
                </Text>
                <Text style={styles.needed}>
                    {classesNeeded === '∞' ? 'Many classes needed' : `${classesNeeded} class${classesNeeded !== 1 ? 'es' : ''} to fix`}
                </Text>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        marginHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.cardGap,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
        ...SHADOWS.small,
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
        fontWeight: '700',
        fontSize: FONT_SIZES.md,
        color: COLORS.textPrimary,
        flex: 1,
    },
    percentage: {
        fontWeight: '700',
        fontSize: FONT_SIZES.lg,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: SPACING.sm + 2,
        gap: SPACING.sm,
    },
    gap: {
        fontWeight: '400',
        fontSize: FONT_SIZES.xs,
        color: COLORS.dangerText,
    },
    needed: {
        fontWeight: '600',
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
    },
});
