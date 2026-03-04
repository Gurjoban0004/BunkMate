import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../../theme/theme';
import ImpactText from '../shared/ImpactText';
import { calculateSkipImpact, calculateAttendImpact, determineStatus } from '../../../utils/planner/attendanceCalculations';
import { getNextClass, formatRelativeDate } from '../../../utils/planner/scheduleProcessor';

/**
 * Skip vs Attend decision buttons with impact preview.
 */
export default function NextClassDecision({ subjectData }) {
    const { attended, total, target } = subjectData;

    const skipImpact = calculateSkipImpact(attended, total);
    const attendImpact = calculateAttendImpact(attended, total);
    const skipStatus = determineStatus(skipImpact.newPercentage, target);
    const attendStatus = determineStatus(attendImpact.newPercentage, target);
    const nextClass = getNextClass(subjectData);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Next Class</Text>
            {nextClass && (
                <Text style={styles.nextLabel}>
                    {nextClass.isToday ? `Today at ${nextClass.time}` :
                        nextClass.isTomorrow ? `Tomorrow at ${nextClass.time}` :
                            `${formatRelativeDate(nextClass.date)} at ${nextClass.time}`
                    }
                </Text>
            )}

            <View style={styles.optionsRow}>
                {/* Skip option */}
                <View style={[styles.option, styles.skipOption]}>
                    <Text style={styles.optionLabel}>If you skip</Text>
                    <Text style={[styles.optionPercentage, {
                        color: skipStatus === 'danger' ? COLORS.danger : COLORS.warningDark
                    }]}>
                        {skipImpact.newPercentage.toFixed(1)}%
                    </Text>
                    <Text style={[styles.optionChange, {
                        color: COLORS.danger
                    }]}>
                        {skipImpact.change}%
                    </Text>
                </View>

                {/* VS divider */}
                <View style={styles.vsDivider}>
                    <Text style={styles.vsText}>vs</Text>
                </View>

                {/* Attend option */}
                <View style={[styles.option, styles.attendOption]}>
                    <Text style={styles.optionLabel}>If you attend</Text>
                    <Text style={[styles.optionPercentage, {
                        color: attendStatus === 'safe' ? COLORS.successDark : COLORS.warningDark
                    }]}>
                        {attendImpact.newPercentage.toFixed(1)}%
                    </Text>
                    <Text style={[styles.optionChange, {
                        color: COLORS.success
                    }]}>
                        +{attendImpact.change}%
                    </Text>
                </View>
            </View>
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
        marginBottom: SPACING.xs,
    },
    nextLabel: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        marginBottom: SPACING.md,
    },
    optionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    option: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.sm,
    },
    skipOption: {
        backgroundColor: COLORS.dangerLight,
    },
    attendOption: {
        backgroundColor: COLORS.successLight,
    },
    optionLabel: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
        marginBottom: SPACING.xs,
    },
    optionPercentage: {
        fontSize: FONT_SIZES.xl,
        fontWeight: '700',
    },
    optionChange: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '600',
        marginTop: 2,
    },
    vsDivider: {
        width: 36,
        alignItems: 'center',
    },
    vsText: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
        fontWeight: '600',
    },
});
