import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing, Platform } from 'react-native';
import { COLORS, SHADOWS } from '../../theme/theme';

/**
 * First-paint brand mark — the concentric-ring identity from the Welcome
 * screen, breathing gently. Replaces the old tint-filled app icon, which
 * rendered as a solid colored square.
 */
export default function BrandLoader() {
    const breathe = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const reduceMotion = Platform.OS === 'web'
            && typeof window !== 'undefined'
            && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        if (reduceMotion) {
            breathe.setValue(0.5);
            return undefined;
        }
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(breathe, {
                    toValue: 1,
                    duration: 1100,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(breathe, {
                    toValue: 0,
                    duration: 1100,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [breathe]);

    const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.03] });
    const ringOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.pill, { transform: [{ scale }] }]}>
                <Animated.View style={[styles.outerRing, { opacity: ringOpacity }]}>
                    <View style={styles.innerRing}>
                        <View style={styles.coreDot} />
                    </View>
                </Animated.View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
    },
    pill: {
        width: 80,
        height: 80,
        borderRadius: 24,
        backgroundColor: COLORS.cardBackground,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.medium,
    },
    outerRing: {
        width: 52,
        height: 52,
        borderRadius: 26,
        borderWidth: 2,
        borderColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    innerRing: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: COLORS.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    coreDot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: COLORS.primary,
    },
});
