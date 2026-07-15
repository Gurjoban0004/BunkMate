import { useRef, useEffect } from 'react';
import { Animated, Easing, Platform } from 'react-native';

/**
 * Eases a screen in whenever `routeKey` changes — a short fade + slight rise.
 * Replaces the instant screen swap in the web navigators (which felt "clicky").
 * Returns a style object to spread onto the Animated.View wrapping the screen.
 *
 * Honors prefers-reduced-motion on web.
 */
export default function useRouteTransition(routeKey, { duration = 200, rise = 8 } = {}) {
    const anim = useRef(new Animated.Value(1)).current;
    const prevKey = useRef(routeKey);

    useEffect(() => {
        if (prevKey.current === routeKey) return;
        prevKey.current = routeKey;

        const reduceMotion = Platform.OS === 'web'
            && typeof window !== 'undefined'
            && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        if (reduceMotion) {
            anim.setValue(1);
            return;
        }

        anim.setValue(0);
        Animated.timing(anim, {
            toValue: 1,
            duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [routeKey, anim, duration]);

    return {
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [rise, 0] }) }],
    };
}
