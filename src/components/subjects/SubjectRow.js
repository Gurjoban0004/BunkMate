import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS, FONT_SIZES } from '../../theme/theme';

const SubjectRow = ({ subject, status, threshold, onPress }) => {
    const styles = getStyles();
    const { name, color, percentage, attendedUnits, totalUnits, skipInfo, source } = subject;
    const getStatusColor = () => {
        switch (status) {
            case 'danger': return COLORS.danger;
            case 'edge': return COLORS.warning;
            case 'safe': return COLORS.success;
            default: return COLORS.primary;
        }
    };

    const getActionText = () => {
        if (!skipInfo) return 'Calculating...';

        if (status === 'danger') {
            return `Attend ${skipInfo.count}`;
        }
        if (status === 'edge') {
            return "Can't skip";
        }
        return `Can skip ${skipInfo.count}`;
    };

    const statusColor = getStatusColor();

    // Source badge: show only when ERP is connected (source is set)
    const isErpSynced = source === 'erp';
    const isManual = source === 'manual';
    const showSourceBadge = isErpSynced || isManual;

    return (
        <TouchableOpacity
            style={styles.container}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={[styles.colorDot, { backgroundColor: color }]} />

            <View style={styles.content}>
                <View style={styles.topRow}>
                    <Text style={styles.name} numberOfLines={1}>{name}</Text>
                    <Text style={[styles.percentage, { color: statusColor }]}>
                        {percentage.toFixed(1)}%
                    </Text>
                </View>

                <View style={styles.bottomRow}>
                    <View style={styles.progressContainer}>
                        <View style={styles.progressBar}>
                            <View
                                style={[
                                    styles.progressFill,
                                    {
                                        width: `${Math.min(percentage, 100)}%`,
                                        backgroundColor: statusColor,
                                    },
                                ]}
                            />
                        </View>
                        <Text style={styles.marksText}>
                            {attendedUnits}/{totalUnits}
                        </Text>
                    </View>

                    <View style={[
                        styles.actionBadge,
                        status === 'danger' && styles.actionBadgeDanger,
                        status === 'edge' && styles.actionBadgeEdge,
                        status === 'safe' && styles.actionBadgeSafe,
                    ]}>
                        <Text style={styles.actionText}>
                            {getActionText()}
                        </Text>
                    </View>
                </View>

                {showSourceBadge && (
                    <View style={styles.sourceBadgeRow}>
                        <View style={[
                            styles.sourceBadge,
                            isErpSynced ? styles.sourceBadgeErp : styles.sourceBadgeManual,
                        ]}>
                            <Text style={[
                                styles.sourceBadgeText,
                                isErpSynced ? styles.sourceBadgeTextErp : styles.sourceBadgeTextManual,
                            ]}>
                                {isErpSynced ? 'ERP synced' : 'Manual, pending sync'}
                            </Text>
                        </View>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
};

const getStyles = () => StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: COLORS.cardBackground,
        marginHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.sm,
        padding: SPACING.md,
        paddingLeft: 28,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
        ...SHADOWS.small,
    },
    colorDot: {
        position: 'absolute',
        left: 14,
        top: 14,
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    content: {
        flex: 1,
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    name: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    percentage: {
        fontSize: 16,
        fontWeight: '800',
    },
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: SPACING.sm,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    progressBar: {
        flex: 1,
        height: 8,
        backgroundColor: COLORS.inputBackground,
        borderRadius: 4,
        marginRight: SPACING.sm,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 4,
    },
    marksText: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
        minWidth: 45,
    },
    actionBadge: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.full,
        marginLeft: SPACING.sm,
    },
    actionBadgeDanger: {
        backgroundColor: COLORS.dangerLight,
    },
    actionBadgeEdge: {
        backgroundColor: COLORS.warningLight,
    },
    actionBadgeSafe: {
        backgroundColor: COLORS.successLight,
    },
    actionText: {
        fontSize: 10,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    sourceBadgeRow: {
        marginTop: SPACING.xs,
        flexDirection: 'row',
    },
    sourceBadge: {
        paddingHorizontal: 0,
        paddingVertical: 0,
        borderRadius: 0,
    },
    sourceBadgeErp: {
        backgroundColor: 'transparent',
    },
    sourceBadgeManual: {
        backgroundColor: 'transparent',
    },
    sourceBadgeText: {
        fontSize: 9,
        fontWeight: '600',
    },
    sourceBadgeTextErp: {
        color: COLORS.textMuted,
    },
    sourceBadgeTextManual: {
        color: COLORS.textMuted,
    },
});

export default SubjectRow;
