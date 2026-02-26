import React from 'react';
import { Animated, StyleSheet } from 'react-native';

const AnimatedNumber = ({
    value,
    suffix = '%',
    style,
}) => {
    return (
        <Animated.Text style={[styles.text, style]}>
            {value.toFixed(1)}{suffix}
        </Animated.Text>
    );
};

const styles = StyleSheet.create({
    text: {
        fontVariant: ['tabular-nums'],
    },
});

export default AnimatedNumber;
