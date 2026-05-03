/**
 * ErpWelcomeCard — shown once after the first successful ERP calendar sync.
 *
 * Displays a personalized summary of what the app imported:
 *   "We imported 388 records across 6 subjects.
 *    Strongest: Networks at 93%. Needs attention: DBMS at 68%."
 *
 * Dismissed by the user (stored in settings.erpWelcomeCardDismissed).
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../theme/theme';
import { getSubjectAttendance } from '../../utils/attendance';

export default function ErpWelcomeCard({ state, onDismiss }) {
    const styles = getStyles();

    const insights = useMemo(() => {
        if (!state.subjects || state.subjects.length === 0) return null;
        if (!state.attendanceRecords || Object.keys(state.attendanceRecords).length === 0) return null;

        // Count total ERP records
        let totalRecords = 0;
        Object.values(state.attendanceRecords).forEach(dayData => {
            Object.values(dayData).forEach(rec => {
                if (rec && rec.source === 'erp') totalRecords++;
            });
        });

        if (totalRecords === 0) return null;

        // Compute per-subject stats
        const subjectStats = state.subjects.map(sub => {
            const stats = getSubjectAttendance(sub.id, state);
            return { name: sub.name, color: sub.color, percentage: stats?.percentage || 0, total: stats?.totalUnits || 0 };
        }).filter(s => s.total > 0);

        if (subjectStats.length === 0) return null;

        const sorted = [...subjectStats].sort((a, b) => b.percentage - a.percentage);
        const strongest = sorted[0];
        const weakest = sorted[sorted.length - 1];
        const atRisk = subjectStats.filter(s => s.percentage < (state.settings?.dangerThreshold || 75));

        // Date range
        const dates = Object.keys(state.attendanceRecords).filter(k => k !== '_holiday').sort();
        const earliest = dates[0];
        const latest = dates[dates.length - 1];

        return {
            subjectCount: state.subjects.length,
            totalRecords,
            strongest,
            weakest: weakest !== strongest ? weakest : null,
            atRisk,
            earliest,
            latest,
        };
    }, [state.subjects, state.attendanceRecords, state.settings?.dangerThreshold]);

    // Don't render if not applicable
    if (!insights) return null;
    if (!state.settings?.erpConnected) return null;
    if (state.settings?.erpWelcomeCardDismissed) return null;

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr + 'T12:00:00');
        return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    };

    return (
        <View style={styles.card}>
            {/* Header row */}
            <View style={styles.headerRow}>
                <View>
                    <Text style={styles.title}>Portal Synced</Text>
                    <Text style={styles.subtitle}>
                        {formatDate(insights.earliest)} — {formatDate(insights.latest)}
                    </Text>
                </View>
                <TouchableOpacity
                    style={styles.dismissBtn}
                    onPress={onDismiss}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                    <Text style={styles.dismissText}>Done</Text>
                </TouchableOpacity>
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
                <View style={styles.statBox}>
                    <Text style={styles.statNum}>{insights.totalRecords}</Text>
                    <Text style={styles.statLabel}>Records</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                    <Text style={styles.statNum}>{insights.subjectCount}</Text>
                    <Text style={styles.statLabel}>Subjects</Text>
                </View>
                {insights.atRisk.length > 0 && (
                    <>
                        <View style={styles.statDivider} />
                        <View style={styles.statBox}>
                            <Text style={[styles.statNum, { color: COLORS.danger }]}>{insights.atRisk.length}</Text>
                            <Text style={styles.statLabel}>At risk</Text>
                        </View>
                    </>
                )}
            </View>

            {/* Insight rows */}
            <View style={styles.insightsSection}>
                {insights.strongest && (
                    <View style={styles.insightRow}>
                        <View style={[styles.insightDot, { backgroundColor: insights.strongest.color }]} />
                        <Text style={styles.insightText}>
                            <Text style={styles.insightLabel}>Strongest  </Text>
                            {insights.strongest.name} — {insights.strongest.percentage.toFixed(1)}%
                        </Text>
                    </View>
                )}
                {insights.weakest && (
                    <View style={styles.insightRow}>
                        <View style={[styles.insightDot, {
                            backgroundColor: insights.weakest.percentage < (state.settings?.dangerThreshold || 75)
                                ? COLORS.danger : insights.weakest.color
                        }]} />
                        <Text style={[styles.insightText, insights.weakest.percentage < (state.settings?.dangerThreshold || 75) && { color: COLORS.danger }]}>
                            <Text style={styles.insightLabel}>Needs attention  </Text>
                            {insights.weakest.name} — {insights.weakest.percentage.toFixed(1)}%
                        </Text>
                    </View>
                )}
            </View>

            <Text style={styles.footnote}>
                Your calendar and insights are now populated from the portal.
            </Text>
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
        borderWidth: 1,
        borderColor: COLORS.primary + '30',
        borderLeftWidth: 3,
        borderLeftColor: COLORS.primary,
        ...SHADOWS.small,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: SPACING.md,
    },
    title: {
        ...TYPOGRAPHY.headerSmall,
        color: COLORS.primary,
        fontWeight: '700',
    },
    subtitle: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        marginTop: 2,
    },
    dismissBtn: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.full,
    },
    dismissText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.md,
        backgroundColor: COLORS.background,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
    },
    statBox: {
        flex: 1,
        alignItems: 'center',
    },
    statNum: {
        fontSize: 22,
        fontWeight: '800',
        color: COLORS.textPrimary,
        letterSpacing: -0.5,
    },
    statLabel: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        marginTop: 2,
    },
    statDivider: {
        width: 1,
        height: 32,
        backgroundColor: COLORS.border,
    },
    insightsSection: {
        gap: SPACING.xs,
        marginBottom: SPACING.sm,
    },
    insightRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    insightDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        flexShrink: 0,
    },
    insightText: {
        fontSize: 13,
        color: COLORS.textSecondary,
        flex: 1,
    },
    insightLabel: {
        color: COLORS.textMuted,
        fontWeight: '600',
    },
    footnote: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        marginTop: SPACING.sm,
        fontStyle: 'italic',
    },
});
