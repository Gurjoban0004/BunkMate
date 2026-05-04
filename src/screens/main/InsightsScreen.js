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
import { getSubjectAttendance } from '../../utils/attendance';
import { getEndGameStats } from '../../utils/planner.js';
import { DisplayMedium, BodySmall } from '../../components/common/Typography';

// ─── End Game helpers ────────────────────────────────────────────────

const WEEK_OPTIONS = [4, 6, 8, 10];

function getRiskLevel(canSkip, mustAttend, remainingUnits) {
    if (mustAttend > remainingUnits) return 'impossible';
    if (canSkip === 0) return 'critical';
    if (canSkip <= 2) return 'tight';
    if (canSkip <= 5) return 'moderate';
    return 'comfortable';
}

function getRiskColor(level) {
    if (level === 'impossible' || level === 'critical') return COLORS.danger;
    if (level === 'tight') return COLORS.warning;
    if (level === 'moderate') return COLORS.primary;
    return COLORS.success;
}

function getRiskLabel(level) {
    const labels = { impossible: 'Cannot pass', critical: 'Zero margin', tight: 'Tight', moderate: 'Manageable', comfortable: 'Comfortable' };
    return labels[level] || '';
}

function getSkipStrategy(subject, threshold) {
    const { canSkip, mustAttend, remainingUnits, percentage, weeklyUnits } = subject;
    const risk = getRiskLevel(canSkip, mustAttend, remainingUnits);
    const tgt = subject.target || threshold || 75;
    if (risk === 'impossible') return { headline: 'Cannot reach target', detail: `Even attending every remaining class won't reach ${tgt}%. Need ${mustAttend} but only ${remainingUnits} remain.`, action: 'Talk to your professor about attendance condonation.', emoji: '🚨' };
    if (risk === 'critical') return { headline: 'Attend every class', detail: 'Zero skip margin. Missing even one class puts you below target.', action: `Current: ${percentage.toFixed(1)}% — must attend all ${remainingUnits} remaining.`, emoji: '⚠️' };
    if (risk === 'tight') return { headline: `Skip at most ${canSkip}`, detail: `You can afford ${canSkip} absence${canSkip !== 1 ? 's' : ''} across the rest of the semester.`, action: weeklyUnits > 0 ? `~${(canSkip / weeklyUnits).toFixed(1)} weeks worth of classes.` : 'Use them wisely.', emoji: '🟡' };
    if (risk === 'moderate') return { headline: `Can skip ${canSkip} classes`, detail: 'Reasonable buffer. Spread skips across the semester.', action: weeklyUnits > 0 ? `~${Math.floor(canSkip / weeklyUnits)} full weeks off, or skip 1 every ${Math.ceil(remainingUnits / canSkip)} classes.` : `${canSkip} total skips available.`, emoji: '🟢' };
    return { headline: `Can skip ${canSkip} classes`, detail: "You're in great shape. Plenty of buffer remaining.", action: weeklyUnits > 0 ? `Could skip ~${Math.floor(canSkip / weeklyUnits)} full weeks and still pass.` : `${canSkip} total skips available.`, emoji: '✅' };
}

const OVERALL_MESSAGES = {
    impossible: "Some subjects can't be saved — act now.",
    critical: 'No room for error. Attend everything.',
    tight: "Manageable, but don't waste skips.",
    moderate: "You're on track. Skip strategically.",
    comfortable: "You're in great shape for the semester.",
};

// ─── Component ───────────────────────────────────────────────────────

export default function InsightsScreen() {
    const styles = getStyles();
    const { state } = useApp();
    const [activeTab, setActiveTab] = useState('insights');
    const [weeksLeft, setWeeksLeft] = useState(6);
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

    const endGameStats = useMemo(() => getEndGameStats(state, threshold, weeksLeft), [state, threshold, weeksLeft]);

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

    const { weekdayPatterns, subjectTrends, recentRhythm, semesterSummary, smartInsights } = intel;
    const maxDayTotal = Math.max(...Object.values(weekdayPatterns?.byDay || {}).map(d => d.total), 1);

    return (
        <SafeAreaView style={styles.container}>
            {/* Tab bar */}
            <View style={styles.tabBar}>
                <TouchableOpacity style={[styles.tab, activeTab === 'insights' && styles.tabActive]} onPress={() => setActiveTab('insights')}>
                    <Text style={[styles.tabText, activeTab === 'insights' && styles.tabTextActive]}>Insights</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, activeTab === 'endgame' && styles.tabActive]} onPress={() => setActiveTab('endgame')}>
                    <Text style={[styles.tabText, activeTab === 'endgame' && styles.tabTextActive]}>End Game</Text>
                </TouchableOpacity>
            </View>

            {/* ── INSIGHTS TAB ─────────────────────────────────── */}
            {activeTab === 'insights' && (
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
                            {/* Smart Insights */}
                            {smartInsights.length > 0 && (
                                <View style={styles.section}>
                                    <Text style={styles.sectionTitle}>What we found</Text>
                                    {smartInsights.map((insight, i) => {
                                        const isDanger = insight.severity === 'danger';
                                        const isWarning = insight.severity === 'warning';
                                        const icon = isDanger ? '⚠️' : isWarning ? '📉' : '💡';
                                        const color = isDanger ? COLORS.danger : isWarning ? COLORS.warning : COLORS.primary;
                                        return (
                                            <View key={i} style={styles.cleanInsightRow}>
                                                <View style={[styles.cleanInsightIconWrapper, { backgroundColor: color + '15' }]}>
                                                    <Text style={styles.cleanInsightIcon}>{icon}</Text>
                                                </View>
                                                <Text style={styles.cleanInsightText}>{insight.text}</Text>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}

                            {/* Semester at a glance */}
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Semester at a glance</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.glanceScroll}>
                                    {[
                                        { icon: '📚', value: semesterSummary.totalClasses, label: 'Total Classes', color: COLORS.primary },
                                        { icon: '🎯', value: semesterSummary.overallPercentage + '%', label: 'Overall Rate', color: semesterSummary.overallPercentage >= threshold ? COLORS.success : COLORS.danger },
                                        { icon: '✅', value: semesterSummary.totalPresent, label: 'Present', color: COLORS.success },
                                        { icon: '❌', value: semesterSummary.totalAbsent, label: 'Missed', color: COLORS.danger },
                                    ].map((item, i) => (
                                        <View key={i} style={styles.glanceCard}>
                                            <View style={[styles.glanceIconBg, { backgroundColor: item.color + '15' }]}>
                                                <Text style={styles.glanceIcon}>{item.icon}</Text>
                                            </View>
                                            <Text style={[styles.glanceValue, { color: item.color }]}>{item.value}</Text>
                                            <Text style={styles.glanceLabel}>{item.label}</Text>
                                        </View>
                                    ))}
                                </ScrollView>
                            </View>

                            {/* Weekday patterns */}
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

                            {/* Subject trends */}
                            {Object.values(subjectTrends).filter(t => t.direction !== 'stable' || Math.abs(t.delta) > 2).length > 1 && (
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

                            {/* Recent rhythm */}
                            {recentRhythm.total >= 5 && (
                                <View style={styles.section}>
                                    <Text style={styles.sectionTitle}>Recent rhythm</Text>
                                    <Text style={styles.sectionSubtitle}>Last {recentRhythm.total} classes: {recentRhythm.presentCount} present, {recentRhythm.absentCount} absent</Text>
                                    <View style={styles.rhythmRow}>
                                        {recentRhythm.events.slice(-15).map((ev, i) => (
                                            <View key={i} style={[styles.rhythmDot, { backgroundColor: ev.status === 'present' ? COLORS.success : ev.status === 'absent' ? COLORS.danger : COLORS.textMuted }]} />
                                        ))}
                                    </View>
                                </View>
                            )}

                            {/* Subject breakdown */}
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Subject breakdown</Text>
                                {subjectStats.map(sub => {
                                    const isAtRisk = sub.percentage < threshold;
                                    return (
                                        <View key={sub.id} style={styles.subjectRow}>
                                            <View style={styles.subjectInfo}>
                                                <View style={[styles.subjectDot, { backgroundColor: sub.color }]} />
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
                        </>
                    )}
                    <View style={{ height: 100 }} />
                </ScrollView>
            )}

            {/* ── END GAME TAB ─────────────────────────────────── */}
            {activeTab === 'endgame' && (
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <DisplayMedium style={styles.title}>End Game</DisplayMedium>
                    <BodySmall color="textMuted" style={styles.subtitle}>What can you skip and still pass?</BodySmall>

                    {/* Overall verdict */}
                    <View style={[styles.verdictCard, { borderLeftColor: getRiskColor(overallRisk) }]}>
                        <Text style={styles.verdictLabel}>SEMESTER OUTLOOK</Text>
                        <Text style={[styles.verdictText, { color: getRiskColor(overallRisk) }]}>{OVERALL_MESSAGES[overallRisk]}</Text>
                        <View style={styles.verdictStats}>
                            <View style={styles.verdictStat}><Text style={styles.verdictStatNum}>{endGameStats.totalRemaining}</Text><Text style={styles.verdictStatLabel}>classes left</Text></View>
                            <View style={styles.verdictDivider} />
                            <View style={styles.verdictStat}><Text style={[styles.verdictStatNum, { color: COLORS.danger }]}>{endGameStats.totalMustAttend}</Text><Text style={styles.verdictStatLabel}>must attend</Text></View>
                            <View style={styles.verdictDivider} />
                            <View style={styles.verdictStat}><Text style={[styles.verdictStatNum, { color: COLORS.success }]}>{endGameStats.totalCanSkip}</Text><Text style={styles.verdictStatLabel}>can skip</Text></View>
                        </View>
                        {endGameStats.isExactMath && endGameStats.daysLeft != null && (
                            <Text style={styles.exactMathNote}>📅 Exact math — {endGameStats.daysLeft} days until semester ends</Text>
                        )}
                    </View>

                    {/* Weeks selector */}
                    {!hasEndDate && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Weeks remaining (estimate)</Text>
                            <View style={styles.weeksRow}>
                                {WEEK_OPTIONS.map(w => (
                                    <TouchableOpacity key={w} style={[styles.weekButton, weeksLeft === w && styles.weekButtonActive]} onPress={() => setWeeksLeft(w)}>
                                        <Text style={[styles.weekButtonText, weeksLeft === w && styles.weekButtonTextActive]}>{w}w</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <Text style={styles.endDateHint}>💡 Set semester end date in Settings for exact numbers</Text>
                        </View>
                    )}

                    {/* Per-subject cards */}
                    <Text style={styles.egSectionLabel}>PER SUBJECT STRATEGY</Text>
                    {sortedResults.map(subject => {
                        const risk = getRiskLevel(subject.canSkip, subject.mustAttend, subject.remainingUnits);
                        const riskColor = getRiskColor(risk);
                        const strategy = getSkipStrategy(subject, threshold);
                        const isExpanded = expandedSubject === subject.id;
                        return (
                            <TouchableOpacity key={subject.id} style={[styles.subjectCard, { borderLeftColor: riskColor }]} onPress={() => setExpandedSubject(isExpanded ? null : subject.id)} activeOpacity={0.8}>
                                <View style={styles.cardHeader}>
                                    <View style={styles.cardHeaderLeft}>
                                        <View style={[styles.colorDot, { backgroundColor: subject.color }]} />
                                        <Text style={styles.cardSubjectName} numberOfLines={1}>{subject.name}</Text>
                                    </View>
                                    <View style={styles.cardHeaderRight}>
                                        <Text style={[styles.riskLabel, { color: riskColor }]}>{getRiskLabel(risk)}</Text>
                                        <Text style={styles.expandChevron}>{isExpanded ? '▲' : '▼'}</Text>
                                    </View>
                                </View>
                                <View style={styles.summaryRow}>
                                    <View style={styles.summaryItem}><Text style={styles.summaryNum}>{subject.percentage.toFixed(1)}%</Text><Text style={styles.summaryLabel}>now</Text></View>
                                    <Text style={styles.summaryArrowText}>→</Text>
                                    <View style={styles.summaryItem}><Text style={[styles.summaryNum, { color: COLORS.danger }]}>{subject.mustAttend}</Text><Text style={styles.summaryLabel}>must attend</Text></View>
                                    <View style={styles.summaryDivider} />
                                    <View style={styles.summaryItem}><Text style={[styles.summaryNum, { color: riskColor }]}>{subject.canSkip}</Text><Text style={styles.summaryLabel}>can skip</Text></View>
                                    <View style={styles.summaryDivider} />
                                    <View style={styles.summaryItem}><Text style={styles.summaryNum}>{subject.remainingUnits}</Text><Text style={styles.summaryLabel}>remaining</Text></View>
                                </View>
                                {isExpanded && (
                                    <View style={styles.expandedSection}>
                                        <View style={[styles.strategyBox, { borderColor: riskColor, backgroundColor: riskColor + '12' }]}>
                                            <Text style={styles.strategyEmoji}>{strategy.emoji}</Text>
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.strategyHeadline, { color: riskColor }]}>{strategy.headline}</Text>
                                                <Text style={styles.strategyDetail}>{strategy.detail}</Text>
                                                <Text style={styles.strategyAction}>{strategy.action}</Text>
                                            </View>
                                        </View>
                                        {risk !== 'impossible' && (
                                            <View style={styles.consequenceSection}>
                                                <Text style={styles.consequenceTitle}>IF YOU SKIP N CLASSES:</Text>
                                                <View style={styles.consequenceRow}>
                                                    {[1, 2, 3, 5].filter(n => n <= subject.remainingUnits).map(n => {
                                                        const attendIfSkipN = subject.remainingUnits - n;
                                                        const finalAttended = subject.attendedUnits + attendIfSkipN;
                                                        const finalTotal = subject.totalUnits + subject.remainingUnits;
                                                        const finalPct = finalTotal > 0 ? (finalAttended / finalTotal) * 100 : 0;
                                                        const tgt = subject.target || threshold;
                                                        const passes = finalPct >= tgt;
                                                        return (
                                                            <View key={n} style={[styles.consequenceChip, { borderColor: passes ? COLORS.success : COLORS.danger, backgroundColor: passes ? COLORS.successLight : COLORS.dangerLight }]}>
                                                                <Text style={styles.consequenceN}>Skip {n}</Text>
                                                                <Text style={[styles.consequencePct, { color: passes ? COLORS.successDark : COLORS.danger }]}>{finalPct.toFixed(1)}%</Text>
                                                                <Text style={[styles.consequenceVerdict, { color: passes ? COLORS.successDark : COLORS.danger }]}>{passes ? '✓ Pass' : '✗ Fail'}</Text>
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

                    <View style={styles.footerNote}>
                        <Text style={styles.footerNoteText}>
                            {endGameStats.isExactMath
                                ? '✅ Exact calculation based on your timetable until the semester end date.'
                                : '⚠️ Estimated based on weekly timetable × weeks remaining. Set semester end date in Settings for exact numbers.'}
                        </Text>
                    </View>
                    <View style={{ height: 100 }} />
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const getStyles = () => StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    scrollContent: { paddingTop: SPACING.md, paddingBottom: SPACING.xl },

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
        marginBottom: SPACING.lg,
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        ...SHADOWS.small,
    },
    sectionTitle: { ...TYPOGRAPHY.headerSmall, color: COLORS.textPrimary, marginBottom: 4 },
    sectionSubtitle: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginBottom: SPACING.md },

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
    cleanInsightIcon: { fontSize: 14 },
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
    subjectMeta: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: 4 },

    // Empty
    emptyCard: { margin: SPACING.screenPadding, padding: SPACING.xl, backgroundColor: COLORS.cardBackground, borderRadius: BORDER_RADIUS.lg, alignItems: 'center', ...SHADOWS.small },
    emptyTitle: { ...TYPOGRAPHY.headerSmall, color: COLORS.textPrimary, marginBottom: SPACING.sm },
    emptyText: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },

    // ── End Game styles ──────────────────────────────────────────────

    // Verdict card
    verdictCard: { marginHorizontal: SPACING.screenPadding, backgroundColor: COLORS.cardBackground, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.lg, borderWidth: 1, borderColor: COLORS.borderSubtle, borderLeftWidth: 4, ...SHADOWS.small },
    verdictLabel: { fontSize: FONT_SIZES.xs, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.xs },
    verdictText: { fontSize: FONT_SIZES.lg, fontWeight: '800', marginBottom: SPACING.md },
    verdictStats: { flexDirection: 'row', alignItems: 'center' },
    verdictStat: { flex: 1, alignItems: 'center' },
    verdictStatNum: { fontSize: FONT_SIZES.xl, fontWeight: '800', color: COLORS.textPrimary },
    verdictStatLabel: { fontSize: FONT_SIZES.xs, color: COLORS.textMuted, marginTop: 2 },
    verdictDivider: { width: 1, height: 32, backgroundColor: COLORS.border },
    exactMathNote: { fontSize: FONT_SIZES.xs, color: COLORS.primary, marginTop: SPACING.sm, fontWeight: '600' },

    // Weeks selector
    weeksRow: { flexDirection: 'row', gap: SPACING.sm },
    weekButton: { flex: 1, paddingVertical: SPACING.sm, alignItems: 'center', borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.inputBackground, borderWidth: 1, borderColor: COLORS.borderSubtle },
    weekButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    weekButtonText: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.textSecondary },
    weekButtonTextActive: { color: '#fff' },
    endDateHint: { fontSize: FONT_SIZES.xs, color: COLORS.textMuted, marginTop: SPACING.sm },

    // EG section label
    egSectionLabel: { fontSize: FONT_SIZES.xs, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: SPACING.screenPadding, marginBottom: SPACING.sm },

    // Subject cards
    subjectCard: { marginHorizontal: SPACING.screenPadding, backgroundColor: COLORS.cardBackground, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.borderSubtle, borderLeftWidth: 4, ...SHADOWS.small },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
    cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    colorDot: { width: 8, height: 8, borderRadius: 4 },
    cardSubjectName: { fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
    cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    riskLabel: { fontSize: FONT_SIZES.xs, fontWeight: '700' },
    expandChevron: { fontSize: 10, color: COLORS.textMuted },

    // Summary row
    summaryRow: { flexDirection: 'row', alignItems: 'center' },
    summaryItem: { flex: 1, alignItems: 'center' },
    summaryNum: { fontSize: FONT_SIZES.md, fontWeight: '800', color: COLORS.textPrimary },
    summaryLabel: { fontSize: 9, color: COLORS.textMuted, marginTop: 1, textAlign: 'center' },
    summaryArrowText: { fontSize: FONT_SIZES.sm, color: COLORS.textMuted, paddingHorizontal: 4 },
    summaryDivider: { width: 1, height: 24, backgroundColor: COLORS.border },

    // Expanded
    expandedSection: { marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border },
    strategyBox: { flexDirection: 'row', gap: SPACING.sm, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, marginBottom: SPACING.md },
    strategyEmoji: { fontSize: 20, marginTop: 2 },
    strategyHeadline: { fontSize: FONT_SIZES.md, fontWeight: '800', marginBottom: 4 },
    strategyDetail: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, lineHeight: 18, marginBottom: 4 },
    strategyAction: { fontSize: FONT_SIZES.xs, color: COLORS.textMuted, fontStyle: 'italic' },

    // Consequence simulator
    consequenceSection: { marginTop: SPACING.xs },
    consequenceTitle: { fontSize: FONT_SIZES.xs, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: SPACING.sm },
    consequenceRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
    consequenceChip: { flex: 1, minWidth: 70, alignItems: 'center', padding: SPACING.sm, borderRadius: BORDER_RADIUS.md, borderWidth: 1 },
    consequenceN: { fontSize: FONT_SIZES.xs, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 2 },
    consequencePct: { fontSize: FONT_SIZES.lg, fontWeight: '800' },
    consequenceVerdict: { fontSize: 10, fontWeight: '700', marginTop: 2 },

    // Footer
    footerNote: { marginHorizontal: SPACING.screenPadding, marginTop: SPACING.md, padding: SPACING.md, backgroundColor: COLORS.inputBackground, borderRadius: BORDER_RADIUS.md },
    footerNoteText: { fontSize: FONT_SIZES.xs, color: COLORS.textMuted, lineHeight: 18 },
});
