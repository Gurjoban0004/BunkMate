import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZES } from '../../theme/theme';

const EmptyDay = () => {
    const styles = getStyles();
    return (
        <View style={styles.container}>
            <Text style={styles.title}>No classes today</Text>
            <Text style={styles.subtitle}>
                Nothing scheduled. Your attendance is unchanged.
            </Text>
        </View>
    );
};

const getStyles = () => StyleSheet.create({
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
