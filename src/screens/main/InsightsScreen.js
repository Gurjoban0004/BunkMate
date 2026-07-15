/**
 * InsightsScreen — ERP intelligence dashboard + End Game calculator.
 * Two tabs: Insights | End Game
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS, TYPOGRAPHY } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import { deriveErpIntelligence } from '../../utils/erpIntelligence';
import { getSubjectAttendance, calculatePercentage } from '../../utils/attendance';
import { getEndGameStats, findLongWeekends } from '../../utils/planner.js';
import { DisplayMedium, BodySmall } from '../../components/common/Typography';

import { getRiskLevel, getRiskColor, getRiskLabel, getSkipStrategy, OVERALL_MESSAGES, getWeeklyBurnPlan } from '../../utils/endgame';
import { estimateWeeksRemaining } from '../../utils/planner/semesterWindow';

// Semester-scale horizons (a term runs months, not a couple of weeks).
const WEEK_OPTIONS = [8, 12, 16, 20];

// ─── Component ───────────────────────────────────────────────────────

export default function InsightsScreen() {
    const styles = getStyles();
    const { state } = useApp();
    const [activeTab, setActiveTab] = useState('insights');
    // Default to a realistic estimate of the weeks left in the term, not a fixed guess.
    const [weeksLeft, setWeeksLeft] = useState(() => estimateWeeksRemaining(state));
    const [expandedSubject, setExpandedSubject] = useState(null);

    const threshold = state.settings?.dangerThreshold || 75;
    const hasEndDate = !!state.settings?.semesterEndDate;

    const intel = useMemo(() => deriveErpIntelligence(state), [
        state.subjects, state.attendanceRecords, state.holidays, state.settings?.dangerThreshold,
    ]);

    const subjectStats = useMemo(() => (state.subjects || [])
        .map(sub => {
            const stats = getSubjectAttendance(sub.id, state);
            return { id: sub.id, name: sub.name, color: sub.color, percentage: stats?.percentage || 0, attended: stats?.attendedUnits || 0, total: stats?.totalUnits || 0 };
        })
        .filter(s => s.total > 0)
        .sort((a, b) => a.percentage - b.percentage),
    [state.subjects, state.attendanceRecords]);

    const endGameStats = useMemo(() => getEndGameStats(state, threshold, weeksLeft), [state, threshold, weeksLeft, state.settings?.semesterEndDate]);
    const longWeekends = useMemo(() => findLongWeekends(state, threshold), [state, threshold]);

    const sortedResults = useMemo(() => {
        const order = { impossible: 0, critical: 1, tight: 2, moderate: 3, comfortable: 4 };
        return [...endGameStats.results].sort((a, b) =>
            (order[getRiskLevel(a.canSkip, a.mustAttend, a.remainingUnits)] ?? 5) -
            (order[getRiskLevel(b.canSkip, b.mustAttend, b.remainingUnits)] ?? 5)
        );
    }, [endGameStats.results]);

    const overallRisk = useMemo(() => {
        if (sortedResults.some(s => getRiskLevel(s.canSkip, s.mustAttend, s.remainingUnits) === 'impossible')) return 'impossible';
        if (sortedResults.some(s => getRiskLevel(s.canSkip, s.mustAttend, s.remainingUnits) === 'critical')) return 'critical';
        if (sortedResults.some(s => getRiskLevel(s.canSkip, s.mustAttend, s.remainingUnits) === 'tight')) return 'tight';
        if (sortedResults.every(s => getRiskLevel(s.canSkip, s.mustAttend, s.remainingUnits) === 'comfortable')) return 'comfortable';
        return 'moderate';
    }, [sortedResults]);

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        const d = new Date(dateStr + 'T12:00:00');
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const { weekdayPatterns, subjectTrends, semesterSummary, smartInsights } = intel;
    const maxDayTotal = Math.max(...Object.values(weekdayPatterns?.byDay || {}).map(d => d.total), 1);

    return (
        <SafeAreaView style={styles.container}>
            {/* Tab bar — commented out to consolidate screens into a single view */}
            {/*
            <View style={styles.tabBar}>
                <TouchableOpacity style={[styles.tab, activeTab === 'insights' && styles.tabActive]} onPress={() => setActiveTab('insights')}>
                    <Text style={[styles.tabText, activeTab === 'insights' && styles.tabTextActive]}>Insights</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, activeTab === 'endgame' && styles.tabActive]} onPress={() => setActiveTab('endgame')}>
                    <Text style={[styles.tabText, activeTab === 'endgame' && styles.tabTextActive]}>End Game</Text>
                </TouchableOpacity>
            </View>
            */}

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <DisplayMedium style={styles.title}>Insights</DisplayMedium>
                {intel.hasData && (
                    <BodySmall color="textMuted" style={styles.subtitle}>
                        {formatDate(semesterSummary.earliestDate)} — {formatDate(semesterSummary.latestDate)} · {semesterSummary.totalDays} days tracked
                    </BodySmall>
                )}

                {!intel.hasData ? (
                    <View style={styles.emptyCard}>
                        <Text style={styles.emptyTitle}>No insights yet</Text>
                        <Text style={styles.emptyText}>Insights appear after your first portal sync.{'\n'}Pull to refresh on the Today screen to sync.</Text>
                    </View>
                ) : (
                    <>
                        {/* 1. Overall verdict (Semester Outlook) */}
                        <View style={styles.verdictCard}>
                            <Text style={styles.verdictLabel}>Semester Outlook</Text>
                            <Text style={[styles.verdictText, { color: getRiskColor(overallRisk) }]}>{OVERALL_MESSAGES[overallRisk]}</Text>
                            
                            <View style={styles.statsDivider} />

                            <View style={styles.verdictStats}>
                                <View style={styles.verdictStat}>
                                    <Text style={styles.verdictStatNum}>{endGameStats.totalRemaining}</Text>
                                    <Text style={styles.verdictStatLabel}>classes left</Text>
                                </View>
                                <View style={styles.verdictDivider} />
                                <View style={styles.verdictStat}>
                                    <Text style={[styles.verdictStatNum, { color: COLORS.danger }]}>{endGameStats.totalMustAttend}</Text>
                                    <Text style={styles.verdictStatLabel}>must attend</Text>
                                </View>
                                <View style={styles.verdictDivider} />
                                <View style={styles.verdictStat}>
                                    <Text style={[styles.verdictStatNum, { color: COLORS.success }]}>{endGameStats.totalCanSkip}</Text>
                                    <Text style={styles.verdictStatLabel}>can skip</Text>
                                </View>
                            </View>
                            {endGameStats.isExactMath && endGameStats.daysLeft != null && (
                                <Text style={styles.exactMathNote}>{endGameStats.daysLeft} days until semester ends</Text>
                            )}
                        </View>

                        {/* 2. Smart Insights (What we found) — commented out as requested */}
                        {/*
                        {smartInsights.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>What we found</Text>
                                {smartInsights.map((insight, i) => {
                                    const isDanger = insight.severity === 'danger';
                                    const isWarning = insight.severity === 'warning';
                                    const color = isDanger ? COLORS.danger : isWarning ? COLORS.warning : COLORS.primary;
                                    return (
                                        <View key={i} style={styles.cleanInsightRow}>
                                            <View style={[styles.cleanInsightIconWrapper, { backgroundColor: color + '20' }]}>
                                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                                            </View>
                                            <Text style={styles.cleanInsightText}>{insight.text}</Text>
                                        </View>
                                    );
                                })}
                            </View>
                        )}
                        */}

                        {/* 3. Weekday patterns — Kept */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Weekday patterns</Text>
                            <Text style={styles.sectionSubtitle}>{weekdayPatterns.worstDayName ? `${weekdayPatterns.worstDayName} is your weakest day` : 'Consistent across all days'}</Text>
                            <View style={styles.barsContainer}>
                                {[1, 2, 3, 4, 5].map(dayIdx => {
                                    const data = weekdayPatterns.byDay[dayIdx];
                                    if (!data || data.total === 0) return null;
                                    const barHeight = Math.max(8, (data.total / maxDayTotal) * 100);
                                    const presentRatio = data.present / data.total;
                                    const isWorst = dayIdx === weekdayPatterns.worstDayIndex;
                                    const barColor = data.percentage < 70 ? COLORS.danger : data.percentage < threshold ? COLORS.warning : COLORS.success;
                                    return (
                                        <View key={dayIdx} style={styles.barCol}>
                                            <Text style={[styles.barPct, isWorst && { color: COLORS.danger, fontWeight: '700' }]}>{data.percentage?.toFixed(0)}%</Text>
                                            <View style={[styles.barTrack, { height: barHeight }]}>
                                                <View style={[styles.barFill, { height: (presentRatio * 100) + '%', backgroundColor: barColor }]} />
                                            </View>
                                            <Text style={[styles.barLabel, isWorst && { color: COLORS.danger, fontWeight: '700' }]}>{data.name?.slice(0, 3)}</Text>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>

                        {/* 4. Subject trends — do not need to be shown unless we have at least 2 months (60 days) of data */}
                        {semesterSummary.totalDays >= 60 && Object.values(subjectTrends).filter(t => t.direction !== 'stable' || Math.abs(t.delta) > 2).length > 1 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Subject trends</Text>
                                <Text style={styles.sectionSubtitle}>First half vs second half of semester</Text>
                                {Object.values(subjectTrends)
                                    .filter(t => t.direction !== 'stable' || Math.abs(t.delta) > 2)
                                    .sort((a, b) => a.delta - b.delta)
                                    .map((trend, i) => {
                                        const sub = state.subjects.find(s => s.id === trend.subjectId);
                                        const arrow = trend.direction === 'improving' ? '↑' : trend.direction === 'declining' ? '↓' : '→';
                                        const color = trend.direction === 'improving' ? COLORS.success : trend.direction === 'declining' ? COLORS.danger : COLORS.textMuted;
                                        return (
                                            <View key={i} style={styles.trendRow}>
                                                <View style={[styles.trendDot, { backgroundColor: sub?.color || COLORS.primary }]} />
                                                <Text style={styles.trendName} numberOfLines={1}>{trend.name}</Text>
                                                <Text style={[styles.trendArrow, { color }]}>{arrow}</Text>
                                                <Text style={[styles.trendDelta, { color }]}>{trend.delta > 0 ? '+' : ''}{trend.delta.toFixed(0)}%</Text>
                                                <Text style={styles.trendRange}>{trend.firstHalfPct.toFixed(0)}% → {trend.secondHalfPct.toFixed(0)}%</Text>
                                            </View>
                                        );
                                    })}
                            </View>
                        )}

                        {/* Smart Opportunities (Long Weekends) — commented out as requested */}
                        {/*
                        {longWeekends.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Smart Opportunities</Text>
                                <Text style={styles.sectionSubtitle}>We found upcoming long weekends you can safely take off.</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: SPACING.lg, gap: SPACING.md }}>
                                    {longWeekends.map((lw, idx) => (
                                        <View key={idx} style={styles.lwCard}>
                                            <View style={[styles.lwEmojiBg, { backgroundColor: COLORS.primaryLight }]}>
                                                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary }} />
                                            </View>
                                            <Text style={styles.lwDate}>{lw.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                                            <Text style={styles.lwType}>Take {lw.type} off</Text>
                                            <Text style={styles.lwClasses}>Skip {lw.classesToSkip} classes</Text>
                                        </View>
                                    ))}
                                </ScrollView>
                            </View>
                        )}
                        */}

                        {/* 5. Weeks selector (Estimate) */}
                        {!hasEndDate && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Weeks left this term (estimate)</Text>
                                <View style={styles.weeksRow}>
                                    {WEEK_OPTIONS.map(w => (
                                        <TouchableOpacity key={w} style={[styles.weekButton, weeksLeft === w && styles.weekButtonActive]} onPress={() => setWeeksLeft(w)}>
                                            <Text style={[styles.weekButtonText, weeksLeft === w && styles.weekButtonTextActive]}>{w}w</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <Text style={styles.endDateHint}>Estimated for a typical semester. Set your end date in Settings for exact numbers.</Text>
                            </View>
                        )}

                        {/* 6. Per-subject strategy cards */}
                        <Text style={styles.egSectionLabel}>Subject Strategies</Text>
                        {sortedResults.map(subject => {
                            const risk = getRiskLevel(subject.canSkip, subject.mustAttend, subject.remainingUnits);
                            const riskColor = getRiskColor(risk);
                            const strategy = getSkipStrategy(subject, threshold);
                            const isExpanded = expandedSubject === subject.id;
                            return (
                                <TouchableOpacity key={subject.id} style={styles.subjectCard} onPress={() => setExpandedSubject(isExpanded ? null : subject.id)} activeOpacity={0.8}>
                                    <View style={styles.cardHeader}>
                                        <View style={styles.cardHeaderLeft}>
                                            <View style={[styles.colorDot, { backgroundColor: subject.color }]} />
                                            <Text style={styles.cardSubjectName} numberOfLines={1}>{subject.name}</Text>
                                        </View>
                                        <View style={styles.cardHeaderRight}>
                                            <View style={[styles.riskBadge, { borderColor: riskColor, backgroundColor: riskColor + '12' }]}>
                                                <Text style={[styles.riskLabel, { color: riskColor }]}>{getRiskLabel(risk)}</Text>
                                            </View>
                                            <Text style={styles.expandChevron}>{isExpanded ? '▲' : '▼'}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.summaryRow}>
                                        <View style={styles.summaryItem}><Text style={styles.summaryNum}>{subject.percentage.toFixed(1)}%</Text><Text style={styles.summaryLabel}>Current</Text></View>
                                        <Text style={styles.summaryArrowText}>→</Text>
                                        <View style={styles.summaryItem}><Text style={[styles.summaryNum, { color: COLORS.danger }]}>{subject.mustAttend}</Text><Text style={styles.summaryLabel}>Must Attend</Text></View>
                                        <View style={styles.summaryDivider} />
                                        <View style={styles.summaryItem}><Text style={[styles.summaryNum, { color: riskColor }]}>{subject.canSkip}</Text><Text style={styles.summaryLabel}>Can Skip</Text></View>
                                        <View style={styles.summaryDivider} />
                                        <View style={styles.summaryItem}><Text style={styles.summaryNum}>{subject.remainingUnits}</Text><Text style={styles.summaryLabel}>Remaining</Text></View>
                                    </View>
                                    {isExpanded && (
                                        <View style={styles.expandedSection}>
                                            <View style={styles.strategyBox}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[styles.strategyHeadline, { color: riskColor }]}>{strategy.headline}</Text>
                                                    <Text style={styles.strategyDetail}>{strategy.detail}</Text>
                                                    <Text style={styles.strategyAction}>{strategy.action}</Text>
                                                </View>
                                            </View>
                                            
                                            {/* Weekly Burn Plan */}
                                            {subject.canSkip > 0 && subject.weeklyUnits > 0 && (
                                                <View style={styles.planSection}>
                                                    <Text style={styles.consequenceTitle}>Recommended Plan</Text>
                                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.planScroll}>
                                                        {getWeeklyBurnPlan(subject.canSkip, endGameStats.weeksLeft, subject.weeklyUnits).map((p, i) => (
                                                            <View key={p.week} style={[styles.planChip, p.skips > 0 ? styles.planChipActive : styles.planChipEmpty]}>
                                                                <Text style={styles.planWeekText}>Wk {p.week}</Text>
                                                                <Text style={[styles.planSkipText, p.skips > 0 && {color: COLORS.primary}]}>{p.skips > 0 ? `Skip ${p.skips}` : 'Attend'}</Text>
                                                            </View>
                                                        ))}
                                                    </ScrollView>
                                                </View>
                                            )}
 
                                            {risk !== 'impossible' && (
                                                <View style={styles.consequenceSection}>
                                                    <Text style={styles.consequenceTitle}>Skip Impact Simulator</Text>
                                                    <View style={styles.consequenceRow}>
                                                        {[1, 2, 3, 5].filter(n => n <= subject.remainingUnits).map(n => {
                                                            const attendIfSkipN = subject.remainingUnits - n;
                                                            const finalAttended = subject.attendedUnits + attendIfSkipN;
                                                            const finalTotal = subject.totalUnits + subject.remainingUnits;
                                                            const finalPct = calculatePercentage(finalAttended, finalTotal);
                                                            const tgt = subject.target || threshold;
                                                            const passes = finalPct >= tgt;
                                                            return (
                                                                 <View key={n} style={[styles.consequenceChip, { borderColor: passes ? COLORS.success : COLORS.danger, backgroundColor: passes ? COLORS.successLight : COLORS.dangerLight }]}>
                                                                    <Text style={styles.consequenceN}>Skip {n}</Text>
                                                                    <Text style={[styles.consequencePct, { color: passes ? COLORS.successDark : COLORS.danger }]}>{finalPct.toFixed(1)}%</Text>
                                                                    <Text style={[styles.consequenceVerdict, { color: passes ? COLORS.successDark : COLORS.danger }]}>{passes ? 'Pass' : 'Fail'}</Text>
                                                                </View>
                                                            );
                                                        })}
                                                    </View>
                                                </View>
                                            )}
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}

                        {/* Subject breakdown progress bars — commented out in favor of the richer per-subject strategy cards */}
                        {/*
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Subject breakdown</Text>
                            {subjectStats.map(sub => {
                                const isAtRisk = sub.percentage < threshold;
                                return (
                                    <View key={sub.id} style={styles.subjectRow}>
                                        <View style={styles.subjectInfo}>
                                            <View style={[styles.subjectDot, { backgroundColor: sub.color }]}/ >
                                            <Text style={styles.subjectName} numberOfLines={1}>{sub.name}</Text>
                                            <Text style={[styles.subjectPct, isAtRisk && { color: COLORS.danger }]}>{sub.percentage.toFixed(1)}%</Text>
                                        </View>
                                        <View style={styles.subjectBarTrack}>
                                            <View style={[styles.subjectBarFill, { width: Math.min(sub.percentage, 100) + '%', backgroundColor: isAtRisk ? COLORS.danger : sub.color }]} />
                                            <View style={[styles.thresholdLine, { left: threshold + '%' }]} />
                                        </View>
                                        <Text style={styles.subjectMeta}>{sub.attended}/{sub.total} classes</Text>
                                    </View>
                                );
                            })}
                        </View>
                        */}
                    </>
                )}

                {/* Footer Note */}
                <View style={styles.footerNote}>
                    <Text style={styles.footerNoteText}>
                        {endGameStats.isExactMath
                            ? 'Exact calculation based on your timetable until the semester end date.'
                            : 'Estimated based on weekly timetable × weeks remaining. Set semester end date in Settings for exact numbers.'}
                    </Text>
                </View>
                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const getStyles = () => StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    scrollContent: { paddingTop: SPACING.md, paddingBottom: SPACING.xxl },

    // Tab bar
    tabBar: {
        flexDirection: 'row',
        marginHorizontal: SPACING.screenPadding,
        marginTop: SPACING.md,
        marginBottom: SPACING.xs,
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: 4,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
    },
    tab: {
        flex: 1,
        paddingVertical: SPACING.sm,
        alignItems: 'center',
        borderRadius: BORDER_RADIUS.md,
    },
    tabActive: {
        backgroundColor: COLORS.cardBackground,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    tabText: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.textSecondary },
    tabTextActive: { color: COLORS.textPrimary, fontWeight: '700' },

    // Header
    title: { paddingHorizontal: SPACING.screenPadding, fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.textPrimary },
    subtitle: { paddingHorizontal: SPACING.screenPadding, marginTop: 4, marginBottom: SPACING.md },

    // Sections
    section: {
        marginHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.cardGap,
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        ...SHADOWS.small,
    },
    sectionTitle: { ...TYPOGRAPHY.headingSmall, color: COLORS.textPrimary, marginBottom: 4 },
    sectionSubtitle: { ...TYPOGRAPHY.captionMedium, color: COLORS.textMuted, marginBottom: SPACING.md },

    // Smart insights
    cleanInsightRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        marginBottom: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
        backgroundColor: COLORS.cardBackground,
        ...SHADOWS.small,
    },
    cleanInsightIconWrapper: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: SPACING.sm },
    cleanInsightText: { flex: 1, fontSize: FONT_SIZES.sm, color: COLORS.textPrimary, lineHeight: 20 },

    // Glance cards
    glanceScroll: { paddingRight: SPACING.lg, paddingBottom: SPACING.sm },
    glanceCard: { backgroundColor: COLORS.cardBackground, padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, minWidth: 130, marginRight: SPACING.md, borderWidth: 1, borderColor: COLORS.borderSubtle, ...SHADOWS.small },
    glanceIconBg: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md },
    glanceIcon: { fontSize: 18 },
    glanceValue: { fontSize: 26, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 4 },
    glanceLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase' },

    // Weekday bars
    barsContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 140, paddingTop: SPACING.md },
    barCol: { alignItems: 'center', flex: 1 },
    barPct: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, marginBottom: 4 },
    barTrack: { width: 24, borderRadius: 12, backgroundColor: COLORS.inputBackground, overflow: 'hidden', justifyContent: 'flex-end' },
    barFill: { width: '100%', borderRadius: 12 },
    barLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary, marginTop: 6 },

    // Trends
    trendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle, gap: SPACING.sm },
    trendDot: { width: 8, height: 8, borderRadius: 4 },
    trendName: { flex: 1, fontSize: 14, color: COLORS.textPrimary, fontWeight: '500' },
    trendArrow: { fontSize: 16, fontWeight: '700' },
    trendDelta: { fontSize: 13, fontWeight: '700', width: 44, textAlign: 'right' },
    trendRange: { fontSize: 11, color: COLORS.textMuted, width: 72, textAlign: 'right' },

    // Rhythm
    rhythmRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACING.sm },
    rhythmDot: { width: 14, height: 14, borderRadius: 3 },

    // Subject breakdown
    subjectRow: { marginBottom: SPACING.md },
    subjectInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: SPACING.sm },
    subjectDot: { width: 10, height: 10, borderRadius: 5 },
    subjectName: { flex: 1, fontSize: 14, color: COLORS.textPrimary, fontWeight: '500' },
    subjectPct: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
    subjectBarTrack: { height: 8, borderRadius: 4, backgroundColor: COLORS.inputBackground, overflow: 'hidden', position: 'relative' },
    subjectBarFill: { height: '100%', borderRadius: 4 },
    thresholdLine: { position: 'absolute', top: -1, width: 1.5, height: 10, backgroundColor: COLORS.textMuted, opacity: 0.5 },
    subjectMeta: { ...TYPOGRAPHY.captionMedium, color: COLORS.textMuted, marginTop: 4 },

    // Empty
    emptyCard: { margin: SPACING.screenPadding, padding: SPACING.xl, backgroundColor: COLORS.cardBackground, borderRadius: BORDER_RADIUS.lg, alignItems: 'center', ...SHADOWS.small },
    emptyTitle: { ...TYPOGRAPHY.headingSmall, color: COLORS.textPrimary, marginBottom: SPACING.sm },
    emptyText: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },

    // ── End Game styles ──────────────────────────────────────────────

    // Verdict card
    verdictCard: {
        marginHorizontal: SPACING.screenPadding,
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.lg,
        marginBottom: SPACING.cardGap,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.small,
    },
    verdictLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    verdictText: {
        fontSize: 15,
        fontWeight: '600',
        lineHeight: 20,
        color: COLORS.textPrimary,
        marginBottom: SPACING.md,
    },
    statsDivider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginBottom: SPACING.md,
        opacity: 0.8,
    },
    verdictStats: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
    },
    verdictStat: {
        flex: 1,
        alignItems: 'center',
    },
    verdictStatNum: {
        fontSize: 20,
        fontWeight: '800',
        color: COLORS.textPrimary,
    },
    verdictStatLabel: {
        fontSize: 10,
        color: COLORS.textSecondary,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
        marginTop: 2,
    },
    verdictDivider: {
        width: 1,
        height: 24,
        backgroundColor: COLORS.border,
    },
    exactMathNote: {
        fontSize: 11,
        color: COLORS.primary,
        marginTop: SPACING.md,
        textAlign: 'center',
        fontWeight: '600',
    },

    // Weeks selector
    weeksRow: { flexDirection: 'row', gap: SPACING.sm },
    weekButton: { flex: 1, paddingVertical: SPACING.sm, alignItems: 'center', borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.inputBackground, borderWidth: 1, borderColor: COLORS.borderSubtle },
    weekButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    weekButtonText: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.textSecondary },
    weekButtonTextActive: { color: '#fff' },
    endDateHint: { fontSize: FONT_SIZES.xs, color: COLORS.textMuted, marginTop: SPACING.sm },

    // EG section label
    egSectionLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        paddingHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.sm,
        marginTop: SPACING.md,
    },

    // Subject cards
    subjectCard: {
        marginHorizontal: SPACING.screenPadding,
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        marginBottom: SPACING.cardGap,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.small,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    colorDot: { width: 8, height: 8, borderRadius: 4 },
    cardSubjectName: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.textPrimary,
        flex: 1,
    },
    cardHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
    },
    riskBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: BORDER_RADIUS.full,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    riskLabel: {
        fontSize: 9,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    expandChevron: {
        fontSize: 10,
        color: COLORS.textMuted,
        marginLeft: 4,
    },

    // Summary row
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingVertical: 4,
    },
    summaryItem: { flex: 1, alignItems: 'center' },
    summaryNum: {
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.textPrimary,
    },
    summaryLabel: {
        fontSize: 9,
        color: COLORS.textMuted,
        marginTop: 2,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
        fontWeight: '600',
    },
    summaryArrowText: {
        fontSize: 12,
        color: COLORS.textMuted,
        paddingHorizontal: 2,
    },
    summaryDivider: {
        width: 1,
        height: 20,
        backgroundColor: COLORS.border,
    },

    // Expanded
    expandedSection: {
        marginTop: SPACING.md,
        paddingTop: SPACING.md,
        borderTopWidth: 1,
        borderTopColor: COLORS.borderSubtle,
    },
    strategyBox: {
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        backgroundColor: COLORS.inputBackground,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: SPACING.md,
    },
    strategyHeadline: {
        fontSize: 13,
        fontWeight: '800',
        marginBottom: 4,
    },
    strategyDetail: {
        fontSize: 12,
        color: COLORS.textSecondary,
        lineHeight: 17,
        marginBottom: 4,
    },
    strategyAction: {
        fontSize: 11,
        color: COLORS.textMuted,
        fontStyle: 'italic',
    },

    // Plan
    planSection: {
        marginTop: SPACING.sm,
        marginBottom: SPACING.md,
    },
    planScroll: { gap: SPACING.sm, paddingRight: SPACING.md },
    planChip: {
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        minWidth: 70,
    },
    planChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
    planChipEmpty: { borderColor: COLORS.border, backgroundColor: COLORS.inputBackground },
    planWeekText: {
        fontSize: 10,
        fontWeight: '700',
        color: COLORS.textSecondary,
        marginBottom: 2,
    },
    planSkipText: {
        fontSize: 12,
        fontWeight: '800',
        color: COLORS.textMuted,
    },

    // Consequence simulator
    consequenceSection: {
        marginTop: SPACING.sm,
    },
    consequenceTitle: {
        fontSize: 10,
        fontWeight: '700',
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        marginBottom: SPACING.sm,
    },
    consequenceRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
    consequenceChip: { flex: 1, minWidth: 75, alignItems: 'center', padding: SPACING.sm, borderRadius: BORDER_RADIUS.md, borderWidth: 1 },
    consequenceN: {
        fontSize: 10,
        fontWeight: '700',
        color: COLORS.textSecondary,
        marginBottom: 2,
    },
    consequencePct: {
        fontSize: 14,
        fontWeight: '800',
    },
    consequenceVerdict: {
        fontSize: 9,
        fontWeight: '700',
        marginTop: 2,
    },

    // Footer
    footerNote: { marginHorizontal: SPACING.screenPadding, marginTop: SPACING.md, padding: SPACING.md, backgroundColor: COLORS.inputBackground, borderRadius: BORDER_RADIUS.md },
    footerNoteText: { fontSize: FONT_SIZES.xs, color: COLORS.textMuted, lineHeight: 18 },

    // Long Weekends
    lwCard: { backgroundColor: COLORS.cardBackground, padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderSubtle, minWidth: 140, ...SHADOWS.small },
    lwEmojiBg: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary + '15', alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm },
    lwDate: { fontSize: FONT_SIZES.md, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 2 },
    lwType: { fontSize: FONT_SIZES.xs, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4 },
    lwClasses: { fontSize: FONT_SIZES.xs, color: COLORS.primary, fontWeight: '700' },
});
