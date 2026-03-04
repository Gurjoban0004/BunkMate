import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../../theme/theme';
import { generateRecoveryPaths, generateRewards } from '../../../utils/planner/recoveryPlanner';

/**
 * Recovery paths / missions to reach target percentages.
 */
export default function RecoveryPaths({ subjectData }) {
    const recovery = useMemo(
        () => generateRecoveryPaths(subjectData),
        [subjectData]
    );

    if (!recovery || recovery.paths.length === 0) {
        // Already above all targets
        return (
            <View style={styles.container}>
                <Text style={styles.title}>Recovery</Text>
                <View style={styles.safeCard}>
                    <Text style={styles.safeEmoji}>🎉</Text>
                    <Text style={styles.safeText}>You're above your target!</Text>
                    <Text style={styles.safeSubtext}>Keep it up — no recovery needed</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Recovery Paths</Text>
            <Text style={styles.subtitle}>
                Currently at {recovery.currentPercentage.toFixed(1)}% — need {recovery.gap.toFixed(1)}% more
            </Text>

            {recovery.paths.map((path, idx) => (
                <View key={idx} style={styles.pathCard}>
                    <View style={styles.pathHeader}>
                        <Text style={styles.pathTarget}>→ {path.targetPercentage}%</Text>
                        <Text style={styles.pathClasses}>
                            {path.classesNeeded} class{path.classesNeeded !== 1 ? 'es' : ''}
                        </Text>
                    </View>

                    {path.timeline && (
                        <Text style={styles.pathTimeline}>
                            ~{path.timeline.days} days to reach
                        </Text>
                    )}

                    {/* Show first 3 specific classes */}
                    {path.specificClasses.length > 0 && (
                        <View style={styles.classesPreview}>
                            {path.specificClasses.slice(0, 3).map((cls, ci) => (
                                <View key={ci} style={styles.classChip}>
                                    <Text style={styles.classChipText}>
                                        {cls.day} {cls.dateFormatted}
                                    </Text>
                                </View>
                            ))}
                            {path.specificClasses.length > 3 && (
                                <Text style={styles.moreText}>
                                    +{path.specificClasses.length - 3} more
                                </Text>
                            )}
                        </View>
                    )}

                    {/* Skip allowance after recovery */}
                    <Text style={styles.skipAllowance}>
                        After: can skip {path.skipAllowance.simplified} classes
                    </Text>

                    <Text style={styles.reward}>{generateRewards(path.targetPercentage)}</Text>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        ...SHADOWS.small,
    },
    title: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    subtitle: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
        marginBottom: SPACING.md,
    },
    safeCard: {
        alignItems: 'center',
        paddingVertical: SPACING.lg,
    },
    safeEmoji: {
        fontSize: 36,
        marginBottom: SPACING.sm,
    },
    safeText: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.successDark,
    },
    safeSubtext: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
        marginTop: SPACING.xs,
    },
    pathCard: {
        backgroundColor: COLORS.background,
        borderRadius: BORDER_RADIUS.sm,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
    },
    pathHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.xs,
    },
    pathTarget: {
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
        color: COLORS.primary,
    },
    pathClasses: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        fontWeight: '600',
    },
    pathTimeline: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
        marginBottom: SPACING.sm,
    },
    classesPreview: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.xs,
        marginBottom: SPACING.sm,
    },
    classChip: {
        backgroundColor: COLORS.primaryLight,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: BORDER_RADIUS.full,
    },
    classChipText: {
        fontSize: 10,
        color: COLORS.primaryDark,
        fontWeight: '500',
    },
    moreText: {
        fontSize: 10,
        color: COLORS.textMuted,
        alignSelf: 'center',
    },
    skipAllowance: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
        marginBottom: SPACING.xs,
    },
    reward: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.successDark,
        fontWeight: '500',
        fontStyle: 'italic',
    },
});
