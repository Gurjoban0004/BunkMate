import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../../theme/theme';

/**
 * Target % stepper: +/- buttons to adjust target percentage.
 * Props: value (number), onChange (fn), min (default 50), max (default 95)
 */
export default function TargetSelector({ value, onChange, min = 50, max = 95 }) {
    const canDecrease = value > min;
    const canIncrease = value < max;

    return (
        <View style={styles.container}>
            <Text style={styles.label}>Target</Text>

            <View style={styles.stepper}>
                <TouchableOpacity
                    style={[styles.button, !canDecrease && styles.buttonDisabled]}
                    onPress={() => canDecrease && onChange(value - 1)}
                    disabled={!canDecrease}
                    activeOpacity={0.6}
                >
                    <Text style={[styles.buttonText, !canDecrease && styles.buttonTextDisabled]}>−</Text>
                </TouchableOpacity>

                <View style={styles.valueContainer}>
                    <Text style={styles.value}>{value}%</Text>
                </View>

                <TouchableOpacity
                    style={[styles.button, !canIncrease && styles.buttonDisabled]}
                    onPress={() => canIncrease && onChange(value + 1)}
                    disabled={!canIncrease}
                    activeOpacity={0.6}
                >
                    <Text style={[styles.buttonText, !canIncrease && styles.buttonTextDisabled]}>+</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.md,
        paddingVertical: 20,
        paddingHorizontal: 20,
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.md,
        ...SHADOWS.medium,
    },
    label: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    stepper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    button: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonDisabled: {
        backgroundColor: COLORS.inputBackground,
    },
    buttonText: {
        fontSize: FONT_SIZES.xl,
        fontWeight: '600',
        color: COLORS.primaryDark,
        lineHeight: FONT_SIZES.xl + 2,
    },
    buttonTextDisabled: {
        color: COLORS.textMuted,
    },
    valueContainer: {
        minWidth: 64,
        alignItems: 'center',
    },
    value: {
        fontSize: FONT_SIZES.xxl,
        fontWeight: '700',
        color: COLORS.primary,
    },
});
