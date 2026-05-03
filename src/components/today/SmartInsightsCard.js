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

    const severityIcon = (severity) => {
        switch (severity) {
            case 'danger':  return '⚠️';
            case 'warning': return '📉';
            case 'success': return '✅';
            default:        return '💡';
        }
    };

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
            {topInsights.map((insight, i) => (
                <View
                    key={i}
                    style={[styles.insightRow, {
                        borderLeftColor: insight.severity === 'danger' ? COLORS.danger
                            : insight.severity === 'warning' ? COLORS.warning
                            : COLORS.success,
                    }]}
                >
                    <Text style={styles.insightText}>{insight.text}</Text>
                </View>
            ))}
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
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    viewAllBtn: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: 3,
        backgroundColor: COLORS.primaryLight,
        borderRadius: BORDER_RADIUS.full,
    },
    viewAllText: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.primary,
    },
    insightRow: {
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.sm,
        padding: SPACING.sm,
        marginBottom: SPACING.xs,
        borderLeftWidth: 3,
    },
    insightText: {
        fontSize: 13,
        color: COLORS.textSecondary,
        lineHeight: 18,
    },
});
