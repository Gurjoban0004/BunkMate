import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZES } from '../../../theme/theme';
import StatusDot from './StatusDot';

/**
 * Impact text showing "Skip → 69% 🔴" or "Attend → 73% 🟢"
 * Props: label ('Skip'|'Attend'), percentage, status, change (optional signed number)
 */
export default function ImpactText({ label, percentage, status, change }) {
    const styles = getStyles();
    const statusColors = {
        danger: COLORS.danger,
        warning: COLORS.warningDark,
        safe: COLORS.successDark,
    };

    const changeText = change != null
        ? (change >= 0 ? `+${change}%` : `${change}%`)
        : '';

    return (
        <View style={styles.container}>
            <Text style={styles.label}>{label} →</Text>
            <Text style={[styles.percentage, { color: statusColors[status] || COLORS.textPrimary }]}>
                {typeof percentage === 'number' ? `${percentage.toFixed(1)}%` : percentage}
            </Text>
            <StatusDot status={status} size={8} />
            {changeText !== '' && (
                <Text style={[styles.change, { color: statusColors[status] || COLORS.textSecondary }]}>
                    ({changeText})
                </Text>
            )}
        </View>
    );
}

const getStyles = () => StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4, // slightly tighter gap
    },
    label: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
    },
    percentage: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '700',
    },
    change: {
        fontSize: 11, // slightly smaller than xs
    },
});
