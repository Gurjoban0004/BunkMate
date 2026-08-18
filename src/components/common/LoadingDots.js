import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing, Platform } from 'react-native';
import { COLORS } from '../../theme/theme';

const COUNT = 3;
const STAGGER = 150;
const PULSE = 340;

/**
 * LoadingDots — in-place "working on it" for buttons and rows.
 *
 * Replaces ActivityIndicator wherever the wait happens inside a control the
 * user just pressed. A spinner reads as "the app is busy"; three dots settling
 * in the button they tapped reads as "your tap is being handled".
 */
export default function LoadingDots({ color, size = 6, style }) {
    const dots = useRef(Array.from({ length: COUNT }, () => new Animated.Value(0.35))).current;

    useEffect(() => {
        const reduceMotion = Platform.OS === 'web'
            && typeof window !== 'undefined'
            && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

        if (reduceMotion) {
            dots.forEach((d) => d.setValue(0.75));
            return undefined;
        }

        // Each dot runs the same total cycle length, offset by its own delay,
        // so the group stays in phase for as long as the loop runs.
        const loops = dots.map((dot, i) => Animated.loop(
            Animated.sequence([
                Animated.delay(i * STAGGER),
                Animated.timing(dot, {
                    toValue: 1,
                    duration: PULSE,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(dot, {
                    toValue: 0.35,
                    duration: PULSE,
                    easing: Easing.in(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.delay((COUNT - 1 - i) * STAGGER),
            ])
        ));

        loops.forEach((l) => l.start());
        return () => loops.forEach((l) => l.stop());
    }, [dots]);

    const dotColor = color || COLORS.textOnPrimary;

    return (
        <View style={[styles.row, { gap: Math.round(size * 0.9) }, style]} accessibilityRole="progressbar">
            {dots.map((opacity, i) => (
                <Animated.View
                    key={i}
                    style={{
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        backgroundColor: dotColor,
                        opacity,
                    }}
                />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
