import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Slider from '@react-native-community/slider';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../theme/theme';

const BunkSlider = ({ value, onValueChange, maxValue = 15, subjectColor }) => {
    const [localValue, setLocalValue] = useState(value);

    const handleValueChange = useCallback((val) => {
        const rounded = Math.round(val);
        setLocalValue(rounded);
    }, []);

    const handleSlidingComplete = useCallback((val) => {
        const rounded = Math.round(val);
        setLocalValue(rounded);
        onValueChange(rounded);
    }, [onValueChange]);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>🎮 Play with Numbers</Text>
            <Text style={styles.subtitle}>How many classes to bunk?</Text>

            <View style={styles.sliderContainer}>
                <Text style={styles.rangeLabel}>0</Text>
                <View style={styles.sliderWrapper}>
                    <Slider
                        style={styles.slider}
                        minimumValue={0}
                        maximumValue={maxValue}
                        value={value}
                        onValueChange={handleValueChange}
                        onSlidingComplete={handleSlidingComplete}
                        step={1}
                        minimumTrackTintColor={subjectColor || COLORS.primary}
                        maximumTrackTintColor={COLORS.border}
                        thumbTintColor={subjectColor || COLORS.primary}
                    />
                </View>
                <Text style={styles.rangeLabel}>{maxValue}</Text>
            </View>

            {/* Current value bubble */}
            <View style={[styles.valueBubble, { backgroundColor: subjectColor || COLORS.primary }]}>
                <Text style={styles.valueText}>{localValue}</Text>
                <Text style={styles.valueLabel}>classes</Text>
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
        marginBottom: SPACING.md,
    },
    sliderContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rangeLabel: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.textMuted,
        width: 24,
        textAlign: 'center',
    },
    sliderWrapper: {
        flex: 1,
        marginHorizontal: SPACING.xs,
    },
    slider: {
        width: '100%',
        height: 40,
    },
    valueBubble: {
        alignSelf: 'center',
        marginTop: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 6,
    },
    valueText: {
        fontSize: 28,
        fontWeight: '800',
        color: COLORS.textOnPrimary,
    },
    valueLabel: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.textOnPrimary,
        opacity: 0.85,
    },
});

export default BunkSlider;
