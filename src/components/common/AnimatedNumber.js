import React from 'react';
import { Animated, StyleSheet } from 'react-native';

const AnimatedNumber = ({
    value,
    suffix = '%',
    style,
}) => {
    const styles = getStyles();
    return (
        <Animated.Text style={[styles.text, style]}>
            {value.toFixed(1)}{suffix}
        </Animated.Text>
    );
};

const getStyles = () => StyleSheet.create({
    text: {
        fontVariant: ['tabular-nums'],
    },
});

export default AnimatedNumber;
