import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS, TYPOGRAPHY } from '../../../theme/theme';
import { calculateSkipImpact, calculateAttendImpact, determineStatus } from '../../../utils/planner/attendanceCalculations';

/**
 * Redesigned single-card Next Class Projection component.
 * Replaces the split cards with an integrated comparison layout.
 */
export default function NextClassDecision({ subjectData }) {
    const styles = getStyles();
    const { attended, total, target } = subjectData;

    const skipImpact = calculateSkipImpact(attended, total);
    const attendImpact = calculateAttendImpact(attended, total);
    const skipStatus = determineStatus(skipImpact.newPercentage, target);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Next Class Projection</Text>

            {/* Skip projection row */}
            <View style={styles.impactRow}>
                <View style={styles.leftInfo}>
                    <View style={[styles.statusDot, { backgroundColor: COLORS.danger }]} />
                    <Text style={styles.impactText}>If you skip next class</Text>
                </View>
                <View style={styles.rightStats}>
                    <Text style={[styles.percentageText, { color: skipStatus === 'danger' ? COLORS.danger : COLORS.warningDark }]}>
                        {skipImpact.newPercentage.toFixed(1)}%
                    </Text>
                    <Text style={[styles.changeText, { color: COLORS.danger }]}>
                        {skipImpact.change}%
                    </Text>
                </View>
            </View>

            {/* Subtle Divider */}
            <View style={styles.divider} />

            {/* Attend projection row */}
            <View style={styles.impactRow}>
                <View style={styles.leftInfo}>
                    <View style={[styles.statusDot, { backgroundColor: COLORS.success }]} />
                    <Text style={styles.impactText}>If you attend next class</Text>
                </View>
                <View style={styles.rightStats}>
                    <Text style={[styles.percentageText, { color: COLORS.successDark }]}>
                        {attendImpact.newPercentage.toFixed(1)}%
                    </Text>
                    <Text style={[styles.changeText, { color: COLORS.success }]}>
                        +{attendImpact.change}%
                    </Text>
                </View>
            </View>
        </View>
    );
}

const getStyles = () => StyleSheet.create({
    container: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...Platform.select({
            ios: {
                shadowColor: COLORS.shadow,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 3,
            },
            android: {
                elevation: 2,
            },
            web: {
                boxShadow: '0px 2px 4px rgba(15,23,42,0.05)',
            }
        }),
    },
    title: {
        fontSize: 10,
        fontWeight: '700',
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: SPACING.sm,
    },
    impactRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
    },
    leftInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    impactText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    rightStats: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 6,
    },
    percentageText: {
        fontSize: 16,
        fontWeight: '700',
    },
    changeText: {
        fontSize: 11,
        fontWeight: '700',
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginVertical: SPACING.xs,
        opacity: 0.5,
    },
});
