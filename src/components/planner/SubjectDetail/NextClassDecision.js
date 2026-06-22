import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS, TYPOGRAPHY } from '../../../theme/theme';
import { calculateSkipImpact, calculateAttendImpact, determineStatus } from '../../../utils/planner/attendanceCalculations';

export default function NextClassDecision({ subjectData }) {
    const styles = getStyles();
    const { attended, total, target } = subjectData;

    const skipImpact = calculateSkipImpact(attended, total);
    const attendImpact = calculateAttendImpact(attended, total);
    const skipStatus = determineStatus(skipImpact.newPercentage, target);

    return (
        <View style={styles.container}>
            <View style={[styles.half, { borderLeftColor: COLORS.danger }]}>
                <Text style={styles.label}>Skip</Text>
                <View style={styles.rightSide}>
                    <Text style={[styles.pct, { color: skipStatus === 'danger' ? COLORS.danger : COLORS.warningDark }]}>{skipImpact.newPercentage.toFixed(1)}%</Text>
                    <Text style={[styles.delta, { color: COLORS.danger }]}>{skipImpact.change}%</Text>
                </View>
            </View>
            <Text style={styles.vs}>vs</Text>
            <View style={[styles.half, { borderLeftColor: COLORS.success }]}>
                <Text style={styles.label}>Attend</Text>
                <View style={styles.rightSide}>
                    <Text style={[styles.pct, { color: COLORS.successDark }]}>{attendImpact.newPercentage.toFixed(1)}%</Text>
                    <Text style={[styles.delta, { color: COLORS.success }]}>+{attendImpact.change}%</Text>
                </View>
            </View>
        </View>
    );
}

const getStyles = () => StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.md,
        gap: SPACING.sm,
    },
    half: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.cardBackground,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderLeftWidth: 4,
        ...SHADOWS.small,
    },
    label: {
        ...TYPOGRAPHY.micro,
        color: COLORS.textMuted,
    },
    rightSide: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    pct: {
        ...TYPOGRAPHY.headingMedium,
    },
    delta: {
        ...TYPOGRAPHY.captionSmall,
        fontWeight: '700',
    },
    vs: {
        ...TYPOGRAPHY.micro,
        color: COLORS.textMuted,
        marginHorizontal: 2,
    },
});
