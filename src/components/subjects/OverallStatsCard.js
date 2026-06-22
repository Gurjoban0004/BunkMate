import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../theme/theme';

const OverallStatsCard = ({ stats, threshold, staleness, onBannerPress }) => {
    const styles = getStyles();
    const { attended, total, percentage, dangerCount, edgeCount, safeCount } = stats;
    const numericPercentage = parseFloat(percentage);
    const isAboveThreshold = numericPercentage >= threshold;

    const showStaleness = staleness?.isProjected && staleness?.staleCount > 0;

    return (
        <View style={styles.container}>
            <View style={styles.row}>
                {/* Left Column: Average Attendance */}
                <View style={styles.leftCol}>
                    <Text style={styles.columnTitle}>Avg. Attendance</Text>
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
                        {attended} / {total} classes
                    </Text>
                    <Text style={styles.goalText}>
                        Goal: {threshold}%
                    </Text>
                </View>

                {/* Vertical Divider */}
                <View style={styles.divider} />

                {/* Right Column: Subject Health */}
                <View style={styles.rightCol}>
                    <Text style={styles.columnTitle}>Subject Health</Text>

                    <View style={styles.healthRow}>
                        <View style={[styles.healthDot, { backgroundColor: COLORS.danger }]} />
                        <Text style={styles.healthLabel}>
                            {dangerCount} Below Goal
                        </Text>
                    </View>

                    <View style={styles.healthRow}>
                        <View style={[styles.healthDot, { backgroundColor: COLORS.warning }]} />
                        <Text style={styles.healthLabel}>
                            {edgeCount} On Edge
                        </Text>
                    </View>

                    <View style={styles.healthRow}>
                        <View style={[styles.healthDot, { backgroundColor: COLORS.success }]} />
                        <Text style={styles.healthLabel}>
                            {safeCount} Safe
                        </Text>
                    </View>
                </View>
            </View>

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
        padding: SPACING.md,
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
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    leftCol: {
        flex: 1.2,
        paddingRight: SPACING.sm,
    },
    rightCol: {
        flex: 1,
        paddingLeft: SPACING.md,
        justifyContent: 'center',
    },
    divider: {
        width: 1,
        height: 70,
        backgroundColor: COLORS.border,
    },
    columnTitle: {
        fontSize: 10,
        fontWeight: '700',
        color: COLORS.textMuted,
        marginBottom: SPACING.xs,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    percentage: {
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: -0.5,
        marginVertical: 2,
    },
    percentageSafe: {
        color: COLORS.success,
    },
    percentageDanger: {
        color: COLORS.danger,
    },
    progressBar: {
        width: '100%',
        height: 4,
        backgroundColor: COLORS.inputBackground,
        borderRadius: 2,
        overflow: 'hidden',
        marginVertical: SPACING.xs,
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    marksText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textPrimary,
        fontWeight: '600',
    },
    goalText: {
        fontSize: 10,
        color: COLORS.textSecondary,
        fontWeight: '500',
        marginTop: 1,
    },
    healthRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 4,
        gap: SPACING.xs,
    },
    healthDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    healthLabel: {
        fontSize: 12,
        color: COLORS.textSecondary,
        fontWeight: '600',
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
