import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../../theme/theme';
import PlannerProgressBar from '../shared/PlannerProgressBar';
import { determineStatus } from '../../../utils/planner/attendanceCalculations';

/**
 * Recorded attendance only. Hypothetical choices live in Insights.
 */
export default function SubjectSummaryCard({ subjectData }) {
    const styles = getStyles();
    const { attended, total, percentage, target } = subjectData;

    const status = determineStatus(percentage, target);
    const statusColor = status === 'danger' ? COLORS.dangerText
        : status === 'warning' ? COLORS.warningText
            : COLORS.successText;


    return (
        <View style={styles.container}>
            <View style={styles.heroRow}>
                <View>
                    <Text style={[styles.percentage, { color: statusColor }]}>
                        {percentage.toFixed(1)}%
                    </Text>
                    <Text style={styles.heroLabel}>Attendance</Text>
                </View>
                <View style={styles.heroRight}>
                    <Text style={styles.marks}>{attended} / {total}</Text>
                    <Text style={styles.heroLabel}>hours</Text>
                </View>
            </View>

            {/* The notch is the goal. No label under it — the goal is stated in
                the recovery line below when it actually matters. */}
            <View style={styles.barWrapper}>
                <PlannerProgressBar percentage={percentage} target={target} height={6} />
            </View>

        </View>
    );
}

const getStyles = () => StyleSheet.create({
    container: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        marginTop: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    heroRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    heroRight: {
        alignItems: 'flex-end',
    },
    percentage: {
        fontWeight: '700',
        fontSize: 32,
        letterSpacing: -0.5,
    },
    marks: {
        fontWeight: '700',
        fontSize: 22,
        color: COLORS.textPrimary,
        letterSpacing: -0.3,
    },
    heroLabel: {
        fontWeight: '500',
        fontSize: FONT_SIZES.sm,
        color: COLORS.textMuted,
        marginTop: 2,
    },
    barWrapper: {
        marginTop: SPACING.md,
    },
});
