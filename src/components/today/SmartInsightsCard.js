/**
 * SmartInsightsCard — compact highlight card for TodayScreen.
 *
 * Shows the top 2–3 most actionable smart insights from erpIntelligence.
 * Links to the full InsightsScreen for details.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../theme/theme';

export default function SmartInsightsCard({ insights, onViewAll }) {
    const styles = getStyles();

    if (!insights || insights.length === 0) return null;

    // Show top 2 insights (prioritize danger/warning over success)
    const sorted = [...insights].sort((a, b) => {
        const order = { danger: 0, warning: 1, success: 2 };
        return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
    });
    const topInsights = sorted.slice(0, 2);

    return (
        <View style={styles.card}>
            <View style={styles.headerRow}>
                <Text style={styles.title}>Quick insights</Text>
                {onViewAll && (
                    <TouchableOpacity
                        style={styles.viewAllBtn}
                        onPress={onViewAll}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                        <Text style={styles.viewAllText}>See all →</Text>
                    </TouchableOpacity>
                )}
            </View>
            {topInsights.map((insight, i) => {
                const isDanger = insight.severity === 'danger';
                const isWarning = insight.severity === 'warning';
                const bg = isDanger ? COLORS.dangerLight : isWarning ? COLORS.warningLight : COLORS.successLight;
                const textC = isDanger ? COLORS.dangerDark : isWarning ? COLORS.warningDark : COLORS.successDark;

                return (
                    <View
                        key={i}
                        style={[styles.insightRowNew, { backgroundColor: bg }]}
                    >
                        <View style={[styles.insightDot, { backgroundColor: textC }]} />
                        <View style={styles.insightContent}>
                            <Text style={[styles.insightTextNew, { color: textC }]}>{insight.text}</Text>
                        </View>
                    </View>
                );
            })}
        </View>
    );
}

const getStyles = () => StyleSheet.create({
    card: {
        marginHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.md,
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        ...SHADOWS.small,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    title: {
        fontWeight: '700',
        fontSize: 14,
        color: COLORS.textPrimary,
    },
    viewAllBtn: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: 3,
        backgroundColor: COLORS.primaryLight,
        borderRadius: BORDER_RADIUS.full,
    },
    viewAllText: {
        fontWeight: '600',
        fontSize: 11,
        color: COLORS.primary,
    },
    insightRowNew: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        marginBottom: SPACING.sm,
        gap: SPACING.sm,
    },
    insightDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginTop: 6,
    },
    insightContent: {
        flex: 1,
    },
    insightTextNew: {
        fontWeight: '600',
        fontSize: 13,
        lineHeight: 18,
    },
});
