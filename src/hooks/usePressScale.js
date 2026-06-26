import { useRef } from 'react';
import { Animated, Easing } from 'react-native';

export default function usePressScale(toValue = 0.97) {
    const scale = useRef(new Animated.Value(1)).current;

    const onPressIn = () => {
        Animated.timing(scale, {
            toValue,
            duration: 90,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
        }).start();
    };

    const onPressOut = () => {
        Animated.timing(scale, {
            toValue: 1,
            duration: 160,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    };

    return { scale, onPressIn, onPressOut };
}
