import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme/theme';

const StreakBanner = ({ streak }) => {
    const styles = getStyles();
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.2,
                    duration: 500,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true,
                }),
            ])
        );
        pulse.start();

        return () => pulse.stop();
    }, []);

    // Don't show if streak < 3
    if (streak < 3) return null;

    const getMessage = () => {
        if (streak >= 50) return "You're legendary! 🏆";
        if (streak >= 25) return "Unstoppable! 💪";
        if (streak >= 10) return "On fire! 🔥";
        if (streak >= 5) return "Keep it going!";
        return "Nice start!";
    };

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <Animated.Text
                    style={[
                        styles.fireEmoji,
                        { transform: [{ scale: pulseAnim }] }
                    ]}
                >
                    🔥
                </Animated.Text>
                <View style={styles.textContainer}>
                    <Text style={styles.streakCount}>{streak} Class Streak!</Text>
                    <Text style={styles.message}>{getMessage()}</Text>
                </View>
            </View>
        </View>
    );
};

const getStyles = () => StyleSheet.create({
    container: {
        marginHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.md,
        backgroundColor: COLORS.warningLight,
        borderRadius: BORDER_RADIUS.lg,
        
        borderColor: COLORS.warning,
        overflow: 'hidden',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
    },
    fireEmoji: {
        fontSize: 32,
        marginRight: SPACING.md,
    },
    textContainer: {
        flex: 1,
    },
    streakCount: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.warningDark,
    },
    message: {
        fontSize: 13,
        color: COLORS.warningDark,
        marginTop: 2,
    },
});

export default StreakBanner;
