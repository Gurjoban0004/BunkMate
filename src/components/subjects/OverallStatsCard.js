import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../theme/theme';

const OverallStatsCard = ({ stats, threshold, staleness, onBannerPress }) => {
    const styles = getStyles();
    const { attended, total, percentage, dangerCount, edgeCount, safeCount } = stats;
    const numericPercentage = parseFloat(percentage);
    const isAboveThreshold = numericPercentage >= threshold;

    const showStaleness = staleness?.isProjected && staleness?.staleCount > 0;

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
                {attended} / {total} classes  ·  Goal {threshold}%
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

            {showStaleness && (
                <TouchableOpacity 
                    style={styles.stalenessBanner} 
                    onPress={onBannerPress}
                    activeOpacity={onBannerPress ? 0.7 : 1}
                >
                    <Text style={styles.stalenessText}>
                        Waiting for portal. Temporary marks are covering {staleness.staleCount} subject{staleness.staleCount !== 1 ? 's' : ''}.
                    </Text>
                    {onBannerPress && (
                        <Text style={styles.stalenessAction}>View math</Text>
                    )}
                </TouchableOpacity>
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
    stalenessBanner: {
        marginTop: SPACING.md,
        width: '100%',
        paddingHorizontal: SPACING.sm,
        paddingVertical: 6,
        backgroundColor: COLORS.warningLight,
        borderRadius: BORDER_RADIUS.sm,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.warning,
    },
    stalenessText: {
        fontWeight: '600',
        fontSize: 11,
        color: COLORS.warningDark,
        textAlign: 'center',
        marginBottom: 2,
    },
    stalenessAction: {
        fontWeight: '700',
        fontSize: 10,
        color: COLORS.warningDark || '#856404',
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
});

export default OverallStatsCard;
