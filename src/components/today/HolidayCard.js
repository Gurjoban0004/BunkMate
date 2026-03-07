import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../theme/theme';

const HolidayCard = ({ onUndo }) => {
    const styles = getStyles();
    return (
        <View style={styles.container}>
            <Text style={styles.emoji}>🏖️</Text>
            <Text style={styles.title}>Holiday</Text>
            <Text style={styles.subtitle}>No classes today - Enjoy!</Text>

            <TouchableOpacity style={styles.undoButton} onPress={onUndo}>
                <Text style={styles.undoText}>Undo Holiday</Text>
            </TouchableOpacity>
        </View>
    );
};

const getStyles = () => StyleSheet.create({
    container: {
        backgroundColor: COLORS.primaryLight,
        marginHorizontal: SPACING.lg,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.xl,
        alignItems: 'center',
        ...SHADOWS.small,
    },
    emoji: {
        fontSize: 64,
        marginBottom: SPACING.md,
    },
    title: {
        fontSize: FONT_SIZES.xl,
        fontWeight: '700',
        color: COLORS.primary,
    },
    subtitle: {
        fontSize: FONT_SIZES.md,
        color: COLORS.textSecondary,
        marginTop: SPACING.xs,
    },
    undoButton: {
        marginTop: SPACING.lg,
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.lg,
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.md,


    },
    undoText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.primary,
    },
});

export default HolidayCard;
