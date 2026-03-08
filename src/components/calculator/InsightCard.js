import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../theme/theme';

/**
 * Renders a single personalized insight card.
 * type: 'bestDay' | 'pattern' | 'trend' | 'comparison' | 'quickWin'
 */
const InsightCard = ({ type, data }) => {
    const styles = getStyles();
    if (!data) return null;

    const configs = {
        bestDay: {
            emoji: '',
            title: 'Best day to skip',
        },
        pattern: {
            emoji: '📊',
            title: 'Your Pattern',
        },
        trend: {
            emoji: data?.emoji || '📈',
            title: 'Trend',
        },
        comparison: {
            emoji: '🏆',
            title: 'Rank',
        },
        quickWin: {
            emoji: '💡',
            title: 'Quick Win',
        },
    };

    const config = configs[type] || configs.pattern;

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={styles.emoji}>{config.emoji}</Text>
                <Text style={styles.title}>{config.title}</Text>
            </View>
            {data.primary && (
                <Text style={styles.primary}>{data.primary}</Text>
            )}
            {data.secondary && (
                <Text style={styles.secondary}>{data.secondary}</Text>
            )}
            {data.tip && (
                <View style={styles.tipRow}>
                    <Text style={styles.tipText}>{data.tip}</Text>
                </View>
            )}
        </View>
    );
};

const getStyles = () => StyleSheet.create({
    container: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        marginBottom: SPACING.md,
        ...SHADOWS.small,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    emoji: {
        fontSize: 18,
        marginRight: SPACING.sm,
    },
    title: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    primary: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: 4,
    },
    secondary: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        lineHeight: 20,
    },
    tipRow: {
        marginTop: SPACING.sm,
        backgroundColor: COLORS.primaryLight,
        borderRadius: BORDER_RADIUS.sm,
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs + 2,
    },
    tipText: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.primary,
        fontWeight: '600',
    },
});

export default InsightCard;
