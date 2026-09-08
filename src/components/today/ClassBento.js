import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { PAPER, TABULAR, SERIF_FONT, subjectTint } from '../../theme/theme';
import { getSubjectSkipBudget } from '../../utils/attendance';
import { shortSubjectName } from '../../utils/subjectName';
import { getTodayKey } from '../../utils/dateHelpers';

/**
 * A class that is not the one happening now — either still to come, or already
 * marked by the college. It carries the same facts the full card does (name,
 * time, room, percentage, and the one-line verdict) at a size that lets two sit
 * side by side.
 *
 * The tile's colour is the SUBJECT's colour, not its position in today's list.
 * It used to cycle sage → apricot → lavender by index, which meant DBMS was
 * green on Monday and apricot on Tuesday — pretty, but it taught the student
 * nothing. Now the same hue follows a subject across the bento, the schedule
 * bar, the subject list and the insights charts (see theme.js §1c), so the
 * colour becomes the subject's identity.
 *
 * A class the college has already marked drops to stone and goes full width:
 * it is history, and history should not compete with the day ahead.
 */

/** "14:00", from the timetable's "14:00" or "14:00:00". */
const hhmm = (t) => String(t || '').slice(0, 5);

export default function ClassBento({ classInfo, state, variant = 'upcoming', wide = false, onPress }) {
    const styles = getStyles();
    const { subjectId, subjectName, startTime, endTime, room } = classInfo;

    const done = variant === 'done';
    // PAPER is a live token map — read it in render, never at module scope.
    const tint = done
        ? { bg: PAPER.stone, ink: PAPER.stoneInk }
        : subjectTint(subjectId, state.subjects);

    const budget = getSubjectSkipBudget(subjectId, state);
    const percentage = budget?.percentage || 0;

    const todayRecord = state.attendanceRecords?.[getTodayKey(state.devDate)]?.[subjectId];
    const recorded = todayRecord && todayRecord.source === 'erp' && todayRecord.status !== 'cancelled' ? todayRecord : null;

    // The bottom-left line. A recorded class states what the college said; one
    // still to come states what skipping it would cost.
    let footnote;
    if (recorded) {
        const units = Number(todayRecord.units || 1);
        const attended = Number(todayRecord.attendedUnits ?? (todayRecord.status === 'present' ? units : 0));
        footnote = attended >= units ? 'Marked present by our college'
            : attended === 0 ? 'Marked absent by our college'
                : `${attended} of ${units} hours`;
    } else if (!budget || budget.totalUnits === 0) {
        footnote = 'No numbers yet';
    } else if (!budget.onTrack) {
        footnote = Number.isFinite(budget.needClasses) ? `${budget.needClasses} to catch up` : 'Below goal';
    } else if (Number.isFinite(budget.skipClasses)) {
        footnote = budget.skipClasses === 1 ? '1 skip left' : `${budget.skipClasses} skips left`;
    } else {
        footnote = 'On track';
    }

    const timeLabel = done
        ? `${hhmm(startTime)} – ${hhmm(endTime)} · COMPLETED`
        : hhmm(startTime);

    return (
        <TouchableOpacity
            style={[
                styles.card,
                { backgroundColor: tint.bg },
                done ? styles.cardDone : styles.cardTall,
                wide && styles.cardWide,
            ]}
            onPress={onPress}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`${subjectName}, ${percentage.toFixed(1)} percent`}
        >
            <Text style={[styles.time, { color: tint.ink }]} numberOfLines={1}>{timeLabel}</Text>
            <Text style={[styles.name, { color: tint.ink }, done && styles.nameDone]} numberOfLines={2}>
                {shortSubjectName(subjectName)}
            </Text>
            {!done && !!room && <Text style={[styles.room, { color: tint.ink }]} numberOfLines={1}>{room}</Text>}

            <View style={[styles.bottom, done && styles.bottomDone]}>
                <Text style={[styles.footnote, { color: tint.ink }]} numberOfLines={1}>{footnote}</Text>
                <Text style={[styles.pct, TABULAR, { color: tint.ink }]}>{percentage.toFixed(1)}%</Text>
            </View>
        </TouchableOpacity>
    );
}

const SERIF = { fontFamily: SERIF_FONT };

const getStyles = () => StyleSheet.create({
    // Two to a row, as in the replica's 2-column grid. `flex: 1` alone would
    // let three tiles share one row; a 45% basis is wider than a third, so the
    // third tile wraps, and flexGrow then fills the row it lands on.
    card: { flexGrow: 1, flexBasis: '45%', padding: 15, borderRadius: 18 },
    cardTall: { minHeight: 145 },
    cardDone: { minHeight: 104 },
    cardWide: { flexBasis: '100%' },
    time: { ...SERIF, fontSize: 12, fontWeight: '700' },
    name: { ...SERIF, fontSize: 16, fontWeight: '700', letterSpacing: -0.3, lineHeight: 17, marginTop: 20 },
    nameDone: { marginTop: 13 },
    room: { ...SERIF, fontSize: 11, marginTop: 5, opacity: 0.8 },
    bottom: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
        marginTop: 'auto', paddingTop: 12,
    },
    bottomDone: { marginTop: 8, paddingTop: 0 },
    footnote: { ...SERIF, fontSize: 10, fontWeight: '700', flexShrink: 1, marginRight: 8 },
    pct: { ...SERIF, fontSize: 16, fontWeight: '700' },
});
