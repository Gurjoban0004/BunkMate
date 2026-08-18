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
import { triggerHaptic } from '../../utils/haptics';
import { estimateWeeksRemaining } from '../../utils/planner/semesterWindow';
import { generateWeeklyReport } from '../../utils/insights';
import WeeklyReportCard from '../../components/insights/WeeklyReportCard';

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

    const weeklyReport = useMemo(() => generateWeeklyReport(state), [
        state.subjects, state.attendanceRecords, state.holidays, state.devDate,
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
            (order[getRiskLevel(a)] ?? 5) -
            (order[getRiskLevel(b)] ?? 5)
        );
    }, [endGameStats.results]);

    const overallRisk = useMemo(() => {
        if (sortedResults.some(s => getRiskLevel(s) === 'impossible')) return 'impossible';
        if (sortedResults.some(s => getRiskLevel(s) === 'critical')) return 'critical';
        if (sortedResults.some(s => getRiskLevel(s) === 'tight')) return 'tight';
        if (sortedResults.every(s => getRiskLevel(s) === 'comfortable')) return 'comfortable';
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
                        {/* Week in Review — moved here from Today, where it was a
                           full-height retrospective sitting above the day's
                           classes. It belongs with the other retrospectives. */}
                        <WeeklyReportCard report={weeklyReport} />

                        {/* 1. Overall verdict (Semester Outlook) */}
                        <View style={styles.verdictCard}>
                            <Text style={styles.verdictLabel}>Semester Outlook</Text>
                            <Text style={[styles.verdictText, { color: getRiskColor(overallRisk) }]}>{OVERALL_MESSAGES[overallRisk]}</Text>
                            
                            <View style={styles.statsDivider} />

                            <View style={styles.verdictStats}>
                                <View style={styles.verdictStat}>
                                    <Text style={styles.verdictStatNum}>{endGameStats.totalRemainingClasses}</Text>
                                    <Text style={styles.verdictStatLabel}>classes left</Text>
                                </View>
                                <View style={styles.verdictDivider} />
                                <View style={styles.verdictStat}>
                                    <Text style={[styles.verdictStatNum, { color: COLORS.dangerText }]}>{endGameStats.totalMustAttendClasses}</Text>
                                    <Text style={styles.verdictStatLabel}>must attend</Text>
                                </View>
                                <View style={styles.verdictDivider} />
                                <View style={styles.verdictStat}>
                                    <Text style={[styles.verdictStatNum, { color: COLORS.successText }]}>{endGameStats.totalCanSkipClasses}</Text>
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
                                            <Text style={[styles.barPct, isWorst && { color: COLORS.dangerText, fontWeight: '700' }]}>{data.percentage?.toFixed(0)}%</Text>
                                            <View style={[styles.barTrack, { height: barHeight }]}>
                                                <View style={[styles.barFill, { height: (presentRatio * 100) + '%', backgroundColor: barColor }]} />
                                            </View>
                                            <Text style={[styles.barLabel, isWorst && { color: COLORS.dangerText, fontWeight: '700' }]}>{data.name?.slice(0, 3)}</Text>
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
                            const risk = getRiskLevel(subject);
                            const riskColor = getRiskColor(risk);
                            const strategy = getSkipStrategy(subject, threshold);
                            const isExpanded = expandedSubject === subject.id;
                            const tgt = subject.target || threshold;
                            const progressPct = Math.min(subject.percentage, 100);

                            // Build the strategy buffer text
                            let bufferTitle, bufferSubtext;
                            if (risk === 'impossible') {
                                bufferTitle = 'Target Unreachable';
                                const maxPossible = subject.totalUnits + subject.remainingUnits > 0
                                    ? ((subject.attendedUnits + subject.remainingUnits) / (subject.totalUnits + subject.remainingUnits) * 100).toFixed(1)
                                    : '0.0';
                                bufferSubtext = `Max possible ${maxPossible}%`;
                            } else if (subject.canSkipClasses === 0) {
                                bufferTitle = `Must Attend All`;
                                bufferSubtext = 'Zero skip margin';
                            } else if (subject.canSkipClasses <= 2) {
                                bufferTitle = `${subject.canSkipClasses} Skip${subject.canSkipClasses !== 1 ? 's' : ''} Left`;
                                bufferSubtext = `Attend ${subject.mustAttendClasses} of ${subject.remainingClasses} classes`;
                            } else {
                                bufferTitle = `${subject.canSkipClasses} Skips Available`;
                                bufferSubtext = `Attend ${subject.mustAttendClasses} of ${subject.remainingClasses} classes`;
                            }

                            const bufferBg = risk === 'impossible' || risk === 'critical'
                                ? COLORS.dangerLight
                                : risk === 'tight' ? COLORS.warningLight
                                : COLORS.successLight;

                            return (
                                <TouchableOpacity
                                    key={subject.id}
                                    style={styles.subjectCard}
                                    onPress={() => {
                                        triggerHaptic('light');
                                        setExpandedSubject(isExpanded ? null : subject.id);
                                    }}
                                    activeOpacity={0.82}
                                >
                                    {/* ── Header: Title + Risk Badge ── */}
                                    <View style={styles.cardHeader}>
                                        <View style={styles.cardHeaderLeft}>
                                            <View style={[styles.colorDot, { backgroundColor: subject.color }]} />
                                            <View style={styles.cardTitleWrap}>
                                                <Text style={styles.cardSubjectName} numberOfLines={2}>{subject.name}</Text>
                                                {subject.weeklyClasses > 0 && (
                                                    <Text style={styles.weeklyLoadCaption}>{subject.weeklyClasses} {subject.weeklyClasses === 1 ? 'CLASS' : 'CLASSES'} / WEEK</Text>
                                                )}
                                            </View>
                                        </View>
                                        <View style={styles.cardHeaderRight}>
                                            <View style={[styles.riskBadge, { borderColor: riskColor, backgroundColor: riskColor + '12' }]}>
                                                <Text style={[styles.riskLabel, { color: riskColor }]}>{getRiskLabel(risk)}</Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* ── Hero Stat + Strategy Buffer Pill ── */}
                                    <View style={styles.heroStatContainer}>
                                        <View style={styles.heroStatLeft}>
                                            <Text style={styles.heroPercentage}>{subject.percentage.toFixed(1)}%</Text>
                                            <Text style={styles.heroLabel}>CURRENT ATTENDANCE</Text>
                                        </View>
                                        <View style={[styles.strategyBufferPill, { backgroundColor: bufferBg }]}>
                                            <Text style={[styles.strategyBufferTitle, { color: riskColor }]}>{bufferTitle}</Text>
                                            <Text style={styles.strategyBufferSubtext}>{bufferSubtext}</Text>
                                        </View>
                                    </View>

                                    {/* ── Progress Track ── */}
                                    <View style={styles.progressTrackOuter}>
                                        <View style={styles.progressTrack}>
                                            <View style={[styles.progressFill, { width: progressPct + '%', backgroundColor: riskColor }]} />
                                            {/* Threshold marker */}
                                            <View style={[styles.progressThresholdMark, { left: Math.min(tgt, 100) + '%' }]} />
                                        </View>
                                        <Text style={styles.progressTargetLabel}>{tgt}% TARGET</Text>
                                    </View>

                                    {/* ── 3-Column Micro Stat Chips ── */}
                                    <View style={styles.microChipRow}>
                                        <View style={styles.microChip}>
                                            <Text style={styles.microChipValue}>{subject.attendedUnits} / {subject.totalUnits}</Text>
                                            <Text style={styles.microChipLabel}>Attended</Text>
                                        </View>
                                        <View style={styles.microChip}>
                                            <Text style={styles.microChipValue}>{subject.remainingClasses}</Text>
                                            <Text style={styles.microChipLabel}>Remaining</Text>
                                        </View>
                                        <View style={styles.microChip}>
                                            <Text style={styles.microChipValue}>{tgt}%</Text>
                                            <Text style={styles.microChipLabel}>Target</Text>
                                        </View>
                                    </View>

                                    {/* ── Expand Trigger ── */}
                                    <View style={styles.expandTriggerBar}>
                                        <Text style={styles.expandTriggerText}>{isExpanded ? 'Hide Details  ▲' : 'Burn Plan & Simulator  ▼'}</Text>
                                    </View>

                                    {/* ── Expanded Section ── */}
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
                                            {subject.canSkipClasses > 0 && subject.weeklyClasses > 0 && (
                                                <View style={styles.planSection}>
                                                    <Text style={styles.consequenceTitle}>Recommended Plan</Text>
                                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.planScroll}>
                                                        {getWeeklyBurnPlan(subject.canSkipClasses, endGameStats.weeksLeft, subject.weeklyClasses).map((p, i) => (
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
                                                        {[1, 2, 3, 5].filter(n => n <= subject.remainingClasses).map(n => {
                                                            // n whole classes, each worth a full session of periods
                                                            const skippedUnits = Math.min(subject.remainingUnits, n * (subject.sessionUnits?.max || 1));
                                                            const attendIfSkipN = subject.remainingUnits - skippedUnits;
                                                            const finalAttended = subject.attendedUnits + attendIfSkipN;
                                                            const finalTotal = subject.totalUnits + subject.remainingUnits;
                                                            const finalPct = calculatePercentage(finalAttended, finalTotal);
                                                            const simTgt = subject.target || threshold;
                                                            const passes = finalPct >= simTgt;
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
                                            <Text style={[styles.subjectPct, isAtRisk && { color: COLORS.dangerText }]}>{sub.percentage.toFixed(1)}%</Text>
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
        fontWeight: '700',
        fontSize: 10,
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    verdictText: {
        fontWeight: '600',
        fontSize: 15,
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
        fontWeight: '700',
        fontSize: 20,
        color: COLORS.textPrimary,
    },
    verdictStatLabel: {
        fontSize: 10,
        color: COLORS.textSecondary,
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
        fontWeight: '600',
        fontSize: 11,
        color: COLORS.primary,
        marginTop: SPACING.md,
        textAlign: 'center',
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
        fontWeight: '700',
        fontSize: 10,
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
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        marginBottom: SPACING.cardGap,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.small,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: SPACING.md,
    },
    cardHeaderLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1, marginRight: SPACING.sm },
    cardTitleWrap: { flex: 1 },
    colorDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
    cardSubjectName: {
        ...TYPOGRAPHY.headingSmall,
        color: COLORS.textPrimary,
        lineHeight: 20,
    },
    weeklyLoadCaption: {
        fontWeight: '700',
        fontSize: 9,
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginTop: 3,
    },
    cardHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        marginTop: 2,
    },
    riskBadge: {
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: BORDER_RADIUS.full,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    riskLabel: {
        fontWeight: '700',
        fontSize: 9,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },

    // Hero Stat + Strategy Buffer
    heroStatContainer: {
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: SPACING.md,
        marginBottom: SPACING.md,
    },
    heroStatLeft: {
        flex: 1,
        justifyContent: 'center',
    },
    heroPercentage: {
        fontWeight: '700',
        fontSize: 28,
        color: COLORS.textPrimary,
        letterSpacing: -0.5,
        lineHeight: 32,
    },
    heroLabel: {
        fontSize: 9,
        fontWeight: '700',
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginTop: 2,
    },
    strategyBufferPill: {
        flex: 1.2,
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        justifyContent: 'center',
    },
    strategyBufferTitle: {
        fontWeight: '700',
        fontSize: 14,
        letterSpacing: -0.2,
    },
    strategyBufferSubtext: {
        fontWeight: '500',
        fontSize: 11,
        color: COLORS.textSecondary,
        marginTop: 2,
    },

    // Progress Track
    progressTrackOuter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        marginBottom: SPACING.md,
    },
    progressTrack: {
        flex: 1,
        height: 6,
        borderRadius: 3,
        backgroundColor: COLORS.inputBackground,
        overflow: 'hidden',
        position: 'relative',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    progressThresholdMark: {
        position: 'absolute',
        top: -2,
        width: 2,
        height: 10,
        backgroundColor: COLORS.textMuted,
        borderRadius: 1,
        opacity: 0.5,
    },
    progressTargetLabel: {
        fontWeight: '700',
        fontSize: 9,
        color: COLORS.textMuted,
        letterSpacing: 0.3,
    },

    // 3-Column Micro Chips
    microChipRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
        marginBottom: SPACING.sm,
    },
    microChip: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.xs,
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
    },
    microChipValue: {
        fontWeight: '700',
        fontSize: 13,
        color: COLORS.textPrimary,
    },
    microChipLabel: {
        fontSize: 9,
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
        marginTop: 2,
    },

    // Expand Trigger Bar
    expandTriggerBar: {
        alignItems: 'center',
        paddingVertical: SPACING.xs,
        marginTop: SPACING.xs,
    },
    expandTriggerText: {
        fontWeight: '700',
        fontSize: 10,
        color: COLORS.textMuted,
        letterSpacing: 0.3,
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
        fontWeight: '700',
        fontSize: 13,
        marginBottom: 4,
    },
    strategyDetail: {
        fontWeight: '400',
        fontSize: 12,
        color: COLORS.textSecondary,
        lineHeight: 17,
        marginBottom: 4,
    },
    strategyAction: {
        fontWeight: '400',
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
        fontWeight: '700',
        fontSize: 10,
        color: COLORS.textSecondary,
        marginBottom: 2,
    },
    planSkipText: {
        fontWeight: '700',
        fontSize: 12,
        color: COLORS.textMuted,
    },

    // Consequence simulator
    consequenceSection: {
        marginTop: SPACING.sm,
    },
    consequenceTitle: {
        fontWeight: '700',
        fontSize: 10,
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        marginBottom: SPACING.sm,
    },
    consequenceRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
    consequenceChip: { flex: 1, minWidth: 75, alignItems: 'center', padding: SPACING.sm, borderRadius: BORDER_RADIUS.md, borderWidth: 1 },
    consequenceN: {
        fontWeight: '700',
        fontSize: 10,
        color: COLORS.textSecondary,
        marginBottom: 2,
    },
    consequencePct: {
        fontWeight: '700',
        fontSize: 14,
    },
    consequenceVerdict: {
        fontSize: 9,
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
