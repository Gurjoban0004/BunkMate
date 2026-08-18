import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../../theme/theme';
import PlannerProgressBar from '../shared/PlannerProgressBar';
import RecoveryPaths from './RecoveryPaths';
import {
    calculateSkipImpact,
    calculateAttendImpact,
    determineStatus,
} from '../../../utils/planner/attendanceCalculations';

/**
 * Where the subject stands, and what the next class does to it — one card.
 *
 * This replaces three stacked cards (status header, next-class projection,
 * recovery strip) that each had their own border, shadow and title. Three
 * bordered boxes in a row all competing for first read is worse hierarchy than
 * one card with three quiet tiers: the number, the projection, the way back.
 */
export default function SubjectSummaryCard({ subjectData }) {
    const styles = getStyles();
    const { attended, total, percentage, target, unitsPerClass } = subjectData;

    const status = determineStatus(percentage, target);
    const statusColor = status === 'danger' ? COLORS.dangerText
        : status === 'warning' ? COLORS.warningText
            : COLORS.successText;

    const skipImpact = calculateSkipImpact(attended, total, unitsPerClass);
    const attendImpact = calculateAttendImpact(attended, total, unitsPerClass);
    const skipStatus = determineStatus(skipImpact.exactPercentage, target);

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
                    <Text style={styles.heroLabel}>classes</Text>
                </View>
            </View>

            {/* The notch is the goal. No label under it — the goal is stated in
                the recovery line below when it actually matters. */}
            <View style={styles.barWrapper}>
                <PlannerProgressBar percentage={percentage} target={target} height={6} />
            </View>

            <View style={styles.rule} />

            <Text style={styles.sectionLabel}>Next class</Text>
            <View style={styles.projectionRow}>
                <Text style={styles.projection}>
                    Skip{' '}
                    <Text style={[styles.projectionValue, {
                        color: skipStatus === 'danger' ? COLORS.dangerText : COLORS.warningText,
                    }]}>
                        {skipImpact.newPercentage.toFixed(1)}%
                    </Text>
                </Text>
                <Text style={styles.separator}>·</Text>
                <Text style={styles.projection}>
                    Attend{' '}
                    <Text style={[styles.projectionValue, { color: COLORS.successText }]}>
                        {attendImpact.newPercentage.toFixed(1)}%
                    </Text>
                </Text>
            </View>

            {/* Only renders itself when there is ground to make up. */}
            <RecoveryPaths subjectData={subjectData} flat />
        </View>
    );
}

const getStyles = () => StyleSheet.create({
    container: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md + 2,
        marginBottom: SPACING.md,
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
    rule: {
        height: 1,
        backgroundColor: COLORS.border,
        marginTop: SPACING.md + 2,
        marginBottom: SPACING.md - 2,
    },
    sectionLabel: {
        fontWeight: '700',
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    projectionRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginTop: SPACING.sm - 2,
        gap: SPACING.sm + 2,
    },
    projection: {
        fontWeight: '500',
        fontSize: FONT_SIZES.md,
        color: COLORS.textSecondary,
    },
    projectionValue: {
        fontWeight: '700',
    },
    separator: {
        fontSize: FONT_SIZES.md,
        color: COLORS.textMuted,
    },
});
