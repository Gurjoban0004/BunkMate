import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
} from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import { getEndGameStats } from '../../utils/planner.js';
import FloatingBackButton from '../../components/common/FloatingBackButton';

const WEEK_OPTIONS = [4, 6, 8, 10];

// ─── Helpers ─────────────────────────────────────────────────────────

function getRiskLevel(canSkip, mustAttend, remainingUnits) {
    if (mustAttend > remainingUnits) return 'impossible';
    if (canSkip === 0) return 'critical';
    if (canSkip <= 2) return 'tight';
    if (canSkip <= 5) return 'moderate';
    return 'comfortable';
}

function getRiskColor(level) {
    switch (level) {
        case 'impossible': return COLORS.danger;
        case 'critical':   return COLORS.danger;
        case 'tight':      return COLORS.warning;
        case 'moderate':   return COLORS.primary;
        case 'comfortable': return COLORS.success;
        default: return COLORS.textSecondary;
    }
}

function getRiskLabel(level) {
    switch (level) {
        case 'impossible':  return 'Cannot pass';
        case 'critical':    return 'Zero margin';
        case 'tight':       return 'Tight';
        case 'moderate':    return 'Manageable';
        case 'comfortable': return 'Comfortable';
        default: return '';
    }
}

function getSkipStrategy(subject) {
    const { canSkip, mustAttend, remainingUnits, name, percentage, weeklyUnits } = subject;
    const risk = getRiskLevel(canSkip, mustAttend, remainingUnits);

    if (risk === 'impossible') {
        return {
            headline: `Cannot reach target`,
            detail: `Even attending every remaining class won't get you to ${subject.target || 75}%. You need ${mustAttend} but only ${remainingUnits} classes remain.`,
            action: 'Talk to your professor about attendance condonation.',
            emoji: '🚨',
        };
    }
    if (risk === 'critical') {
        return {
            headline: `Attend every class`,
            detail: `You have zero skip margin. Missing even one class puts you below target.`,
            action: `Current: ${percentage.toFixed(1)}% — must attend all ${remainingUnits} remaining.`,
            emoji: '⚠️',
        };
    }
    if (risk === 'tight') {
        return {
            headline: `Skip at most ${canSkip}`,
            detail: `You can afford ${canSkip} absence${canSkip !== 1 ? 's' : ''} across the rest of the semester.`,
            action: weeklyUnits > 0
                ? `That's roughly ${(canSkip / weeklyUnits).toFixed(1)} week${canSkip / weeklyUnits >= 2 ? 's' : ''} worth of classes.`
                : 'Use them wisely.',
            emoji: '🟡',
        };
    }
    if (risk === 'moderate') {
        return {
            headline: `Can skip ${canSkip} classes`,
            detail: `You have a reasonable buffer. Spread skips across the semester.`,
            action: weeklyUnits > 0
                ? `~${Math.floor(canSkip / weeklyUnits)} full weeks off, or skip 1 class every ${Math.ceil(remainingUnits / canSkip)} classes.`
                : `${canSkip} total skips available.`,
            emoji: '🟢',
        };
    }
    // comfortable
    return {
        headline: `Can skip ${canSkip} classes`,
        detail: `You're in great shape. Plenty of buffer remaining.`,
        action: weeklyUnits > 0
            ? `Could skip ~${Math.floor(canSkip / weeklyUnits)} full weeks and still pass comfortably.`
            : `${canSkip} total skips available.`,
        emoji: '✅',
    };
}

// ─── Component ───────────────────────────────────────────────────────

const EndGameScreen = () => {
    const styles = getStyles();
    const { state } = useApp();
    const [weeksLeft, setWeeksLeft] = useState(6);
    const [expandedSubject, setExpandedSubject] = useState(null);

    const hasEndDate = !!state.settings?.semesterEndDate;

    const stats = useMemo(() => {
        return getEndGameStats(state, state.settings?.dangerThreshold || 75, weeksLeft);
    }, [state, weeksLeft]);

    // Sort: impossible first, then critical, tight, moderate, comfortable
    const sortedResults = useMemo(() => {
        const order = { impossible: 0, critical: 1, tight: 2, moderate: 3, comfortable: 4 };
        return [...stats.results].sort((a, b) => {
            const ra = getRiskLevel(a.canSkip, a.mustAttend, a.remainingUnits);
            const rb = getRiskLevel(b.canSkip, b.mustAttend, b.remainingUnits);
            return (order[ra] ?? 5) - (order[rb] ?? 5);
        });
    }, [stats.results]);

    const overallRisk = useMemo(() => {
        if (sortedResults.some(s => getRiskLevel(s.canSkip, s.mustAttend, s.remainingUnits) === 'impossible')) return 'impossible';
        if (sortedResults.some(s => getRiskLevel(s.canSkip, s.mustAttend, s.remainingUnits) === 'critical')) return 'critical';
        if (sortedResults.some(s => getRiskLevel(s.canSkip, s.mustAttend, s.remainingUnits) === 'tight')) return 'tight';
        if (sortedResults.every(s => getRiskLevel(s.canSkip, s.mustAttend, s.remainingUnits) === 'comfortable')) return 'comfortable';
        return 'moderate';
    }, [sortedResults]);

    const overallMessage = {
        impossible: "Some subjects can't be saved — act now.",
        critical:   "No room for error. Attend everything.",
        tight:      "Manageable, but don't waste skips.",
        moderate:   "You're on track. Skip strategically.",
        comfortable: "You're in great shape for the semester.",
    }[overallRisk];

    return (
        <SafeAreaView style={styles.container}>
            <FloatingBackButton />
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <Text style={styles.pageTitle}>End Game</Text>
                <Text style={styles.pageSubtitle}>
                    What can you skip and still pass?
                </Text>

                {/* Overall verdict */}
                <View style={[styles.verdictCard, { borderLeftColor: getRiskColor(overallRisk) }]}>
                    <Text style={styles.verdictLabel}>SEMESTER OUTLOOK</Text>
                    <Text style={[styles.verdictText, { color: getRiskColor(overallRisk) }]}>
                        {overallMessage}
                    </Text>
                    <View style={styles.verdictStats}>
                        <View style={styles.verdictStat}>
                            <Text style={styles.verdictStatNum}>{stats.totalRemaining}</Text>
                            <Text style={styles.verdictStatLabel}>classes left</Text>
                        </View>
                        <View style={styles.verdictDivider} />
                        <View style={styles.verdictStat}>
                            <Text style={[styles.verdictStatNum, { color: COLORS.danger }]}>{stats.totalMustAttend}</Text>
                            <Text style={styles.verdictStatLabel}>must attend</Text>
                        </View>
                        <View style={styles.verdictDivider} />
                        <View style={styles.verdictStat}>
                            <Text style={[styles.verdictStatNum, { color: COLORS.success }]}>{stats.totalCanSkip}</Text>
                            <Text style={styles.verdictStatLabel}>can skip</Text>
                        </View>
                    </View>
                    {stats.isExactMath && stats.daysLeft != null && (
                        <Text style={styles.exactMathNote}>
                            📅 Exact math — {stats.daysLeft} days until semester ends
                        </Text>
                    )}
                </View>

                {/* Weeks selector — only show if no end date set */}
                {!hasEndDate && (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>Weeks remaining (estimate):</Text>
                        <View style={styles.weeksRow}>
                            {WEEK_OPTIONS.map((w) => (
                                <TouchableOpacity
                                    key={w}
                                    style={[styles.weekButton, weeksLeft === w && styles.weekButtonActive]}
                                    onPress={() => setWeeksLeft(w)}
                                >
                                    <Text style={[styles.weekButtonText, weeksLeft === w && styles.weekButtonTextActive]}>
                                        {w}w
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <Text style={styles.endDateHint}>
                            💡 Set your semester end date in Settings for exact numbers
                        </Text>
                    </View>
                )}

                {/* Per-subject intelligence cards */}
                <Text style={styles.sectionTitle}>Per Subject Strategy</Text>

                {sortedResults.map((subject) => {
                    const risk = getRiskLevel(subject.canSkip, subject.mustAttend, subject.remainingUnits);
                    const riskColor = getRiskColor(risk);
                    const strategy = getSkipStrategy(subject);
                    const isExpanded = expandedSubject === subject.id;

                    return (
                        <TouchableOpacity
                            key={subject.id}
                            style={[styles.subjectCard, { borderLeftColor: riskColor }]}
                            onPress={() => setExpandedSubject(isExpanded ? null : subject.id)}
                            activeOpacity={0.8}
                        >
                            {/* Card header */}
                            <View style={styles.cardHeader}>
                                <View style={styles.cardHeaderLeft}>
                                    <View style={[styles.colorDot, { backgroundColor: subject.color }]} />
                                    <Text style={styles.subjectName} numberOfLines={1}>{subject.name}</Text>
                                </View>
                                <View style={styles.cardHeaderRight}>
                                    <Text style={[styles.riskLabel, { color: riskColor }]}>
                                        {getRiskLabel(risk)}
                                    </Text>
                                    <Text style={styles.expandChevron}>{isExpanded ? '▲' : '▼'}</Text>
                                </View>
                            </View>

                            {/* Summary row */}
                            <View style={styles.summaryRow}>
                                <View style={styles.summaryItem}>
                                    <Text style={styles.summaryNum}>{subject.percentage.toFixed(1)}%</Text>
                                    <Text style={styles.summaryLabel}>now</Text>
                                </View>
                                <View style={styles.summaryArrow}>
                                    <Text style={styles.summaryArrowText}>→</Text>
                                </View>
                                <View style={styles.summaryItem}>
                                    <Text style={[styles.summaryNum, { color: COLORS.danger }]}>{subject.mustAttend}</Text>
                                    <Text style={styles.summaryLabel}>must attend</Text>
                                </View>
                                <View style={styles.summaryDivider} />
                                <View style={styles.summaryItem}>
                                    <Text style={[styles.summaryNum, { color: riskColor }]}>{subject.canSkip}</Text>
                                    <Text style={styles.summaryLabel}>can skip</Text>
                                </View>
                                <View style={styles.summaryDivider} />
                                <View style={styles.summaryItem}>
                                    <Text style={styles.summaryNum}>{subject.remainingUnits}</Text>
                                    <Text style={styles.summaryLabel}>remaining</Text>
                                </View>
                            </View>

                            {/* Expanded intelligence */}
                            {isExpanded && (
                                <View style={styles.expandedSection}>
                                    <View style={[styles.strategyBox, { borderColor: riskColor, backgroundColor: riskColor + '12' }]}>
                                        <Text style={styles.strategyEmoji}>{strategy.emoji}</Text>
                                        <View style={styles.strategyText}>
                                            <Text style={[styles.strategyHeadline, { color: riskColor }]}>
                                                {strategy.headline}
                                            </Text>
                                            <Text style={styles.strategyDetail}>{strategy.detail}</Text>
                                            <Text style={styles.strategyAction}>{strategy.action}</Text>
                                        </View>
                                    </View>

                                    {/* Skip consequence simulator */}
                                    {risk !== 'impossible' && (
                                        <View style={styles.consequenceSection}>
                                            <Text style={styles.consequenceTitle}>If you skip N classes:</Text>
                                            <View style={styles.consequenceRow}>
                                                {[1, 2, 3, 5].filter(n => n <= subject.remainingUnits).map(n => {
                                                    const newAttended = subject.attendedUnits;
                                                    const newTotal = subject.totalUnits + subject.remainingUnits;
                                                    const skippedTotal = subject.totalUnits + (subject.remainingUnits - n);
                                                    const newPct = skippedTotal > 0
                                                        ? (newAttended + (subject.remainingUnits - n - subject.mustAttend + Math.max(0, subject.mustAttend))) / skippedTotal * 100
                                                        : 0;
                                                    // Simpler: if you skip n, you attend (remainingUnits - n)
                                                    const attendIfSkipN = subject.remainingUnits - n;
                                                    const finalAttended = subject.attendedUnits + attendIfSkipN;
                                                    const finalTotal = subject.totalUnits + subject.remainingUnits;
                                                    const finalPct = finalTotal > 0 ? (finalAttended / finalTotal) * 100 : 0;
                                                    const target = subject.target || state.settings?.dangerThreshold || 75;
                                                    const passes = finalPct >= target;

                                                    return (
                                                        <View key={n} style={[
                                                            styles.consequenceChip,
                                                            { borderColor: passes ? COLORS.success : COLORS.danger,
                                                              backgroundColor: passes ? COLORS.successLight : COLORS.dangerLight }
                                                        ]}>
                                                            <Text style={styles.consequenceN}>Skip {n}</Text>
                                                            <Text style={[styles.consequencePct, { color: passes ? COLORS.successDark : COLORS.danger }]}>
                                                                {finalPct.toFixed(1)}%
                                                            </Text>
                                                            <Text style={[styles.consequenceVerdict, { color: passes ? COLORS.successDark : COLORS.danger }]}>
                                                                {passes ? '✓ Pass' : '✗ Fail'}
                                                            </Text>
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

                {/* Footer note */}
                <View style={styles.footerNote}>
                    <Text style={styles.footerNoteText}>
                        {stats.isExactMath
                            ? '✅ Exact calculation based on your timetable until the semester end date.'
                            : '⚠️ Estimated based on weekly timetable × weeks remaining. Set semester end date in Settings for exact numbers.'}
                    </Text>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const getStyles = () => StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    scrollView: { flex: 1 },
    scrollContent: { paddingTop: SPACING.xxl + SPACING.md },

    pageTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: COLORS.textPrimary,
        paddingHorizontal: SPACING.lg,
    },
    pageSubtitle: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        paddingHorizontal: SPACING.lg,
        marginTop: 4,
        marginBottom: SPACING.lg,
    },

    // Verdict card
    verdictCard: {
        marginHorizontal: SPACING.lg,
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        marginBottom: SPACING.lg,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
        borderLeftWidth: 4,
        ...SHADOWS.small,
    },
    verdictLabel: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '700',
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: SPACING.xs,
    },
    verdictText: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '800',
        marginBottom: SPACING.md,
    },
    verdictStats: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    verdictStat: {
        flex: 1,
        alignItems: 'center',
    },
    verdictStatNum: {
        fontSize: FONT_SIZES.xl,
        fontWeight: '800',
        color: COLORS.textPrimary,
    },
    verdictStatLabel: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
        marginTop: 2,
    },
    verdictDivider: {
        width: 1,
        height: 32,
        backgroundColor: COLORS.border,
    },
    exactMathNote: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.primary,
        marginTop: SPACING.sm,
        fontWeight: '600',
    },

    // Weeks selector
    section: { marginBottom: SPACING.md },
    sectionLabel: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.textSecondary,
        paddingHorizontal: SPACING.lg,
        marginBottom: SPACING.sm,
    },
    weeksRow: {
        flexDirection: 'row',
        paddingHorizontal: SPACING.lg,
        gap: SPACING.sm,
    },
    weekButton: {
        flex: 1,
        paddingVertical: SPACING.sm,
        alignItems: 'center',
        borderRadius: BORDER_RADIUS.md,
        backgroundColor: COLORS.inputBackground,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
    },
    weekButtonActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    weekButtonText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    weekButtonTextActive: {
        color: '#fff',
    },
    endDateHint: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
        paddingHorizontal: SPACING.lg,
        marginTop: SPACING.sm,
    },

    // Section title
    sectionTitle: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '700',
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        paddingHorizontal: SPACING.lg,
        marginBottom: SPACING.sm,
    },

    // Subject card
    subjectCard: {
        marginHorizontal: SPACING.lg,
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
        borderLeftWidth: 4,
        ...SHADOWS.small,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    cardHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    colorDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    subjectName: {
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
        color: COLORS.textPrimary,
        flex: 1,
    },
    cardHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    riskLabel: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '700',
    },
    expandChevron: {
        fontSize: 10,
        color: COLORS.textMuted,
    },

    // Summary row
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    summaryItem: {
        flex: 1,
        alignItems: 'center',
    },
    summaryNum: {
        fontSize: FONT_SIZES.md,
        fontWeight: '800',
        color: COLORS.textPrimary,
    },
    summaryLabel: {
        fontSize: 9,
        color: COLORS.textMuted,
        marginTop: 1,
        textAlign: 'center',
    },
    summaryArrow: {
        paddingHorizontal: 4,
    },
    summaryArrowText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textMuted,
    },
    summaryDivider: {
        width: 1,
        height: 24,
        backgroundColor: COLORS.border,
    },

    // Expanded section
    expandedSection: {
        marginTop: SPACING.md,
        paddingTop: SPACING.md,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    strategyBox: {
        flexDirection: 'row',
        gap: SPACING.sm,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        marginBottom: SPACING.md,
    },
    strategyEmoji: {
        fontSize: 20,
        marginTop: 2,
    },
    strategyText: {
        flex: 1,
    },
    strategyHeadline: {
        fontSize: FONT_SIZES.md,
        fontWeight: '800',
        marginBottom: 4,
    },
    strategyDetail: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        lineHeight: 18,
        marginBottom: 4,
    },
    strategyAction: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
        fontStyle: 'italic',
    },

    // Consequence simulator
    consequenceSection: {
        marginTop: SPACING.xs,
    },
    consequenceTitle: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '700',
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        marginBottom: SPACING.sm,
    },
    consequenceRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
        flexWrap: 'wrap',
    },
    consequenceChip: {
        flex: 1,
        minWidth: 70,
        alignItems: 'center',
        padding: SPACING.sm,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
    },
    consequenceN: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginBottom: 2,
    },
    consequencePct: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '800',
    },
    consequenceVerdict: {
        fontSize: 10,
        fontWeight: '700',
        marginTop: 2,
    },

    // Footer
    footerNote: {
        marginHorizontal: SPACING.lg,
        marginTop: SPACING.md,
        padding: SPACING.md,
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.md,
    },
    footerNoteText: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
        lineHeight: 18,
    },
});

export default EndGameScreen;
