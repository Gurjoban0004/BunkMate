import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../theme/theme';

const HolidayCard = ({ onUndo }) => {
    const styles = getStyles();
    return (
        <View style={styles.container}>
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
        marginHorizontal: SPACING.screenPadding,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.xl,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.primary,
    },
    title: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.primary,
        letterSpacing: -0.3,
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
        borderRadius: BORDER_RADIUS.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    undoText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.primary,
    },
});

export default HolidayCard;
