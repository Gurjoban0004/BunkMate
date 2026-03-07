import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS, FONT_SIZES } from '../../theme/theme';

const SubjectRow = ({ subject, status, threshold, onPress }) => {
    const styles = getStyles();
    const { name, color, percentage, attendedUnits, totalUnits, bunkInfo } = subject;

    const getStatusColor = () => {
        switch (status) {
            case 'danger': return COLORS.danger;
            case 'edge': return COLORS.warning;
            case 'safe': return COLORS.success;
            default: return COLORS.primary;
        }
    };

    const getActionText = () => {
        if (status === 'danger') {
            return `Attend ${bunkInfo.count}`;
        }
        if (status === 'edge') {
            return "Can't bunk";
        }
        return `Can bunk ${bunkInfo.count}`;
    };

    const statusColor = getStatusColor();

    return (
        <TouchableOpacity
            style={styles.container}
            onPress={onPress}
            activeOpacity={0.7}
        >
            {/* Color Indicator */}
            <View style={[styles.colorDot, { backgroundColor: color }]} />

            {/* Content */}
            <View style={styles.content}>
                <View style={styles.topRow}>
                    <Text style={styles.name}>{name}</Text>
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
                            → {getActionText()}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Chevron */}
            <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
    );
};

const getStyles = () => StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.cardBackground,
        marginHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.cardGap,
        padding: SPACING.cardPadding,
        borderRadius: BORDER_RADIUS.xl,
        ...SHADOWS.medium,
    },
    colorDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: SPACING.md,
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
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    percentage: {
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
    },
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: SPACING.xs,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    progressBar: {
        flex: 1,
        height: 6,
        backgroundColor: COLORS.border,
        borderRadius: 3,
        marginRight: SPACING.sm,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    marksText: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
        minWidth: 45,
    },
    actionBadge: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: 2,
        borderRadius: 8,
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
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    chevron: {
        fontSize: 24,
        color: COLORS.textMuted,
        marginLeft: SPACING.sm,
    },
});

export default SubjectRow;
