import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../theme/theme';

const OverallStatsCard = ({ stats, threshold, staleness, onBannerPress }) => {
    const styles = getStyles();
    const { attended, total, percentage, dangerCount, safeCount } = stats;
    const numericPercentage = parseFloat(percentage);
    const isAboveThreshold = numericPercentage >= threshold;

    const showStaleness = staleness?.isProjected && staleness?.staleCount > 0;

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Overall standing</Text>

            <Text style={[
                styles.percentage,
                isAboveThreshold ? styles.percentageSafe : styles.percentageDanger,
            ]}>
                {percentage}%
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

            <Text style={styles.marksText}>
                {attended} / {total} classes  ·  Goal {threshold}%
            </Text>

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
        padding: SPACING.lg,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    title: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.textMuted,
        marginBottom: SPACING.sm,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    percentage: {
        fontSize: 26,
        fontWeight: '800',
        marginBottom: SPACING.sm,
        letterSpacing: -0.5,
    },
    percentageSafe: {
        color: COLORS.success,
    },
    percentageDanger: {
        color: COLORS.danger,
    },
    progressBar: {
        width: '100%',
        height: 6,
        backgroundColor: COLORS.inputBackground,
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: SPACING.sm,
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    marksText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
    },
    stalenessBanner: {
        marginTop: SPACING.sm,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 6,
        backgroundColor: COLORS.warningLight,
        borderRadius: BORDER_RADIUS.sm,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.warning,
    },
    stalenessText: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.warningDark,
        textAlign: 'center',
        marginBottom: 2,
    },
    stalenessAction: {
        fontSize: 10,
        fontWeight: '700',
        color: COLORS.warningDark || '#856404',
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
});

export default OverallStatsCard;
