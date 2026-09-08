import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PAPER, TABULAR } from '../../theme/theme';
import { getSubjectSkipBudget } from '../../utils/attendance';
import { shortSubjectName } from '../../utils/subjectName';
import { getTodayKey, formatTimeRange } from '../../utils/dateHelpers';

/**
 * The class happening now. It keeps the dominant surface on Today — every other
 * class of the day compacts into a ClassBento tile — and carries the subject's
 * name, time, percentage and the one sentence the student needs.
 *
 * Styled to ui-lab/today-replica.html's `.now-card`.
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
        if (attendedUnits >= total) { verdict = 'Marked present by our college'; verdictTone = 'good'; }
        else if (attendedUnits === 0) { verdict = 'Marked absent by our college'; verdictTone = 'bad'; }
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

    const toneColor = verdictTone === 'good' ? PAPER.sageInk
        : verdictTone === 'bad' ? PAPER.apricotInk
            : verdictTone === 'warn' ? PAPER.warningInkDeep
                : PAPER.secondary;

    const barColor = isDanger ? PAPER.apricotInk : isEdge ? PAPER.warning : PAPER.successLine;

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <View style={styles.subjectInfo}>
                    <Text style={styles.subjectName} numberOfLines={2} accessibilityLabel={subjectName}>
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

                {!recorded && (isDanger || isEdge) && (
                    <View style={styles.statusTag}>
                        <Text style={styles.statusTagText}>{isDanger ? 'LOW' : 'EDGE'}</Text>
                    </View>
                )}
            </View>

            <View style={styles.progressRow}>
                <View style={styles.progressBarTrack}>
                    <View style={[styles.progressBarFill, { width: `${Math.min(percentage, 100)}%`, backgroundColor: barColor }]} />
                </View>
                <Text style={[styles.percentage, TABULAR, isDanger && styles.percentageRisk]}>
                    {percentage.toFixed(1)}%
                </Text>
            </View>

            <Text style={[styles.verdict, { color: toneColor }]} numberOfLines={2}>{verdict}</Text>
        </View>
    );
};

const SERIF = { fontFamily: 'Times New Roman' };

const getStyles = () => StyleSheet.create({
    container: {
        backgroundColor: PAPER.nowCardBg,
        borderRadius: 18,
        padding: 15,
        borderWidth: 1,
        borderColor: PAPER.nowCardBorder,
    },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
    subjectInfo: { flex: 1, minWidth: 0 },
    subjectName: { ...SERIF, fontSize: 16, fontWeight: '700', letterSpacing: -0.16, color: PAPER.ink },
    timeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    time: { ...SERIF, fontSize: 12, color: PAPER.secondary },
    durationBadge: {
        backgroundColor: PAPER.blockBg, paddingHorizontal: 6, paddingVertical: 2,
        borderRadius: 3, marginLeft: 8,
    },
    durationBadgeText: { ...SERIF, fontSize: 9, fontWeight: '700', letterSpacing: 0.5, color: PAPER.secondary },
    statusTag: {
        alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6,
        borderWidth: 1, borderColor: PAPER.warningLine, backgroundColor: PAPER.warningSoft,
    },
    statusTagText: { ...SERIF, fontSize: 9, fontWeight: '700', color: PAPER.riskInk },
    progressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 10 },
    progressBarTrack: { flex: 1, height: 6, backgroundColor: PAPER.trackBg, borderRadius: 4, overflow: 'hidden' },
    progressBarFill: { height: '100%', borderRadius: 4 },
    percentage: { ...SERIF, fontSize: 18, fontWeight: '700', color: PAPER.ink, minWidth: 46, textAlign: 'right' },
    percentageRisk: { color: PAPER.pctRiskInk },
    verdict: { ...SERIF, fontSize: 11, fontWeight: '700', marginTop: 8 },
});

export default ClassCard;
