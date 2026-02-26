import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZES } from '../../theme/theme';

const EmptyDay = () => {
    return (
        <View style={styles.container}>
            <Text style={styles.emoji}>🎉</Text>
            <Text style={styles.title}>No Classes Today!</Text>
            <Text style={styles.subtitle}>
                Enjoy your day off. You've earned it!
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        paddingVertical: SPACING.xxl,
        paddingHorizontal: SPACING.lg,
    },
    emoji: {
        fontSize: 64,
        marginBottom: SPACING.md,
    },
    title: {
        fontSize: FONT_SIZES.xl,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: SPACING.xs,
    },
    subtitle: {
        fontSize: FONT_SIZES.md,
        color: COLORS.textSecondary,
        textAlign: 'center',
    },
});

export default EmptyDay;
