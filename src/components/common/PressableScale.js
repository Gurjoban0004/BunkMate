import React, { useRef } from 'react';
import { Animated, Pressable } from 'react-native';
import { triggerHaptic } from '../../utils/haptics';

const PressableScale = ({
    children,
    onPress,
    scale = 0.95,
    haptic = true,
    hapticType = 'light',
    style,
    ...props
}) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: scale,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    };

    const handlePress = () => {
        if (haptic) {
            triggerHaptic(hapticType);
        }
        onPress?.();
    };

    return (
        <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handlePress}
            {...props}
        >
            <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
                {children}
            </Animated.View>
        </Pressable>
    );
};

export default PressableScale;
