import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../theme/theme';

/**
 * BestBunkDayCard — Shows which day of the week has the least
 * attendance impact if skipped entirely.
 *
 * Props:
 *   bunkData: output of calculateBestBunkDay()
 */
const BestBunkDayCard = ({ bunkData }) => {
    const styles = getStyles();

    if (!bunkData || !bunkData.bestDay) return null;

    const { bestDay, bestDayDrop, bestDayNewPct, currentOverall, threshold, days } = bunkData;
    const isSafe = bestDayNewPct >= threshold;

    // Find how many classes are on the best day
    const bestDayInfo = days.find(d => d.day === bestDay);
    const classCount = bestDayInfo?.subjects?.length || 0;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerIcon}>💡</Text>
                <Text style={styles.headerTitle}>Best Day to Skip</Text>
            </View>

            {/* Main insight */}
            <View style={styles.insightRow}>
                <View style={styles.dayBadge}>
                    <Text style={styles.dayBadgeText}>{bestDay}</Text>
                </View>
                <View style={styles.impactInfo}>
                    <Text style={styles.impactValue}>
                        {bestDayDrop > 0 ? '+' : ''}{bestDayDrop}%
                    </Text>
                    <Text style={styles.impactLabel}>impact on overall</Text>
                </View>
            </View>

            {/* Detail */}
            <Text style={styles.detail}>
                {classCount} class{classCount !== 1 ? 'es' : ''} · You'd drop to{' '}
                <Text style={{ color: isSafe ? COLORS.success : COLORS.danger, fontWeight: '700' }}>
                    {bestDayNewPct}%
                </Text>
                {isSafe ? ' (still safe ✅)' : ' (risky ⚠️)'}
            </Text>

            {/* Mini week bar */}
            <View style={styles.weekBar}>
                {days.filter(d => d.totalUnits > 0).map(d => {
                    const isBest = d.day === bestDay;
                    const barSafe = d.newPercentage >= threshold;
                    return (
                        <View key={d.day} style={styles.weekDayCol}>
                            <View style={[
                                styles.weekDayBar,
                                { height: Math.max(4, Math.abs(d.drop) * 12) },
                                isBest && styles.weekDayBarBest,
                                !barSafe && styles.weekDayBarDanger,
                            ]} />
                            <Text style={[
                                styles.weekDayLabel,
                                isBest && styles.weekDayLabelBest,
                            ]}>
                                {d.day.slice(0, 3)}
                            </Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
};

const getStyles = () => StyleSheet.create({
    container: {
        backgroundColor: COLORS.cardBackground,
        marginHorizontal: SPACING.screenPadding,
        marginTop: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
        ...SHADOWS.small,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    headerIcon: {
        fontSize: 16,
        marginRight: SPACING.xs,
    },
    headerTitle: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '700',
        color: COLORS.textPrimary,
        letterSpacing: 0.3,
    },
    insightRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    dayBadge: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: BORDER_RADIUS.md,
        marginRight: SPACING.md,
    },
    dayBadgeText: {
        fontSize: FONT_SIZES.md,
        fontWeight: '800',
        color: COLORS.textOnPrimary,
    },
    impactInfo: {
        flex: 1,
    },
    impactValue: {
        fontSize: 22,
        fontWeight: '800',
        color: COLORS.textPrimary,
    },
    impactLabel: {
        fontSize: 11,
        color: COLORS.textSecondary,
        marginTop: 1,
    },
    detail: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
        lineHeight: 18,
        marginBottom: SPACING.md,
    },
    weekBar: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'flex-end',
        paddingTop: SPACING.xs,
        borderTopWidth: 1,
        borderTopColor: COLORS.borderLight,
    },
    weekDayCol: {
        alignItems: 'center',
        flex: 1,
    },
    weekDayBar: {
        width: 16,
        backgroundColor: COLORS.border,
        borderRadius: 3,
        marginBottom: 4,
    },
    weekDayBarBest: {
        backgroundColor: COLORS.primary,
    },
    weekDayBarDanger: {
        backgroundColor: COLORS.dangerLight,
    },
    weekDayLabel: {
        fontSize: 10,
        color: COLORS.textMuted,
        fontWeight: '500',
    },
    weekDayLabelBest: {
        color: COLORS.primary,
        fontWeight: '700',
    },
});

export default BestBunkDayCard;
