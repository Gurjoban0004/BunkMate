import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../../theme/theme';
import { simulateAttendance, determineStatus } from '../../../utils/planner/attendanceCalculations';
import PlannerProgressBar from '../shared/PlannerProgressBar';

/**
 * What-If simulator with slider to see impact of attending/skipping N classes.
 */
export default function WhatIfSimulator({ subjectData }) {
    const { attended, total, target } = subjectData;
    const [offset, setOffset] = useState(0);

    const simulated = simulateAttendance(attended, total, offset);
    const status = determineStatus(simulated.percentage, target);

    const getLabel = () => {
        if (offset === 0) return 'Current';
        if (offset > 0) return `Attend ${offset} more`;
        return `Skip ${Math.abs(offset)} more`;
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>What If?</Text>
            <Text style={styles.subtitle}>Slide to simulate future classes</Text>

            <View style={styles.resultRow}>
                <Text style={styles.label}>{getLabel()}</Text>
                <Text style={[styles.resultPercentage, {
                    color: status === 'danger' ? COLORS.danger :
                        status === 'warning' ? COLORS.warningDark : COLORS.success
                }]}>
                    {simulated.percentage.toFixed(1)}%
                </Text>
            </View>

            <PlannerProgressBar percentage={simulated.percentage} target={target} height={8} />

            <Slider
                style={styles.slider}
                minimumValue={-5}
                maximumValue={10}
                step={1}
                value={offset}
                onValueChange={setOffset}
                minimumTrackTintColor={COLORS.danger}
                maximumTrackTintColor={COLORS.success}
                thumbTintColor={COLORS.primary}
            />

            <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabel}>Skip 5</Text>
                <Text style={[styles.sliderLabel, styles.sliderCenter]}>Now</Text>
                <Text style={styles.sliderLabel}>Attend 10</Text>
            </View>

            <View style={styles.resultDetail}>
                <Text style={styles.detailText}>
                    {simulated.attended}/{simulated.total} classes → {simulated.percentage.toFixed(1)}%
                </Text>
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
    },
    subtitle: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
        marginBottom: SPACING.md,
    },
    resultRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    label: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
    resultPercentage: {
        fontSize: FONT_SIZES.xl,
        fontWeight: '700',
    },
    slider: {
        width: '100%',
        height: 40,
        marginTop: SPACING.sm,
    },
    sliderLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    sliderLabel: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
    },
    sliderCenter: {
        fontWeight: '600',
    },
    resultDetail: {
        marginTop: SPACING.sm,
        alignItems: 'center',
    },
    detailText: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
    },
});
