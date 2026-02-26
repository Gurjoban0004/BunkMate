import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../theme/theme';

const HolidayCard = ({ onUndo }) => {
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

const styles = StyleSheet.create({
    container: {
        backgroundColor: COLORS.infoLight,
        marginHorizontal: SPACING.lg,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.xl,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.info,
    },
    emoji: {
        fontSize: 64,
        marginBottom: SPACING.md,
    },
    title: {
        fontSize: FONT_SIZES.xl,
        fontWeight: '700',
        color: COLORS.info,
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
        borderWidth: 1,
        borderColor: COLORS.info,
    },
    undoText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.info,
    },
});

export default HolidayCard;
