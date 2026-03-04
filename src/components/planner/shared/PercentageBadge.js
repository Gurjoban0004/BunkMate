import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZES, BORDER_RADIUS } from '../../../theme/theme';

/**
 * Colored percentage display badge.
 * Props: percentage, status ('danger'|'warning'|'safe'), size ('sm'|'md'|'lg')
 */
export default function PercentageBadge({ percentage, status, size = 'md' }) {
    const statusColors = {
        danger: { bg: COLORS.dangerLight, text: COLORS.danger },
        warning: { bg: COLORS.warningLight, text: COLORS.warningDark },
        safe: { bg: COLORS.successLight, text: COLORS.successDark },
    };

    const colors = statusColors[status] || statusColors.safe;
    const fontSize = size === 'lg' ? FONT_SIZES.xl : size === 'sm' ? FONT_SIZES.xs : FONT_SIZES.md;

    return (
        <View style={[styles.badge, { backgroundColor: colors.bg }]}>
            <Text style={[styles.text, { color: colors.text, fontSize }]}>
                {typeof percentage === 'number' ? `${percentage.toFixed(1)}%` : percentage}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.full,
        alignSelf: 'flex-start',
    },
    text: {
        fontWeight: '700',
    },
});
