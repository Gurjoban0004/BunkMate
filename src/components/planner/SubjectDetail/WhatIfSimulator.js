import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../../theme/theme';
import { calculatePercentage } from '../../../utils/attendance';
import { determineStatus } from '../../../utils/planner/attendanceCalculations';
import PlannerProgressBar from '../shared/PlannerProgressBar';

/**
 * What-If simulator utilizing a slider mechanism to simulate attending or skipping classes.
 */
export default function WhatIfSimulator({ subjectData }) {
    const { attended, total, target } = subjectData;
    const [sliderValue, setSliderValue] = useState(0);

    const attendCount = sliderValue > 0 ? sliderValue : 0;
    const skipCount = sliderValue < 0 ? Math.abs(sliderValue) : 0;

    const simulatedAttended = attended + attendCount;
    const simulatedTotal = total + attendCount + skipCount;
    const simulatedPercentage = calculatePercentage(simulatedAttended, simulatedTotal);
    const status = determineStatus(simulatedPercentage, target);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>What If Simulator</Text>
            <Text style={styles.subtitle}>Test different scenarios</Text>

            <View style={styles.resultRow}>
                <Text style={styles.label}>Predicted</Text>
                <Text style={[styles.resultPercentage, {
                    color: status === 'danger' ? COLORS.danger :
                        status === 'warning' ? COLORS.warningDark : COLORS.success
                }]}>
                    {simulatedPercentage.toFixed(1)}%
                </Text>
            </View>

            <PlannerProgressBar percentage={simulatedPercentage} target={target} height={8} />

            <View style={styles.sliderWrapper}>
                <Slider
                    style={styles.slider}
                    minimumValue={-5}
                    maximumValue={10}
                    step={1}
                    value={sliderValue}
                    onValueChange={setSliderValue}
                    minimumTrackTintColor={COLORS.danger}
                    maximumTrackTintColor={COLORS.success}
                    thumbTintColor={COLORS.primary}
                />
                <View style={styles.sliderLabels}>
                    <Text style={styles.sliderLabel}>Skip 5</Text>
                    <Text style={[styles.sliderLabel, styles.sliderCenter]}>Now</Text>
                    <Text style={styles.sliderLabel}>Attend 10</Text>
                </View>
            </View>

            <View style={styles.resultDetail}>
                <Text style={styles.detailText}>
                    {simulatedAttended}/{simulatedTotal} classes → {simulatedPercentage.toFixed(1)}%
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
    sliderWrapper: {
        marginTop: SPACING.lg,
    },
    slider: {
        width: '100%',
        height: 40,
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
