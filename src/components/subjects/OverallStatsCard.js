import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../theme/theme';

const OverallStatsCard = ({ stats, threshold, staleness }) => {
    const styles = getStyles();
    const { attended, total, percentage, dangerCount, safeCount } = stats;
    const numericPercentage = parseFloat(percentage);
    const isAboveThreshold = numericPercentage >= threshold;

    const showStaleness = staleness?.isProjected && staleness?.staleCount > 0;

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Overall Attendance</Text>

            <Text style={[
                styles.percentage,
                isAboveThreshold ? styles.percentageSafe : styles.percentageDanger,
            ]}>
                {percentage}%{staleness?.isProjected ? ' ✨' : ''}
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
                {attended} / {total} marks  •  Goal: {threshold}%
            </Text>

            {showStaleness && (
                <View style={styles.stalenessBanner}>
                    <Text style={styles.stalenessText}>
                        ✨ Projected — ERP is {staleness.maxGapDays} day{staleness.maxGapDays !== 1 ? 's' : ''} behind for {staleness.staleCount} subject{staleness.staleCount !== 1 ? 's' : ''}
                    </Text>
                </View>
            )}
        </View>
    );
};

const getStyles = () => StyleSheet.create({
    container: {
        backgroundColor: COLORS.cardBackground,
        marginHorizontal: SPACING.screenPadding,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.borderLight,
        ...SHADOWS.small,
    },
    title: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginBottom: SPACING.sm,
    },
    percentage: {
        fontSize: 36,
        fontWeight: '700',
        marginBottom: SPACING.sm,
    },
    percentageSafe: {
        color: COLORS.success,
    },
    percentageDanger: {
        color: COLORS.danger,
    },
    progressBar: {
        width: '100%',
        height: 8,
        backgroundColor: COLORS.border,
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: SPACING.sm,
    },
    progressFill: {
        height: '100%',
        borderRadius: 4,
    },
    marksText: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
    },
    stalenessBanner: {
        marginTop: SPACING.sm,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        backgroundColor: COLORS.warningLight || '#fff3cd',
        borderRadius: BORDER_RADIUS.sm,
    },
    stalenessText: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.warning || '#856404',
        textAlign: 'center',
    },
});

export default OverallStatsCard;

