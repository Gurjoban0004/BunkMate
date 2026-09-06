import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, TABULAR } from '../../theme/theme';
import { getSubjectSkipBudget } from '../../utils/attendance';
import { shortSubjectName } from '../../utils/subjectName';
import { getTodayKey, formatTimeRange } from '../../utils/dateHelpers';

/**
 * One class on Today. Reads only what the college says — the subject's
 * current numbers and, once the teacher has uploaded it, today's mark — and
 * turns them into the one sentence the student needs.
 */
const ClassCard = ({ classInfo, state, isCurrentClass = false }) => {
    const styles = getStyles();
    const { subjectId, subjectName, startTime, endTime, units } = classInfo;

    const budget = getSubjectSkipBudget(subjectId, state);
    const percentage = budget?.percentage || 0;
    const target = budget?.target || state.settings?.dangerThreshold || 75;

    const todayRecord = state.attendanceRecords?.[getTodayKey(state.devDate)]?.[subjectId];
    const recorded = todayRecord && todayRecord.source === 'erp' && todayRecord.status !== 'cancelled' ? todayRecord : null;

    const isDanger = percentage < target;
    const isEdge = !isDanger && percentage < target + 3;

    // Verdict copy: past tense once the college has recorded today, otherwise
    // the decision for a class that has not happened yet.
    let verdict;
    let verdictTone = 'neutral';
    if (recorded) {
        const attendedUnits = Number(todayRecord.attendedUnits ?? (todayRecord.status === 'present' ? todayRecord.units : 0));
        const total = Number(todayRecord.units || 1);
        if (attendedUnits >= total) { verdict = 'Marked present by your college'; verdictTone = 'good'; }
        else if (attendedUnits === 0) { verdict = 'Marked absent by your college'; verdictTone = 'bad'; }
        else { verdict = `Partly attended · ${attendedUnits} of ${total} hours`; verdictTone = 'warn'; }
    } else if (!budget || budget.totalUnits === 0) {
        verdict = 'No attendance recorded yet';
    } else if (!budget.onTrack) {
        verdict = Number.isFinite(budget.needClasses)
            ? `Attend · ${budget.needClasses} more to reach ${target}%`
            : `Attend · ${target}% is out of reach this term`;
        verdictTone = 'bad';
    } else if (budget.skipUnits >= units) {
        const spare = budget.skipClasses;
        verdict = spare === 1 ? 'Safe to skip · last one to spare' : `Safe to skip · ${spare} to spare`;
        verdictTone = spare <= 1 ? 'warn' : 'good';
    } else {
        verdict = 'Attend · skipping this drops you below goal';
        verdictTone = 'warn';
    }

    const toneColor = verdictTone === 'good' ? COLORS.successText
        : verdictTone === 'bad' ? COLORS.dangerText
            : verdictTone === 'warn' ? COLORS.warningText
                : COLORS.textSecondary;

    const barColor = isDanger ? COLORS.danger : isEdge ? COLORS.warning : COLORS.success;
    const borderColor = recorded
        ? (verdictTone === 'good' ? COLORS.success : verdictTone === 'bad' ? COLORS.danger : COLORS.warning)
        : isCurrentClass ? COLORS.primary : COLORS.border;

    return (
        <View style={[styles.container, { borderColor }, isCurrentClass && styles.currentClassBorder]}>
            <View style={styles.headerRow}>
                <View style={styles.subjectInfo}>
                    <Text style={styles.subjectName} numberOfLines={1} accessibilityLabel={subjectName}>
                        {shortSubjectName(subjectName)}
                    </Text>
                    <View style={styles.timeRow}>
                        <Text style={styles.time}>{formatTimeRange(startTime, endTime)}</Text>
                        {units > 1 && (
                            <View style={styles.durationBadge}>
                                <Text style={styles.durationBadgeText}>{units} HR</Text>
                            </View>
                        )}
                    </View>
                </View>

                {!recorded && isDanger && (
                    <View style={[styles.statusTag, { backgroundColor: COLORS.dangerLight, borderColor: COLORS.danger }]}>
                        <Text style={[styles.statusTagText, { color: COLORS.dangerText }]}>LOW</Text>
                    </View>
                )}
                {!recorded && isEdge && (
                    <View style={[styles.statusTag, { backgroundColor: COLORS.warningLight, borderColor: COLORS.warning }]}>
                        <Text style={[styles.statusTagText, { color: COLORS.warningText }]}>EDGE</Text>
                    </View>
                )}
            </View>

            <View style={styles.progressRow}>
                <View style={styles.progressBarTrack}>
                    <View style={[styles.progressBarFill, { width: `${Math.min(percentage, 100)}%`, backgroundColor: barColor }]} />
                </View>
                <Text style={[styles.percentage, TABULAR, isDanger && { color: COLORS.dangerText }]}>
                    {percentage.toFixed(1)}%
                </Text>
            </View>

            <Text style={[styles.verdict, { color: toneColor }]} numberOfLines={2}>{verdict}</Text>
        </View>
    );
};

const getStyles = () => StyleSheet.create({
    container: {
        backgroundColor: COLORS.cardBackground,
        marginHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.sm,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    currentClassBorder: { borderWidth: 2 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    subjectInfo: { flex: 1 },
    subjectName: { ...TYPOGRAPHY.headingSmall, color: COLORS.textPrimary },
    timeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    time: { ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary },
    durationBadge: {
        backgroundColor: COLORS.inputBackground, paddingHorizontal: 6, paddingVertical: 2,
        borderRadius: 3, marginLeft: SPACING.sm,
    },
    durationBadgeText: { ...TYPOGRAPHY.micro, color: COLORS.textSecondary },
    statusTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: BORDER_RADIUS.sm, borderWidth: 1, marginLeft: SPACING.sm },
    statusTagText: { ...TYPOGRAPHY.micro },
    progressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
    progressBarTrack: { flex: 1, height: 6, backgroundColor: COLORS.inputBackground, borderRadius: 3, marginRight: 10, overflow: 'hidden' },
    progressBarFill: { height: '100%', borderRadius: 3 },
    percentage: { ...TYPOGRAPHY.displaySmall, color: COLORS.textPrimary, minWidth: 52, textAlign: 'right' },
    verdict: { ...TYPOGRAPHY.labelMedium, marginTop: 10 },
});

export default ClassCard;
