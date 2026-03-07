import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../../theme/theme';

export default function Card({ children, style }) {
    const styles = getStyles();
    return <View style={[styles.card, style]}>{children}</View>;
}

const getStyles = () => StyleSheet.create({
    card: {
        backgroundColor: COLORS.cardBackground,
        padding: SPACING.cardPadding,
        borderRadius: BORDER_RADIUS.md,
        
        
        ...SHADOWS.small,
    },
});
