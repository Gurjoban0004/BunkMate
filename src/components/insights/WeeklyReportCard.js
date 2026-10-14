import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, subjectTint } from '../../theme/theme';
import { shortSubjectName } from '../../utils/subjectName';
import { formatPct } from '../../utils/attendance';

/**
 * Weekly attendance summary from the published register.
 *
 * Props:
 *   report: output of generateWeeklyReport()
 *   onDismiss: callback to hide the card
 */
const WeeklyReportCard = ({ report, subjects, onDismiss }) => {
    const styles = getStyles();

    if (!report || report.weekTotal === 0) return null;

    const {
        weekAttended,
        weekTotal,
        weekPercentage,
        bestSubject,
        worstSubject,
        streak,
        daysTracked,
        personality,
        perSubject,
        weekStartDate,
        weekEndDate,
    } = report;

    const formatDateShort = (dateStr) => {
        const d = new Date(dateStr + 'T00:00:00');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[d.getMonth()]} ${d.getDate()}`;
    };

    return (
        <View style={styles.container}>
            {/* Dismiss */}
            {onDismiss && (
                <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss}>
                    <Text style={styles.dismissText}>Close</Text>
                </TouchableOpacity>
            )}

            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Your Week in Review</Text>
                    <Text style={styles.headerDate}>
                        {formatDateShort(weekStartDate)} — {formatDateShort(weekEndDate)}
                    </Text>
                </View>
            </View>

            {/* Hero stat */}
            <View style={styles.heroSection}>
                <Text style={styles.heroPercentage}>{weekPercentage}%</Text>
                <Text style={styles.heroLabel}>
                    {weekAttended}/{weekTotal} classes attended
                </Text>
            </View>

            {/* Personality */}
            <View style={styles.personalityBadge}>
                <View style={styles.personalityContent}>
                    <Text style={styles.personalityTitle}>{personality.title}</Text>
                    <Text style={styles.personalityDesc}>{personality.description}</Text>
                </View>
            </View>

            {/* Highlights share the same surface as the subject chart. */}
            <View style={styles.statsRow}>
                {bestSubject && (
                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Best this week</Text>
                        <View style={styles.subjectTag}>
                            <View style={[styles.subjectDot, { backgroundColor: bestSubject.color }]} />
                            <Text style={styles.subjectName} numberOfLines={1}>
                                {shortSubjectName(bestSubject.name)}
                            </Text>
                        </View>
                        <Text style={[styles.statValue, { color: COLORS.successText }]}>
                            {formatPct(bestSubject.percentage)}%
                        </Text>
                    </View>
                )}
                {worstSubject && worstSubject.percentage < 100 && (
                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Lowest this week</Text>
                        <View style={styles.subjectTag}>
                            <View style={[styles.subjectDot, { backgroundColor: worstSubject.color }]} />
                            <Text style={styles.subjectName} numberOfLines={1}>
                                {shortSubjectName(worstSubject.name)}
                            </Text>
                        </View>
                        <Text style={styles.statValue}>
                            {formatPct(worstSubject.percentage)}%
                        </Text>
                    </View>
                )}
            </View>

            {/* Per-subject bars */}
            <View style={styles.barSection}>
                {perSubject
                    .filter(s => s.total > 0)
                    .sort((a, b) => b.percentage - a.percentage)
                    .map(sub => (
                        <View key={sub.subjectId} style={styles.barRow}>
                            {/* The subject's own hue, the same one it wears on
                                Today and in the subject list — see theme.js §1c. */}
                            <View style={[styles.barDot, { backgroundColor: subjectTint(sub.subjectId, subjects).accent }]} />
                            <Text style={styles.barName} numberOfLines={1}>{shortSubjectName(sub.name)}</Text>
                            <View style={styles.barTrack}>
                                <View style={[
                                    styles.barFill,
                                    {
                                        width: `${Math.min(sub.percentage, 100)}%`,
                                        backgroundColor: subjectTint(sub.subjectId, subjects).accent,
                                    },
                                ]} />
                            </View>
                            <Text style={styles.barValue}>{sub.attended}/{sub.total}</Text>
                        </View>
                    ))}
            </View>

            {/* Footer stats */}
            <View style={styles.footerRow}>
                <View style={styles.footerStat}>
                    <Text style={styles.footerStatValue}>{streak}</Text>
                    <Text style={styles.footerStatLabel}>Streak</Text>
                </View>
                <View style={styles.footerStat}>
                    <Text style={styles.footerStatValue}>{daysTracked}</Text>
                    <Text style={styles.footerStatLabel}>Days tracked</Text>
                </View>
                <View style={styles.footerStat}>
                    <Text style={styles.footerStatValue}>{weekAttended}</Text>
                    <Text style={styles.footerStatLabel}>Attended</Text>
                </View>
            </View>
        </View>
    );
};

const getStyles = () => StyleSheet.create({
    container: {
        backgroundColor: COLORS.cardBackground,
        marginHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.cardGap,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    dismissBtn: {
        minHeight: Platform.OS === 'android' ? 48 : 44,
        minWidth: Platform.OS === 'android' ? 48 : 44,
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 1,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: BORDER_RADIUS.sm,
        backgroundColor: COLORS.inputBackground,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dismissText: {
        fontWeight: '700',
        fontSize: 12,
        color: COLORS.textMuted,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    headerTitle: {
        fontWeight: '700',
        fontSize: 16,
        color: COLORS.textPrimary,
        letterSpacing: -0.3,
    },
    headerDate: {
        fontWeight: '500',
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 2,
        letterSpacing: 0.2,
    },
    heroSection: {
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    heroPercentage: {
        fontWeight: '700',
        fontSize: 26,
        color: COLORS.textPrimary,
        letterSpacing: -0.5,
    },
    heroLabel: {
        fontWeight: '400',
        fontSize: 11,
        color: COLORS.textSecondary,
        marginTop: 2,
        letterSpacing: 0.2,
    },
    personalityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        marginBottom: SPACING.md,
    },
    personalityContent: {
        flex: 1,
    },
    personalityTitle: {
        fontWeight: '700',
        fontSize: 14,
        color: COLORS.textPrimary,
    },
    personalityDesc: {
        fontWeight: '400',
        fontSize: 12,
        lineHeight: 17,
        color: COLORS.textSecondary,
        marginTop: 1,
    },
    statsRow: {
        gap: SPACING.sm,
        marginBottom: SPACING.md,
    },
    statBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    statLabel: {
        fontWeight: '600',
        fontSize: 12,
        color: COLORS.textSecondary,
        flex: 1,
    },
    subjectTag: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        minWidth: 0,
    },
    subjectDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 4,
    },
    subjectName: {
        fontWeight: '600',
        fontSize: 12,
        color: COLORS.textPrimary,
        flex: 1,
    },
    statValue: {
        fontWeight: '700',
        fontSize: 14,
        color: COLORS.textPrimary,
    },
    barSection: {
        marginBottom: SPACING.md,
    },
    barRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    barDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
    },
    barName: {
        fontWeight: '500',
        fontSize: 12,
        color: COLORS.textSecondary,
        width: 80,
    },
    barTrack: {
        flex: 1,
        height: 6,
        backgroundColor: COLORS.border,
        borderRadius: 3,
        marginHorizontal: 6,
        overflow: 'hidden',
    },
    barFill: {
        height: '100%',
        borderRadius: 3,
    },
    barValue: {
        fontWeight: '600',
        fontSize: 12,
        color: COLORS.textSecondary,
        minWidth: 34,
        textAlign: 'right',
    },
    footerRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingTop: SPACING.sm,
        borderTopWidth: 1,
        borderTopColor: COLORS.borderLight,
    },
    footerStat: {
        alignItems: 'center',
    },
    footerStatValue: {
        fontWeight: '700',
        fontSize: 14,
        color: COLORS.textPrimary,
    },
    footerStatLabel: {
        fontWeight: '400',
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
});

export default WeeklyReportCard;
