import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../../theme/theme';

/**
 * Target % stepper: +/- buttons to adjust target percentage.
 * Props: value (number), onChange (fn), min (default 50), max (default 95)
 */
export default function TargetSelector({ value, onChange, min = 50, max = 95 }) {
    const styles = getStyles();
    const canDecrease = value > min;
    const canIncrease = value < max;

    return (
        <View style={styles.container}>
            <View>
                <Text style={styles.label}>Attendance target</Text>
                <Text style={styles.subLabel}>Adjust the recovery goal</Text>
            </View>

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

const getStyles = () => StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.md,
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
        ...SHADOWS.small,
    },
    label: {
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    subLabel: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    stepper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    button: {
        width: 34,
        height: 34,
        borderRadius: 17,
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
        minWidth: 58,
        alignItems: 'center',
    },
    value: {
        fontSize: FONT_SIZES.xl,
        fontWeight: '800',
        color: COLORS.primary,
    },
});
