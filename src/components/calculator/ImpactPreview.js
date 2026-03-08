import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../theme/theme';

const ImpactPreview = ({ currentPercentage, projectedPercentage, skipCount }) => {
    const styles = getStyles();
    const change = projectedPercentage - currentPercentage;
    const isNegative = change < 0;
    const changeColor = isNegative ? COLORS.danger : COLORS.success;

    if (skipCount === 0) {
        return (
            <View style={styles.container}>
                <Text style={styles.emptyText}>
                    Move the slider to see the impact
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>
                If you skip {skipCount} class{skipCount !== 1 ? 'es' : ''}:
            </Text>

            {/* Before / After comparison */}
            <View style={styles.comparisonRow}>
                {/* Current */}
                <View style={styles.comparisonItem}>
                    <Text style={styles.comparisonLabel}>Now</Text>
                    <Text style={styles.comparisonValue}>{currentPercentage.toFixed(1)}%</Text>
                    <View style={styles.miniBar}>
                        <View
                            style={[
                                styles.miniBarFill,
                                {
                                    width: `${Math.min(currentPercentage, 100)}%`,
                                    backgroundColor: COLORS.primary,
                                },
                            ]}
                        />
                    </View>
                </View>

                {/* Arrow */}
                <Text style={styles.arrow}>→</Text>

                {/* Projected */}
                <View style={styles.comparisonItem}>
                    <Text style={styles.comparisonLabel}>After</Text>
                    <Text style={[styles.comparisonValue, { color: changeColor }]}>
                        {projectedPercentage.toFixed(1)}%
                    </Text>
                    <View style={styles.miniBar}>
                        <View
                            style={[
                                styles.miniBarFill,
                                {
                                    width: `${Math.min(projectedPercentage, 100)}%`,
                                    backgroundColor: isNegative ? COLORS.danger : COLORS.success,
                                },
                            ]}
                        />
                    </View>
                </View>
            </View>

            {/* Change indicator */}
            <View style={[styles.changeBadge, { backgroundColor: isNegative ? COLORS.dangerLight : COLORS.successLight }]}>
                <Text style={[styles.changeText, { color: changeColor }]}>
                    {isNegative ? '📉' : '📈'} {change > 0 ? '+' : ''}{change.toFixed(1)}%
                </Text>
            </View>
        </View>
    );
};

const getStyles = () => StyleSheet.create({
    container: {
        backgroundColor: COLORS.cardBackground,
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        ...SHADOWS.small,
    },
    title: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: SPACING.md,
    },
    emptyText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textMuted,
        textAlign: 'center',
        paddingVertical: SPACING.md,
    },
    comparisonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.md,
    },
    comparisonItem: {
        flex: 1,
        alignItems: 'center',
    },
    comparisonLabel: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
        marginBottom: 4,
        fontWeight: '600',
    },
    comparisonValue: {
        fontSize: FONT_SIZES.xl,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: SPACING.sm,
    },
    arrow: {
        fontSize: 20,
        color: COLORS.textMuted,
        marginTop: 10,
    },
    miniBar: {
        width: '100%',
        height: 6,
        backgroundColor: COLORS.border,
        borderRadius: 3,
        overflow: 'hidden',
    },
    miniBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    changeBadge: {
        alignSelf: 'center',
        marginTop: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs + 2,
    },
    changeText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '700',
    },
});

export default ImpactPreview;
