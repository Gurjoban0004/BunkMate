import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, TABULAR } from '../../theme/theme';
import { getSubjectSkipBudget, calculateOverallPercentage, roundPct } from '../../utils/attendance';
import { generateWeeklyReport, getNextClassDay, calculateBestBunkDay } from '../../utils/insights';
import { shortSubjectName } from '../../utils/subjectName';
import { formatTimeRange } from '../../utils/dateHelpers';

const formatDay = (dateKey) => {
    if (!dateKey) return '';
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Date(y, m - 1, d, 12).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/**
 * Today, on a day with nothing to attend. A Sunday screen that only said
 * "No classes today" made the whole app look empty; this one answers the
 * questions a student actually has on a day off — where do I stand, what is
 * next, how did the week go, and which subject needs me most.
 */
export default function RestDayView({ state, dayName, navigation }) {
    const styles = getStyles();
    const threshold = state.settings?.dangerThreshold || 75;

    const overall = useMemo(() => {
        const pct = calculateOverallPercentage(state);
        let attended = 0;
        let total = 0;
        let below = 0;
        let spare = 0;
        const rows = (state.subjects || []).map((sub) => {
            const b = getSubjectSkipBudget(sub.id, state);
            if (!b || b.totalUnits === 0) return null;
            attended += b.attendedUnits;
            total += b.totalUnits;
            if (!b.onTrack) below++;
            else if (Number.isFinite(b.skipClasses)) spare += b.skipClasses;
            return { id: sub.id, name: sub.name, color: sub.color, ...b };
        }).filter(Boolean);
        const lowest = [...rows].sort((a, b) => a.percentage - b.percentage).slice(0, 3);
        return { pct, attended, total, below, spare, lowest, count: rows.length };
    }, [state]);

    const next = useMemo(() => getNextClassDay(state), [state]);
    const week = useMemo(() => generateWeeklyReport(state), [state]);
    const bunk = useMemo(() => calculateBestBunkDay(state), [state]);
    const updatedThrough = state.latestErpDate || state.settings?.latestErpDate || null;

    const openSubject = (id, name) => navigation?.navigate('SubjectDetail', { subjectId: id, subjectName: name });

    const nextSafe = next ? next.classes.filter((c) => c.safe).length : 0;
    const nextTotal = next ? next.classes.length : 0;
    const nextLine = !next ? null
        : nextSafe === nextTotal ? 'Every class is safe to skip, if you want the day.'
            : nextSafe === 0 ? 'Attend everything — no margin on any of them.'
                : `Skip ${next.classes.filter((c) => c.safe).map((c) => shortSubjectName(c.subjectName)).join(', ')}. Attend ${next.classes.filter((c) => !c.safe).map((c) => shortSubjectName(c.subjectName)).join(', ')}.`;

    return (
        <View>
            {/* Hero */}
            <View style={styles.hero}>
                <Text style={styles.heroTitle}>No classes today</Text>
                <Text style={styles.heroSub}>{dayName}. Nothing to attend — here is where things stand.</Text>
            </View>

            {/* Where you stand */}
            {overall.count > 0 && (
                <View style={styles.card}>
                    <View style={styles.standRow}>
                        <Text style={[styles.bigPct, TABULAR, { color: overall.pct >= threshold ? COLORS.successText : COLORS.dangerText }]}>
                            {roundPct(overall.pct).toFixed(1)}%
                        </Text>
                        <View style={styles.standRight}>
                            <Text style={styles.standLine}>{overall.attended} of {overall.total} hours · goal {threshold}%</Text>
                            <Text style={styles.standLine}>
                                {overall.below > 0
                                    ? `${overall.below} subject${overall.below === 1 ? '' : 's'} below goal`
                                    : 'Every subject above goal'}
                                {overall.spare > 0 ? ` · ${overall.spare} skip${overall.spare === 1 ? '' : 's'} to spare` : ''}
                            </Text>
                        </View>
                    </View>
                    {updatedThrough && (
                        <Text style={styles.footnote}>Your college has updated through {formatDay(updatedThrough)}.</Text>
                    )}
                </View>
            )}

            {/* Next day with classes */}
            {next && (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>{next.isTomorrow ? 'Tomorrow' : next.dayName} · {formatDay(next.dateKey)}</Text>
                    <Text style={styles.cardSub}>{nextLine}</Text>
                    {next.classes.map((c, i) => (
                        <TouchableOpacity key={`${c.subjectId}-${i}`} style={styles.row} onPress={() => openSubject(c.subjectId, c.subjectName)} activeOpacity={0.7}>
                            <View style={[styles.dot, { backgroundColor: c.color || COLORS.primary }]} />
                            <View style={styles.rowMain}>
                                <Text style={styles.rowName} numberOfLines={1}>{shortSubjectName(c.subjectName)}</Text>
                                <Text style={styles.rowMeta}>{formatTimeRange(c.startTime, c.endTime)}{c.units > 1 ? ` · ${c.units} hr` : ''}</Text>
                            </View>
                            <Text style={[styles.rowVerdict, { color: c.safe ? COLORS.successText : COLORS.dangerText }]}>
                                {c.safe ? 'Skip OK' : 'Attend'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* This week, as recorded */}
            {week.weekTotal > 0 && (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>This week</Text>
                    <Text style={styles.cardSub}>
                        Attended {week.weekAttended} of {week.weekTotal} hours ({week.weekPercentage}%) across {week.daysTracked} recorded day{week.daysTracked === 1 ? '' : 's'}.
                    </Text>
                    {week.bestSubject && (
                        <View style={styles.row}>
                            <View style={[styles.dot, { backgroundColor: week.bestSubject.color || COLORS.success }]} />
                            <Text style={styles.rowName} numberOfLines={1}>{week.bestSubject.name}</Text>
                            <Text style={[styles.rowVerdict, { color: COLORS.successText }]}>{week.bestSubject.percentage}%</Text>
                        </View>
                    )}
                    {week.worstSubject && (
                        <View style={styles.row}>
                            <View style={[styles.dot, { backgroundColor: week.worstSubject.color || COLORS.danger }]} />
                            <Text style={styles.rowName} numberOfLines={1}>{week.worstSubject.name}</Text>
                            <Text style={[styles.rowVerdict, { color: week.worstSubject.percentage < threshold ? COLORS.dangerText : COLORS.textSecondary }]}>{week.worstSubject.percentage}%</Text>
                        </View>
                    )}
                </View>
            )}

            {/* Cheapest day to skip */}
            {bunk.bestDay && bunk.bestDaySafe && (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Cheapest day to skip</Text>
                    <Text style={styles.cardSub}>
                        Skipping all of {bunk.bestDay} costs the least — you would land at {roundPct(bunk.bestDayNewPct).toFixed(1)}% overall, and every subject that day can absorb it.
                    </Text>
                </View>
            )}

            {/* Needs you most */}
            {overall.lowest.length > 0 && (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Needs you most</Text>
                    {overall.lowest.map((s) => (
                        <TouchableOpacity key={s.id} style={styles.row} onPress={() => openSubject(s.id, s.name)} activeOpacity={0.7}>
                            <View style={[styles.dot, { backgroundColor: s.color || COLORS.primary }]} />
                            <View style={styles.rowMain}>
                                <Text style={styles.rowName} numberOfLines={1}>{s.name}</Text>
                                <Text style={styles.rowMeta}>
                                    {s.onTrack
                                        ? (s.skipClasses > 0 ? `${s.skipClasses} skip${s.skipClasses === 1 ? '' : 's'} to spare` : 'No margin left')
                                        : (Number.isFinite(s.needClasses) ? `Attend ${s.needClasses} more to reach ${s.target}%` : `${s.target}% out of reach`)}
                                </Text>
                            </View>
                            <Text style={[styles.rowVerdict, TABULAR, { color: s.onTrack ? COLORS.textSecondary : COLORS.dangerText }]}>
                                {roundPct(s.percentage).toFixed(1)}%
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
}

const getStyles = () => StyleSheet.create({
    hero: { paddingHorizontal: SPACING.screenPadding, paddingTop: SPACING.md, paddingBottom: SPACING.lg },
    heroTitle: { ...TYPOGRAPHY.headingLarge, color: COLORS.textPrimary },
    heroSub: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textSecondary, marginTop: 4 },
    card: {
        backgroundColor: COLORS.cardBackground,
        marginHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.cardGap,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    cardTitle: { ...TYPOGRAPHY.headingSmall, color: COLORS.textPrimary },
    cardSub: { ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary, marginTop: 4, marginBottom: SPACING.xs },
    standRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    bigPct: { ...TYPOGRAPHY.displayLarge },
    standRight: { flex: 1 },
    standLine: { ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary },
    footnote: { ...TYPOGRAPHY.captionMedium, color: COLORS.textMuted, marginTop: SPACING.sm },
    row: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
        paddingVertical: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.borderSubtle,
    },
    dot: { width: 8, height: 8, borderRadius: 4 },
    rowMain: { flex: 1 },
    rowName: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, flex: 1 },
    rowMeta: { ...TYPOGRAPHY.captionMedium, color: COLORS.textMuted, marginTop: 1 },
    rowVerdict: { ...TYPOGRAPHY.labelSmall },
});
