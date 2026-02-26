import { useRef, useEffect } from 'react';
import { Animated } from 'react-native';

export const useStaggeredAnimation = (itemCount, delay = 100) => {
    const animations = useRef(
        Array.from({ length: itemCount }, () => new Animated.Value(0))
    ).current;

    useEffect(() => {
        const staggeredAnimations = animations.map((anim, index) =>
            Animated.timing(anim, {
                toValue: 1,
                duration: 300,
                delay: index * delay,
                useNativeDriver: true,
            })
        );

        Animated.stagger(delay, staggeredAnimations).start();
    }, [itemCount]);

    const getAnimatedStyle = (index) => ({
        opacity: animations[index] || new Animated.Value(1),
        transform: [
            {
                translateY: (animations[index] || new Animated.Value(1)).interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                }),
            },
        ],
    });

    return { getAnimatedStyle };
};
