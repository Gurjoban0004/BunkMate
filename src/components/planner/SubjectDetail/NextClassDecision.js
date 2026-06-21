import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../../theme/theme';
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
                <Text style={[styles.pct, { color: skipStatus === 'danger' ? COLORS.danger : COLORS.warningDark }]}>{skipImpact.newPercentage.toFixed(1)}%</Text>
                <Text style={[styles.delta, { color: COLORS.danger }]}>{skipImpact.change}%</Text>
            </View>
            <Text style={styles.vs}>vs</Text>
            <View style={[styles.half, { borderLeftColor: COLORS.success }]}>
                <Text style={styles.label}>Attend</Text>
                <Text style={[styles.pct, { color: COLORS.successDark }]}>{attendImpact.newPercentage.toFixed(1)}%</Text>
                <Text style={[styles.delta, { color: COLORS.success }]}>+{attendImpact.change}%</Text>
            </View>
        </View>
    );
}

const getStyles = () => StyleSheet.create({
    container: {
        flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm, gap: SPACING.xs,
    },
    half: {
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
        backgroundColor: COLORS.cardBackground, padding: SPACING.sm, borderRadius: BORDER_RADIUS.md,
        borderWidth: 1, borderColor: COLORS.borderSubtle, borderLeftWidth: 3, ...SHADOWS.small,
    },
    label: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', width: 36 },
    pct: { fontSize: FONT_SIZES.md, fontWeight: '800' },
    delta: { fontSize: FONT_SIZES.xs, fontWeight: '700' },
    vs: { fontSize: FONT_SIZES.xs, fontWeight: '600', color: COLORS.textMuted },
});
