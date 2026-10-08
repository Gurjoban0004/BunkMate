import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useApp } from '../../context/AppContext';
import { getTodaySkipPairs, simulateAttendanceImpact } from '../../utils/attendanceImpact';
import { formatTimeRange } from '../../utils/dateHelpers';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, TABULAR } from '../../theme/theme';

const pct = (value) => `${value.toFixed(2)}%`;
const runLabel = (pairs) => pairs === null ? 'Not reachable' : pairs === 0 ? 'Already reached' : `${pairs} ${pairs === 1 ? 'pair' : 'pairs'} · ${pairs * 2} lectures`;

function PairStepper({ value, onChange, label, styles }) {
    return (
        <View style={styles.stepper}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove one pair from ${label}`} accessibilityState={{ disabled: value === 0 }} disabled={value === 0} onPress={() => onChange(value - 1)} style={[styles.stepButton, value === 0 && styles.disabled]}>
                <Text style={styles.stepText}>−</Text>
            </TouchableOpacity>
            <Text style={[styles.count, TABULAR]}>{value}</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Add one pair to ${label}`} onPress={() => onChange(value + 1)} style={styles.stepButton}>
                <Text style={styles.stepText}>+</Text>
            </TouchableOpacity>
        </View>
    );
}

export default function AttendanceImpactCard({ subjectId = null, initialMode = 'custom' }) {
    const { state } = useApp();
    const styles = getStyles();
    const [mode, setMode] = useState(initialMode);
    const [assignSubjects, setAssignSubjects] = useState(!!subjectId);
    const [pairs, setPairs] = useState(1);
    const [subjectPairs, setSubjectPairs] = useState(() => subjectId ? { [subjectId]: 1 } : {});
    // null means all of today's known pairs; an empty selection means skip none.
    const [selectedToday, setSelectedToday] = useState(null);
    const today = getTodaySkipPairs(state).filter((cls) => !subjectId || cls.subjectId === subjectId);
    const todayIds = new Set(selectedToday ?? today.map((cls) => cls.id));
    const scenario = useMemo(() => {
        if (mode === 'today') {
            const selected = new Set(selectedToday);
            const counts = {};
            getTodaySkipPairs(state).forEach((cls) => {
                if ((!subjectId || cls.subjectId === subjectId) && (selectedToday === null || selected.has(cls.id))) counts[cls.subjectId] = (counts[cls.subjectId] || 0) + 1;
            });
            return { subjectPairs: counts };
        }
        return assignSubjects
            ? { subjectPairs: Object.fromEntries(Object.entries(subjectPairs).filter(([id]) => state.subjects.some((s) => s.id === id))) }
            : { unassignedPairs: pairs };
    }, [state, mode, selectedToday, assignSubjects, subjectPairs, pairs, subjectId]);
    const result = useMemo(() => simulateAttendanceImpact(state, scenario), [state, scenario]);
    const subjectResult = result.subjects.find((s) => s.id === subjectId);
    const shownSubjects = subjectId ? result.subjects.filter((s) => s.id === subjectId) : result.subjects;

    const toggleToday = (id) => {
        const next = new Set(todayIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedToday([...next]);
    };

    return (
        <View style={styles.container}>
            <Text accessibilityRole="header" style={styles.title}>Attendance Impact & Recovery</Text>
            <Text style={styles.note}>Preview only. Each class pair is 2 lectures. Your attendance records stay unchanged.</Text>
            {result.conducted === 0 && <Text style={styles.note}>No attendance recorded yet. Sync with your college to see your current totals.</Text>}

            <View style={styles.modeRow}>
                {[['today', 'Skip today’s classes'], ['custom', 'Choose class pairs']].map(([key, label]) => (
                    <TouchableOpacity key={key} accessibilityRole="button" accessibilityState={{ selected: mode === key }} onPress={() => setMode(key)} style={[styles.modeButton, mode === key && styles.activeButton]}>
                        <Text style={[styles.buttonText, mode === key && styles.activeText]}>{label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {mode === 'today' ? (
                today.length ? today.map((cls) => (
                    <TouchableOpacity key={cls.id} accessibilityRole="checkbox" accessibilityState={{ checked: todayIds.has(cls.id) }} accessibilityLabel={`Skip ${cls.subjectName}, ${formatTimeRange(cls.startTime, cls.endTime)}, pair ${cls.pair}`} onPress={() => toggleToday(cls.id)} style={styles.selectionRow}>
                        <View style={styles.flex}>
                            <Text style={styles.body}>{cls.subjectName}</Text>
                            <Text style={styles.note}>{formatTimeRange(cls.startTime, cls.endTime)} · 2 lectures{cls.pairCount > 1 ? ` · pair ${cls.pair} of ${cls.pairCount}` : ''}</Text>
                        </View>
                        <Text style={styles.choice}>{todayIds.has(cls.id) ? 'Selected' : 'Select'}</Text>
                    </TouchableOpacity>
                )) : <Text style={styles.note}>No classes in today’s timetable. Choose class pairs to try a hypothetical skip.</Text>
            ) : (
                <>
                    {!subjectId && <TouchableOpacity accessibilityRole="switch" accessibilityState={{ checked: assignSubjects }} onPress={() => setAssignSubjects(!assignSubjects)} style={styles.selectionRow}>
                        <Text style={styles.body}>Choose specific subjects</Text>
                        <Text style={styles.choice}>{assignSubjects ? 'On' : 'Off'}</Text>
                    </TouchableOpacity>}
                    {assignSubjects ? state.subjects.filter((s) => !subjectId || s.id === subjectId).map((subject) => (
                        <View key={subject.id} style={styles.selectionRow}>
                            <Text style={[styles.body, styles.flex]}>{subject.name}</Text>
                            <PairStepper styles={styles} label={subject.name} value={subjectPairs[subject.id] || 0} onChange={(value) => setSubjectPairs((prev) => ({ ...prev, [subject.id]: value }))} />
                        </View>
                    )) : <View style={styles.selectionRow}>
                        <Text style={[styles.body, styles.flex]}>Pairs to skip</Text>
                        <PairStepper styles={styles} label="combined attendance" value={pairs} onChange={setPairs} />
                    </View>}
                </>
            )}

            <View accessibilityLiveRegion="polite" style={styles.results}>
                <Text style={styles.heading}>Combined across all subjects</Text>
                <Text style={[styles.body, TABULAR]}>Current: {result.attended} / {result.conducted} = {pct(result.percentage)}</Text>
                <Text style={styles.note}>{result.attended} attended · {result.conducted} conducted lectures</Text>
                <Text style={styles.body}>Skipping {result.pairs} {result.pairs === 1 ? 'pair' : 'pairs'} · {result.skipped} lectures</Text>
                <Text style={[styles.result, TABULAR]}>{result.attended} / {result.afterTotal} = {pct(result.afterPercentage)}</Text>
                <Text style={[styles.body, { color: result.change < 0 ? COLORS.dangerText : COLORS.textSecondary }]}>{result.change.toFixed(2)} percentage points</Text>
                {result.unassignedPairs > 0 && <Text style={styles.note}>Combined preview only. Choose subjects to see where the loss happens.</Text>}
                {subjectResult && <Text style={styles.note}>{subjectResult.name}: {subjectResult.attended} / {subjectResult.afterTotal} = {pct(subjectResult.afterPercentage)}</Text>}
            </View>

            <Text accessibilityRole="header" style={styles.heading}>Attend consecutively to recover</Text>
            <Text style={styles.note}>Minimum full pairs from the preview above. Every pair adds 2 attended and 2 conducted lectures.</Text>
            {result.recovery.map((target) => (
                <View key={target.label} style={styles.recoveryRow}>
                    <Text style={[styles.body, styles.flex]}>{target.label}{target.label.startsWith('Previous') && target.targetPercentage !== null ? ` (${pct(target.targetPercentage)})` : ''}</Text>
                    <View style={styles.recoveryValue}>
                        <Text style={styles.body}>{target.pairs === null && target.targetPercentage === null ? 'No previous records' : runLabel(target.pairs)}</Text>
                        {target.pairs > 0 && <Text style={[styles.note, TABULAR]}>{target.attended} / {target.conducted} = {pct(target.attended * 100 / target.conducted)}</Text>}
                    </View>
                </View>
            ))}

            <Text accessibilityRole="header" style={styles.heading}>Subject impact</Text>
            <Text style={styles.note}>Largest percentage-point loss first. Combined attendance does not replace each subject’s requirement.</Text>
            {shownSubjects.map((subject) => (
                <View key={subject.id} style={styles.subjectRow}>
                    <Text style={styles.body}>{subject.name}</Text>
                    <Text style={[styles.note, TABULAR]}>{subject.attended} / {subject.conducted} ({pct(subject.percentage)}) → {subject.attended} / {subject.afterTotal} ({pct(subject.afterPercentage)})</Text>
                    <Text style={styles.note}>{subject.change.toFixed(2)} pp · {subject.skipped} lectures skipped</Text>
                    <Text style={styles.note}>Previous percentage: {subject.recoverPrevious.targetPercentage === null ? 'No previous records' : runLabel(subject.recoverPrevious.pairs)}</Text>
                    <Text style={styles.note}>{subject.requirement}% requirement: {runLabel(subject.recoverRequirement.pairs)}</Text>
                </View>
            ))}
            <TouchableOpacity accessibilityRole="button" onPress={() => { setPairs(0); setSubjectPairs({}); setSelectedToday([]); }} style={styles.reset}>
                <Text style={styles.choice}>Reset preview</Text>
            </TouchableOpacity>
        </View>
    );
}

const getStyles = () => StyleSheet.create({
    container: { backgroundColor: COLORS.cardBackground, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
    title: { ...TYPOGRAPHY.headingMedium, color: COLORS.textPrimary, marginBottom: SPACING.sm },
    heading: { ...TYPOGRAPHY.headingSmall, color: COLORS.textPrimary, marginTop: SPACING.lg, marginBottom: SPACING.sm },
    body: { ...TYPOGRAPHY.bodySmall, color: COLORS.textPrimary, flexShrink: 1 },
    note: { ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary, marginTop: SPACING.xs },
    modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.md, marginBottom: SPACING.sm },
    modeButton: { padding: SPACING.sm, minHeight: 48, justifyContent: 'center', borderRadius: BORDER_RADIUS.sm, backgroundColor: COLORS.inputBackground },
    activeButton: { backgroundColor: COLORS.primary },
    buttonText: { ...TYPOGRAPHY.labelMedium, color: COLORS.textPrimary },
    activeText: { color: COLORS.textOnPrimary },
    selectionRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm, minHeight: 48 },
    choice: { ...TYPOGRAPHY.labelMedium, color: COLORS.primaryDark },
    flex: { flex: 1 },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    stepButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.inputBackground, borderRadius: BORDER_RADIUS.sm },
    stepText: { ...TYPOGRAPHY.headingMedium, color: COLORS.textPrimary },
    count: { ...TYPOGRAPHY.labelLarge, color: COLORS.textPrimary, minWidth: 24, textAlign: 'center' },
    disabled: { opacity: 0.4 },
    results: { paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.xs },
    result: { ...TYPOGRAPHY.headingMedium, color: COLORS.textPrimary, marginTop: SPACING.sm },
    recoveryRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    recoveryValue: { flexShrink: 1, alignItems: 'flex-end', maxWidth: '60%' },
    subjectRow: { paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    reset: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.md },
});
