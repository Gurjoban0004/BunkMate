/**
 * InsightsScreen — Full ERP intelligence dashboard.
 *
 * Surfaces all analytics from deriveErpIntelligence:
 *   - Weekday attendance patterns (bar chart-like view)
 *   - Subject trends (improving / declining / stable)
 *   - Recent rhythm (last 10 classes streak)
 *   - Smart insights (AI-like human-readable sentences)
 *   - Semester summary (totals, date range)
 *
 * This is the full detail screen — TodayScreen shows highlights.
 */

import React, { useMemo } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS, TYPOGRAPHY } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import { deriveErpIntelligence } from '../../utils/erpIntelligence';
import { getSubjectAttendance } from '../../utils/attendance';
import {
    DisplayMedium,
    HeadingMedium,
    HeadingSmall,
    BodyMedium,
    BodySmall,
} from '../../components/common/Typography';

export default function InsightsScreen() {
    const styles = getStyles();
    const { state } = useApp();

    const intel = useMemo(() => deriveErpIntelligence(state), [
        state.subjects, state.attendanceRecords, state.holidays, state.settings?.dangerThreshold,
    ]);

    // Subject stats for the grid
    const subjectStats = useMemo(() => {
        return (state.subjects || []).map(sub => {
            const stats = getSubjectAttendance(sub.id, state);
            return {
                id: sub.id,
                name: sub.name,
                color: sub.color,
                percentage: stats?.percentage || 0,
                attended: stats?.attendedUnits || 0,
                total: stats?.totalUnits || 0,
            };
        }).filter(s => s.total > 0).sort((a, b) => a.percentage - b.percentage);
    }, [state.subjects, state.attendanceRecords]);

    const threshold = state.settings?.dangerThreshold || 75;

    if (!intel.hasData) {
        return (
            <SafeAreaView style={styles.container}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <DisplayMedium style={styles.title}>Insights</DisplayMedium>
                    <View style={styles.emptyCard}>
                        <Text style={styles.emptyTitle}>No insights yet</Text>
                        <Text style={styles.emptyText}>
                            Insights appear after your first portal sync.{'\n'}
                            Pull to refresh on the Today screen to sync.
                        </Text>
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }

    const { weekdayPatterns, subjectTrends, recentRhythm, semesterSummary, smartInsights } = intel;

    // Find max weekday total for bar scaling
    const maxDayTotal = Math.max(
        ...Object.values(weekdayPatterns.byDay).map(d => d.total),
        1
    );

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        const d = new Date(dateStr + 'T12:00:00');
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <DisplayMedium style={styles.title}>Insights</DisplayMedium>
                <BodySmall color="textMuted" style={styles.subtitle}>
                    {formatDate(semesterSummary.earliestDate)} — {formatDate(semesterSummary.latestDate)} · {semesterSummary.totalDays} days tracked
                </BodySmall>

                {/* ── Smart Insights ──────────────────────────────── */}
                {smartInsights.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>What we found</Text>
                        {smartInsights.map((insight, i) => (
                            <View
                                key={i}
                                style={[styles.insightCard, {
                                    borderLeftColor: insight.severity === 'danger' ? COLORS.danger
                                        : insight.severity === 'warning' ? COLORS.warning
                                        : COLORS.success,
                                }]}
                            >
                                <Text style={styles.insightText}>{insight.text}</Text>
                                <Text style={styles.insightType}>{insight.type}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* ── Semester Summary ────────────────────────────── */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Semester at a glance</Text>
                    <View style={styles.summaryGrid}>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryValue}>{semesterSummary.totalClasses}</Text>
                            <Text style={styles.summaryLabel}>Total classes</Text>
                        </View>
                        <View style={styles.summaryDivider} />
                        <View style={styles.summaryItem}>
                            <Text style={[styles.summaryValue, { color: COLORS.success }]}>
                                {semesterSummary.totalPresent}
                            </Text>
                            <Text style={styles.summaryLabel}>Present</Text>
                        </View>
                        <View style={styles.summaryDivider} />
                        <View style={styles.summaryItem}>
                            <Text style={[styles.summaryValue, { color: COLORS.danger }]}>
                                {semesterSummary.totalAbsent}
                            </Text>
                            <Text style={styles.summaryLabel}>Absent</Text>
                        </View>
                        <View style={styles.summaryDivider} />
                        <View style={styles.summaryItem}>
                            <Text style={[styles.summaryValue, {
                                color: semesterSummary.overallPercentage >= threshold ? COLORS.success : COLORS.danger,
                            }]}>
                                {semesterSummary.overallPercentage}%
                            </Text>
                            <Text style={styles.summaryLabel}>Overall</Text>
                        </View>
                    </View>
                </View>

                {/* ── Weekday Patterns ────────────────────────────── */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Weekday patterns</Text>
                    <Text style={styles.sectionSubtitle}>
                        {weekdayPatterns.worstDayName
                            ? `${weekdayPatterns.worstDayName} is your weakest day`
                            : 'Consistent across all days'}
                    </Text>
                    <View style={styles.barsContainer}>
                        {[1, 2, 3, 4, 5, 6].map(dayIdx => {
                            const data = weekdayPatterns.byDay[dayIdx];
                            if (!data || data.total === 0) return null;
                            const barHeight = Math.max(8, (data.total / maxDayTotal) * 100);
                            const presentRatio = data.present / data.total;
                            const isWorst = dayIdx === weekdayPatterns.worstDayIndex;
                            const barColor = data.percentage < 70 ? COLORS.danger
                                : data.percentage < threshold ? COLORS.warning
                                : COLORS.success;
                            return (
                                <View key={dayIdx} style={styles.barCol}>
                                    <Text style={[styles.barPct, isWorst && { color: COLORS.danger, fontWeight: '700' }]}>
                                        {data.percentage?.toFixed(0)}%
                                    </Text>
                                    <View style={[styles.barTrack, { height: barHeight }]}>
                                        <View style={[styles.barFill, {
                                            height: `${presentRatio * 100}%`,
                                            backgroundColor: barColor,
                                        }]} />
                                    </View>
                                    <Text style={[styles.barLabel, isWorst && { color: COLORS.danger, fontWeight: '700' }]}>
                                        {data.name?.slice(0, 3)}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                </View>

                {/* ── Subject Trends ──────────────────────────────── */}
                {Object.keys(subjectTrends).length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Subject trends</Text>
                        <Text style={styles.sectionSubtitle}>First half vs second half of semester</Text>
                        {Object.values(subjectTrends)
                            .filter(t => t.direction !== 'stable' || Math.abs(t.delta) > 2)
                            .sort((a, b) => a.delta - b.delta)
                            .map((trend, i) => {
                                const sub = state.subjects.find(s => s.id === trend.subjectId);
                                const arrow = trend.direction === 'improving' ? '↑' : trend.direction === 'declining' ? '↓' : '→';
                                const color = trend.direction === 'improving' ? COLORS.success
                                    : trend.direction === 'declining' ? COLORS.danger
                                    : COLORS.textMuted;
                                return (
                                    <View key={i} style={styles.trendRow}>
                                        <View style={[styles.trendDot, { backgroundColor: sub?.color || COLORS.primary }]} />
                                        <Text style={styles.trendName} numberOfLines={1}>{trend.name}</Text>
                                        <Text style={[styles.trendArrow, { color }]}>{arrow}</Text>
                                        <Text style={[styles.trendDelta, { color }]}>
                                            {trend.delta > 0 ? '+' : ''}{trend.delta.toFixed(0)}%
                                        </Text>
                                        <Text style={styles.trendRange}>
                                            {trend.firstHalfPct.toFixed(0)}% → {trend.secondHalfPct.toFixed(0)}%
                                        </Text>
                                    </View>
                                );
                            })}
                    </View>
                )}

                {/* ── Recent Rhythm ───────────────────────────────── */}
                {recentRhythm.total >= 5 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Recent rhythm</Text>
                        <Text style={styles.sectionSubtitle}>
                            Last {recentRhythm.total} classes: {recentRhythm.presentCount} present, {recentRhythm.absentCount} absent
                        </Text>
                        <View style={styles.rhythmRow}>
                            {recentRhythm.events.slice(-15).map((ev, i) => (
                                <View
                                    key={i}
                                    style={[styles.rhythmDot, {
                                        backgroundColor: ev.status === 'present' ? COLORS.success
                                            : ev.status === 'absent' ? COLORS.danger
                                            : COLORS.textMuted,
                                    }]}
                                />
                            ))}
                        </View>
                        <View style={styles.rhythmLegend}>
                            <View style={styles.rhythmLegendItem}>
                                <View style={[styles.rhythmLegendDot, { backgroundColor: COLORS.success }]} />
                                <Text style={styles.rhythmLegendText}>Present</Text>
                            </View>
                            <View style={styles.rhythmLegendItem}>
                                <View style={[styles.rhythmLegendDot, { backgroundColor: COLORS.danger }]} />
                                <Text style={styles.rhythmLegendText}>Absent</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* ── Subject Breakdown ───────────────────────────── */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Subject breakdown</Text>
                    {subjectStats.map((sub) => {
                        const fillWidth = `${Math.min(sub.percentage, 100)}%`;
                        const isAtRisk = sub.percentage < threshold;
                        return (
                            <View key={sub.id} style={styles.subjectRow}>
                                <View style={styles.subjectInfo}>
                                    <View style={[styles.subjectDot, { backgroundColor: sub.color }]} />
                                    <Text style={styles.subjectName} numberOfLines={1}>{sub.name}</Text>
                                    <Text style={[styles.subjectPct, isAtRisk && { color: COLORS.danger }]}>
                                        {sub.percentage.toFixed(1)}%
                                    </Text>
                                </View>
                                <View style={styles.subjectBarTrack}>
                                    <View style={[styles.subjectBarFill, {
                                        width: fillWidth,
                                        backgroundColor: isAtRisk ? COLORS.danger : sub.color,
                                    }]} />
                                    {/* Threshold line */}
                                    <View style={[styles.thresholdLine, { left: `${threshold}%` }]} />
                                </View>
                                <Text style={styles.subjectMeta}>
                                    {sub.attended}/{sub.total} classes
                                </Text>
                            </View>
                        );
                    })}
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const getStyles = () => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        paddingTop: SPACING.lg,
        paddingBottom: SPACING.xl,
    },
    title: {
        paddingHorizontal: SPACING.screenPadding,
        fontSize: FONT_SIZES.xl,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    subtitle: {
        paddingHorizontal: SPACING.screenPadding,
        marginTop: 4,
        marginBottom: SPACING.md,
    },
    // Sections
    section: {
        marginHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.lg,
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        ...SHADOWS.small,
    },
    sectionTitle: {
        ...TYPOGRAPHY.headerSmall,
        color: COLORS.textPrimary,
        marginBottom: 4,
    },
    sectionSubtitle: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        marginBottom: SPACING.md,
    },
    // Smart Insights
    insightCard: {
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
        borderLeftWidth: 3,
    },
    insightText: {
        fontSize: 14,
        color: COLORS.textPrimary,
        lineHeight: 20,
    },
    insightType: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        marginTop: 4,
        textTransform: 'capitalize',
    },
    // Semester Summary
    summaryGrid: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
    },
    summaryItem: {
        flex: 1,
        alignItems: 'center',
    },
    summaryValue: {
        fontSize: 22,
        fontWeight: '800',
        color: COLORS.textPrimary,
        letterSpacing: -0.5,
    },
    summaryLabel: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        marginTop: 2,
    },
    summaryDivider: {
        width: 1,
        height: 32,
        backgroundColor: COLORS.border,
    },
    // Weekday Bars
    barsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'flex-end',
        height: 140,
        paddingTop: SPACING.md,
    },
    barCol: {
        alignItems: 'center',
        flex: 1,
    },
    barPct: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.textMuted,
        marginBottom: 4,
    },
    barTrack: {
        width: 24,
        borderRadius: 12,
        backgroundColor: COLORS.inputBackground,
        overflow: 'hidden',
        justifyContent: 'flex-end',
    },
    barFill: {
        width: '100%',
        borderRadius: 12,
    },
    barLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginTop: 6,
    },
    // Subject Trends
    trendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderSubtle,
        gap: SPACING.sm,
    },
    trendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    trendName: {
        flex: 1,
        fontSize: 14,
        color: COLORS.textPrimary,
        fontWeight: '500',
    },
    trendArrow: {
        fontSize: 16,
        fontWeight: '700',
    },
    trendDelta: {
        fontSize: 13,
        fontWeight: '700',
        width: 44,
        textAlign: 'right',
    },
    trendRange: {
        fontSize: 11,
        color: COLORS.textMuted,
        width: 72,
        textAlign: 'right',
    },
    // Recent Rhythm
    rhythmRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: SPACING.sm,
    },
    rhythmDot: {
        width: 14,
        height: 14,
        borderRadius: 3,
    },
    rhythmLegend: {
        flexDirection: 'row',
        gap: SPACING.md,
    },
    rhythmLegendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    rhythmLegendDot: {
        width: 8,
        height: 8,
        borderRadius: 2,
    },
    rhythmLegendText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
    },
    // Subject Breakdown
    subjectRow: {
        marginBottom: SPACING.md,
    },
    subjectInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
        gap: SPACING.sm,
    },
    subjectDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    subjectName: {
        flex: 1,
        fontSize: 14,
        color: COLORS.textPrimary,
        fontWeight: '500',
    },
    subjectPct: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    subjectBarTrack: {
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.inputBackground,
        overflow: 'hidden',
        position: 'relative',
    },
    subjectBarFill: {
        height: '100%',
        borderRadius: 4,
    },
    thresholdLine: {
        position: 'absolute',
        top: -1,
        width: 1.5,
        height: 10,
        backgroundColor: COLORS.textMuted,
        opacity: 0.5,
    },
    subjectMeta: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        marginTop: 4,
    },
    // Empty state
    emptyCard: {
        margin: SPACING.screenPadding,
        padding: SPACING.xl,
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        alignItems: 'center',
        ...SHADOWS.small,
    },
    emptyTitle: {
        ...TYPOGRAPHY.headerSmall,
        color: COLORS.textPrimary,
        marginBottom: SPACING.sm,
    },
    emptyText: {
        ...TYPOGRAPHY.body,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },
});
