import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { COLORS, BORDER_RADIUS } from '../../theme/theme';

export default function ProgressBar({ percentage, color, style }) {
    const fillColor =
        color ||
        (percentage >= 75
            ? COLORS.success
            : percentage >= 60
                ? COLORS.warning
                : COLORS.danger);
    const clampedWidth = Math.min(100, Math.max(0, percentage));

    const animatedWidth = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(animatedWidth, {
            toValue: clampedWidth,
            duration: 600,
            useNativeDriver: false,
        }).start();
    }, [clampedWidth]);

    const widthInterpolated = animatedWidth.interpolate({
        inputRange: [0, 100],
        outputRange: ['0%', '100%'],
    });

    return (
        <View style={[styles.track, style]}>
            <Animated.View
                style={[
                    styles.fill,
                    {
                        width: widthInterpolated,
                        backgroundColor: fillColor,
                    },
                ]}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    track: {
        height: 8,
        backgroundColor: COLORS.border,
        borderRadius: BORDER_RADIUS.full,
        overflow: 'hidden',
    },
    fill: {
        height: '100%',
        borderRadius: BORDER_RADIUS.full,
    },
});
