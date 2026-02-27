import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../theme/theme';

const BunkStepper = ({ value, onValueChange, maxValue = 15, subjectColor }) => {
    const handleDecrement = () => {
        if (value > 0) {
            onValueChange(value - 1);
        }
    };

    const handleIncrement = () => {
        if (value < maxValue) {
            onValueChange(value + 1);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>🎮 Play with Numbers</Text>
            <Text style={styles.subtitle}>How many classes to bunk?</Text>

            <View style={styles.stepperContainer}>
                <TouchableOpacity
                    style={[
                        styles.stepperButton,
                        value === 0 && styles.stepperButtonDisabled
                    ]}
                    onPress={handleDecrement}
                    disabled={value === 0}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.stepperButtonText, value === 0 && styles.stepperButtonTextDisabled]}>-</Text>
                </TouchableOpacity>

                <View style={[styles.valueBubble, { backgroundColor: subjectColor || COLORS.primary }]}>
                    <Text style={styles.valueText}>{value}</Text>
                    <Text style={styles.valueLabel}>classes</Text>
                </View>

                <TouchableOpacity
                    style={[
                        styles.stepperButton,
                        value === maxValue && styles.stepperButtonDisabled
                    ]}
                    onPress={handleIncrement}
                    disabled={value === maxValue}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.stepperButtonText, value === maxValue && styles.stepperButtonTextDisabled]}>+</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.md,
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.small,
    },
    title: {
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        marginBottom: SPACING.lg,
    },
    stepperContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.xl,
        paddingVertical: SPACING.sm,
    },
    stepperButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: COLORS.inputBackground,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: COLORS.border,
        ...SHADOWS.small,
    },
    stepperButtonDisabled: {
        backgroundColor: COLORS.background,
        borderColor: COLORS.border,
        elevation: 0,
        shadowOpacity: 0,
    },
    stepperButtonText: {
        fontSize: 32,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginTop: -4,
    },
    stepperButtonTextDisabled: {
        color: COLORS.textMuted,
    },
    valueBubble: {
        borderRadius: BORDER_RADIUS.xl,
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.md,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 120,
        ...SHADOWS.medium,
    },
    valueText: {
        fontSize: 36,
        fontWeight: '800',
        color: COLORS.textOnPrimary,
        lineHeight: 40,
    },
    valueLabel: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '700',
        color: COLORS.textOnPrimary,
        opacity: 0.9,
        marginTop: -2,
    },
});

export default BunkStepper;
