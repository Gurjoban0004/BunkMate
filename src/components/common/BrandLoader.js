import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing, Platform } from 'react-native';
import { SHADOWS } from '../../theme/theme';
import BrandMark, { BRAND_PAPER } from './BrandMark';

/**
 * First-paint brand mark — the Presence "P" logo, breathing gently.
 * Matches the launcher icon exactly so the splash and the app icon are one mark.
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
    const markOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.pill, { transform: [{ scale }], opacity: markOpacity }]}>
                <BrandMark size={80} />
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        // Match the native splash background so the handoff is seamless (no colour jump).
        backgroundColor: BRAND_PAPER,
    },
    pill: {
        borderRadius: 24,
        overflow: 'hidden',
        ...SHADOWS.medium,
    },
});
