import React, { useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated, Easing } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS, MOTION } from '../../theme/theme';

export default function Button({
    title,
    onPress,
    variant = 'primary',
    disabled = false,
    style,
}) {
    const styles = getStyles();
    const scale = useRef(new Animated.Value(1)).current;

    const onPressIn = () => {
        Animated.timing(scale, {
            toValue: 0.96,
            duration: 80,
            easing: MOTION.easing.press,
            useNativeDriver: true,
        }).start();
    };

    const onPressOut = () => {
        Animated.timing(scale, {
            toValue: 1,
            duration: 150,
            easing: MOTION.easing.enter,
            useNativeDriver: true,
        }).start();
    };

    return (
        <Animated.View style={[{ transform: [{ scale }] }, style]}>
            <TouchableOpacity
                style={[
                    styles.button,
                    variant === 'primary' && styles.primary,
                    variant === 'secondary' && styles.secondary,
                    disabled && styles.disabled,
                ]}
                onPress={onPress}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                disabled={disabled}
                activeOpacity={MOTION.pressOpacity}
            >
                <Text
                    style={[
                        styles.text,
                        variant === 'secondary' && styles.secondaryText,
                    ]}
                >
                    {title}
                </Text>
            </TouchableOpacity>
        </Animated.View>
    );
}

const getStyles = () => StyleSheet.create({
    button: {
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.lg,
        borderRadius: BORDER_RADIUS.md,
        alignItems: 'center',
        ...SHADOWS.medium,
    },
    primary: {
        backgroundColor: COLORS.primary,
    },
    secondary: {
        backgroundColor: 'transparent',
        ...SHADOWS.small,
    },
    disabled: {
        opacity: 0.5,
    },
    text: {
        ...TYPOGRAPHY.button,
        color: '#FFFFFF',
    },
    secondaryText: {
        color: COLORS.primary,
    },
});
