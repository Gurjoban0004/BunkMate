import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { COLORS, BORDER_RADIUS } from '../../theme/theme';

const AnimatedProgressBar = ({
    percentage,
    color,
    height = 6,
    backgroundColor = COLORS.border,
    duration = 500,
}) => {
    const styles = getStyles();
    const widthAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(widthAnim, {
            toValue: Math.min(percentage, 100),
            duration,
            useNativeDriver: false,
        }).start();
    }, [percentage]);

    const width = widthAnim.interpolate({
        inputRange: [0, 100],
        outputRange: ['0%', '100%'],
    });

    return (
        <View style={[styles.container, { height, backgroundColor }]}>
            <Animated.View
                style={[
                    styles.fill,
                    {
                        width,
                        backgroundColor: color,
                        height,
                    }
                ]}
            />
        </View>
    );
};

const getStyles = () => StyleSheet.create({
    container: {
        borderRadius: BORDER_RADIUS.sm,
        overflow: 'hidden',
    },
    fill: {
        borderRadius: BORDER_RADIUS.sm,
    },
});

export default AnimatedProgressBar;
