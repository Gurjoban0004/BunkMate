import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../theme/theme';

/**
 * WeeklyReportCard — Beautiful weekly attendance summary.
 *
 * Props:
 *   report: output of generateWeeklyReport()
 *   onDismiss: callback to hide the card
 */
const WeeklyReportCard = ({ report, onDismiss }) => {
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
                    <Text style={styles.dismissText}>CLOSE</Text>
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

            {/* Best & Worst */}
            <View style={styles.statsRow}>
                {bestSubject && (
                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Best Subject</Text>
                        <View style={styles.subjectTag}>
                            <View style={[styles.subjectDot, { backgroundColor: bestSubject.color }]} />
                            <Text style={styles.subjectName} numberOfLines={1}>
                                {bestSubject.name}
                            </Text>
                        </View>
                        <Text style={[styles.statValue, { color: COLORS.successText }]}>
                            {bestSubject.percentage}%
                        </Text>
                    </View>
                )}
                {worstSubject && (
                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Needs Work</Text>
                        <View style={styles.subjectTag}>
                            <View style={[styles.subjectDot, { backgroundColor: worstSubject.color }]} />
                            <Text style={styles.subjectName} numberOfLines={1}>
                                {worstSubject.name}
                            </Text>
                        </View>
                        <Text style={[styles.statValue, { color: COLORS.dangerText }]}>
                            {worstSubject.percentage}%
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
                            <View style={[styles.barDot, { backgroundColor: sub.color }]} />
                            <Text style={styles.barName} numberOfLines={1}>{sub.name}</Text>
                            <View style={styles.barTrack}>
                                <View style={[
                                    styles.barFill,
                                    {
                                        width: `${Math.min(sub.percentage, 100)}%`,
                                        backgroundColor: sub.percentage >= 75 ? COLORS.success : COLORS.danger,
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
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    dismissBtn: {
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
        fontSize: 9,
        color: COLORS.textMuted,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
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
        fontSize: 11,
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
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.sm,
        marginBottom: SPACING.md,
    },
    personalityContent: {
        flex: 1,
    },
    personalityTitle: {
        fontWeight: '700',
        fontSize: FONT_SIZES.sm,
        color: COLORS.textPrimary,
    },
    personalityDesc: {
        fontWeight: '400',
        fontSize: 11,
        color: COLORS.textSecondary,
        marginTop: 1,
    },
    statsRow: {
        flexDirection: 'row',
        marginBottom: SPACING.md,
    },
    statBox: {
        flex: 1,
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.sm,
        marginRight: SPACING.xs,
    },
    statLabel: {
        fontWeight: '600',
        fontSize: 10,
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    subjectTag: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
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
        fontSize: 16,
        letterSpacing: -0.3,
    },
    barSection: {
        marginBottom: SPACING.md,
    },
    barRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    barDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
    },
    barName: {
        fontWeight: '500',
        fontSize: 11,
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
        fontSize: 10,
        color: COLORS.textMuted,
        width: 30,
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
        fontSize: 10,
        color: COLORS.textMuted,
        marginTop: 2,
    },
});

export default WeeklyReportCard;
