import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../theme/theme';

const OverallStatsCard = ({ stats, threshold }) => {
    const { attended, total, percentage, dangerCount, safeCount } = stats;
    const numericPercentage = parseFloat(percentage);
    const isAboveThreshold = numericPercentage >= threshold;

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Overall Attendance</Text>

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
                {attended} / {total} marks  •  Goal: {threshold}%
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: COLORS.cardBackground,
        marginHorizontal: SPACING.lg,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.medium,
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
        height: 6,
        backgroundColor: COLORS.progressBackground,
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: SPACING.sm,
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    marksText: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
    },
});

export default OverallStatsCard;
