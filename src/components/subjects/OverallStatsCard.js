import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../theme/theme';

const formatDay = (dateKey) => {
    if (!dateKey) return '';
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Date(y, m - 1, d, 12).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const OverallStatsCard = ({ stats, threshold, updatedThrough }) => {
    const styles = getStyles();
    const { attended, total, percentage, dangerCount, edgeCount, safeCount } = stats;
    const numericPercentage = parseFloat(percentage);
    const isAboveThreshold = numericPercentage >= threshold;

    // One column, four stacked lines. The old two-column layout with a divider
    // and three dotted health rows was the tallest thing on the screen and the
    // subject list underneath already groups by exactly those three states.
    const counts = [
        dangerCount && `${dangerCount} Below Goal`,
        edgeCount && `${edgeCount} On Edge`,
        safeCount && `${safeCount} Safe`,
    ].filter(Boolean);

    return (
        <View style={styles.container}>
            <View style={styles.heroRow}>
                <Text style={[
                    styles.percentage,
                    isAboveThreshold ? styles.percentageSafe : styles.percentageDanger,
                ]}>
                    {percentage}%
                </Text>
                <Text style={styles.heroLabel}>Overall</Text>
            </View>

            <Text style={styles.metaText}>
                {attended} of {total} hours  ·  Goal {threshold}%
            </Text>

            <View style={styles.progressBar}>
                <View
                    style={[
                        styles.progressFill,
                        {
                            width: `${Math.min(numericPercentage, 100)}%`,
                            backgroundColor: isAboveThreshold ? COLORS.success : COLORS.danger,
                        },
                    ]}
                />
            </View>

            {counts.length > 0 && (
                <Text style={styles.countsText}>{counts.join('  ·  ')}</Text>
            )}

            {updatedThrough && (
                <Text style={styles.updatedText}>Your college has updated through {formatDay(updatedThrough)}.</Text>
            )}
        </View>
    );
};

const getStyles = () => StyleSheet.create({
    container: {
        backgroundColor: COLORS.cardBackground,
        marginHorizontal: SPACING.screenPadding,
        borderRadius: BORDER_RADIUS.md,
        paddingVertical: SPACING.sm + 4,
        paddingHorizontal: SPACING.md + 2,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...Platform.select({
            ios: {
                shadowColor: COLORS.shadow,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 3,
            },
            android: {
                elevation: 2,
            },
            web: {
                boxShadow: '0px 2px 4px rgba(15,23,42,0.05)',
            }
        }),
    },
    heroRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: SPACING.sm,
    },
    percentage: {
        fontWeight: '700',
        fontSize: 25,
        letterSpacing: -0.3,
    },
    percentageSafe: {
        color: COLORS.successText,
    },
    percentageDanger: {
        color: COLORS.dangerText,
    },
    heroLabel: {
        fontWeight: '600',
        fontSize: FONT_SIZES.md,
        color: COLORS.textSecondary,
    },
    metaText: {
        fontWeight: '500',
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        marginTop: 3,
    },
    progressBar: {
        width: '100%',
        height: 4,
        backgroundColor: COLORS.inputBackground,
        borderRadius: 2,
        overflow: 'hidden',
        marginTop: SPACING.sm,
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    countsText: {
        fontWeight: '600',
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        marginTop: SPACING.sm,
    },
    updatedText: {
        fontWeight: '500',
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
        marginTop: SPACING.sm,
    },
});

export default OverallStatsCard;
