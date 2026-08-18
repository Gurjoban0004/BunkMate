import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing, Platform } from 'react-native';
import { COLORS, SPACING, MOTION } from '../../theme/theme';

/**
 * SetupProgress — where you are in setup, as plainly as it can be said.
 *
 * Replaces the numbered circles-and-connectors indicator. Numbered steps make a
 * three-screen flow look like paperwork, and the labels ("Login / Verify /
 * Theme") duplicated the heading directly underneath them. A row of segments
 * says the same thing without asking to be read.
 */
export default function SetupProgress({ steps = 3, current = 0, style }) {
    const styles = getStyles();
    return (
        <View style={[styles.row, style]} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: steps, now: current + 1 }}>
            {Array.from({ length: steps }, (_, i) => (
                <Segment key={i} filled={i <= current} styles={styles} />
            ))}
        </View>
    );
}

function Segment({ filled, styles }) {
    const fill = useRef(new Animated.Value(filled ? 1 : 0)).current;

    useEffect(() => {
        const reduceMotion = Platform.OS === 'web'
            && typeof window !== 'undefined'
            && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

        if (reduceMotion) {
            fill.setValue(filled ? 1 : 0);
            return undefined;
        }
        const anim = Animated.timing(fill, {
            toValue: filled ? 1 : 0,
            duration: MOTION.duration.normal,
            easing: MOTION.easing.snappy,
            useNativeDriver: true,
        });
        anim.start();
        return () => anim.stop();
    }, [filled, fill]);

    return (
        <View style={styles.track}>
            <Animated.View style={[styles.fill, { opacity: fill }]} />
        </View>
    );
}

const getStyles = () => StyleSheet.create({
    row: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 5,
    },
    // Small and centred. Full-width bars turned "where am I" into the loudest
    // thing on the screen; this is a footnote you can glance at.
    track: {
        width: 16,
        height: 2,
        borderRadius: 1,
        backgroundColor: COLORS.border,
        overflow: 'hidden',
    },
    fill: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: COLORS.primary,
    },
});
