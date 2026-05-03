/**
 * WeekInReviewCard — shown on weekends (Sat/Sun) on the Today screen.
 *
 * Displays a "Week in Review" summary:
 *   - Classes attended / missed last week
 *   - Strongest and weakest subjects
 *   - Overall trend direction
 *   - Upcoming Monday preview (number of classes)
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../theme/theme';
import { getSubjectAttendance, getClassesForDay } from '../../utils/attendance';
import { getTodayKey } from '../../utils/dateHelpers';

export default function WeekInReviewCard({ state, onViewInsights }) {
    const styles = getStyles();

    const review = useMemo(() => {
        const records = state.attendanceRecords || {};
        const subjects = state.subjects || [];
        if (subjects.length === 0) return null;

        // Find last 7 days of attendance records (looking back from today)
        const today = state.devDate ? new Date(state.devDate) : new Date();
        const weekDates = [];
        for (let i = 1; i <= 7; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            weekDates.push(key);
        }

        let totalPresent = 0;
        let totalAbsent = 0;
        const subjectWeekStats = {}; // subjectId → { present, absent }

        weekDates.forEach(dateKey => {
            const dayData = records[dateKey];
            if (!dayData) return;
            Object.entries(dayData).forEach(([sid, rec]) => {
                if (sid === '_holiday' || !rec || !rec.status) return;
                if (rec.status === 'cancelled') return;
                if (!subjectWeekStats[sid]) subjectWeekStats[sid] = { present: 0, absent: 0 };
                const units = rec.units || 1;
                if (rec.status === 'present') {
                    totalPresent += units;
                    subjectWeekStats[sid].present += units;
                } else if (rec.status === 'absent') {
                    totalAbsent += units;
                    subjectWeekStats[sid].absent += units;
                }
            });
        });

        const totalClasses = totalPresent + totalAbsent;
        if (totalClasses === 0) return null;

        const weekPct = Math.round((totalPresent / totalClasses) * 1000) / 10;

        // Find strongest and weakest subjects this week
        const subjectPerformances = Object.entries(subjectWeekStats)
            .map(([sid, stats]) => {
                const sub = subjects.find(s => s.id === sid);
                const total = stats.present + stats.absent;
                const pct = total > 0 ? Math.round((stats.present / total) * 1000) / 10 : 0;
                return { name: sub?.name || 'Unknown', color: sub?.color || COLORS.primary, pct, total };
            })
            .filter(s => s.total >= 1)
            .sort((a, b) => b.pct - a.pct);

        const strongest = subjectPerformances[0] || null;
        const weakest = subjectPerformances.length > 1
            ? subjectPerformances[subjectPerformances.length - 1]
            : null;

        // Monday preview — count classes scheduled for Monday
        const mondayClasses = getClassesForDay(state, 'Monday');

        return {
            totalPresent,
            totalAbsent,
            totalClasses,
            weekPct,
            strongest,
            weakest: weakest !== strongest ? weakest : null,
            mondayClassCount: mondayClasses.length,
            mondaySubjects: mondayClasses
                .filter((cls, i, arr) => arr.findIndex(c => c.subjectId === cls.subjectId) === i)
                .slice(0, 3)
                .map(cls => ({ name: cls.subjectName, color: cls.color })),
        };
    }, [state.attendanceRecords, state.subjects, state.timetable, state.devDate]);

    if (!review) return null;

    return (
        <View style={styles.card}>
            {/* Header */}
            <View style={styles.headerRow}>
                <View>
                    <Text style={styles.title}>Week in Review</Text>
                    <Text style={styles.subtitle}>Last 7 days</Text>
                </View>
                {onViewInsights && (
                    <TouchableOpacity
                        style={styles.viewAllBtn}
                        onPress={onViewInsights}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                        <Text style={styles.viewAllText}>View all →</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
                <View style={styles.statBox}>
                    <Text style={styles.statNum}>{review.totalClasses}</Text>
                    <Text style={styles.statLabel}>Classes</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                    <Text style={[styles.statNum, { color: COLORS.success }]}>{review.totalPresent}</Text>
                    <Text style={styles.statLabel}>Present</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                    <Text style={[styles.statNum, { color: COLORS.danger }]}>{review.totalAbsent}</Text>
                    <Text style={styles.statLabel}>Missed</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                    <Text style={[styles.statNum, {
                        color: review.weekPct >= (state.settings?.dangerThreshold || 75)
                            ? COLORS.success : COLORS.danger,
                    }]}>{review.weekPct}%</Text>
                    <Text style={styles.statLabel}>Rate</Text>
                </View>
            </View>

            {/* Subject highlights */}
            <View style={styles.highlightsSection}>
                {review.strongest && (
                    <View style={styles.highlightRow}>
                        <View style={[styles.highlightDot, { backgroundColor: review.strongest.color }]} />
                        <Text style={styles.highlightLabel}>Best  </Text>
                        <Text style={styles.highlightValue} numberOfLines={1}>
                            {review.strongest.name} — {review.strongest.pct}%
                        </Text>
                    </View>
                )}
                {review.weakest && (
                    <View style={styles.highlightRow}>
                        <View style={[styles.highlightDot, {
                            backgroundColor: review.weakest.pct < (state.settings?.dangerThreshold || 75)
                                ? COLORS.danger : review.weakest.color,
                        }]} />
                        <Text style={styles.highlightLabel}>Weak  </Text>
                        <Text style={[styles.highlightValue,
                            review.weakest.pct < (state.settings?.dangerThreshold || 75) && { color: COLORS.danger }
                        ]} numberOfLines={1}>
                            {review.weakest.name} — {review.weakest.pct}%
                        </Text>
                    </View>
                )}
            </View>

            {/* Monday preview */}
            {review.mondayClassCount > 0 && (
                <View style={styles.mondayPreview}>
                    <Text style={styles.mondayTitle}>Monday ahead</Text>
                    <Text style={styles.mondayText}>
                        {review.mondayClassCount} class{review.mondayClassCount !== 1 ? 'es' : ''} scheduled
                        {review.mondaySubjects.length > 0 && (
                            ` · ${review.mondaySubjects.map(s => s.name.split(' ')[0]).join(', ')}`
                        )}
                    </Text>
                </View>
            )}
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
        borderColor: COLORS.primary + '25',
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
        color: COLORS.textPrimary,
        fontWeight: '700',
    },
    subtitle: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        marginTop: 2,
    },
    viewAllBtn: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        backgroundColor: COLORS.primaryLight,
        borderRadius: BORDER_RADIUS.full,
    },
    viewAllText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.primary,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        marginBottom: SPACING.md,
    },
    statBox: {
        flex: 1,
        alignItems: 'center',
    },
    statNum: {
        fontSize: 20,
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
        height: 28,
        backgroundColor: COLORS.border,
    },
    highlightsSection: {
        gap: SPACING.xs,
        marginBottom: SPACING.sm,
    },
    highlightRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    highlightDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        flexShrink: 0,
    },
    highlightLabel: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        fontWeight: '600',
        width: 36,
    },
    highlightValue: {
        fontSize: 13,
        color: COLORS.textSecondary,
        flex: 1,
    },
    mondayPreview: {
        marginTop: SPACING.sm,
        paddingTop: SPACING.sm,
        borderTopWidth: 1,
        borderTopColor: COLORS.borderSubtle,
    },
    mondayTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: 2,
    },
    mondayText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
    },
});
