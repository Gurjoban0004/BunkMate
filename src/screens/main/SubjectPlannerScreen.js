import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, LayoutAnimation } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import ScreenHeader from '../../components/common/ScreenHeader';
import PlannerCalendar from '../../components/planner/PlannerCalendar';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../../theme/theme';
import { getSubjectPlannerData } from '../../utils/planner/dataAdapter';
import { getPlannableSubjectClasses } from '../../utils/planner/semesterWindow';
import {
    calculatePlannerPercentage,
    simulateAttendance,
    calculateRecoveryClasses,
} from '../../utils/planner/attendanceCalculations';

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function SubjectPlannerScreen({ route }) {
    const styles = getStyles();
    const { subjectId, initialMode } = route.params || {};
    const { state } = useApp();

    const planner = useMemo(() => getSubjectPlannerData(subjectId, state), [subjectId, state]);

    const [mode, setMode] = useState(initialMode === 'attend' ? 'attend' : 'skip');
    const [selected, setSelected] = useState({}); // { [classKey]: true }

    // Upcoming plannable classes (real timetable when present; assumed weekdays otherwise).
    const plannable = useMemo(
        () => getPlannableSubjectClasses(state, subjectId, { maxClasses: 60 }),
        [state, subjectId]
    );
    const isAssumed = plannable.length > 0 && plannable[0].assumed;

    const classesByDateKey = useMemo(() => {
        const map = {};
        for (const cls of plannable) {
            (map[cls.dateKey] = map[cls.dateKey] || []).push(cls);
        }
        return map;
    }, [plannable]);

    if (!planner) {
        return (
            <SafeAreaView style={styles.screen} edges={['bottom']}>
                <ScreenHeader title="Plan classes" />
                <View style={styles.emptyWrap}>
                    <Text style={styles.emptyTitle}>Subject not found</Text>
                </View>
            </SafeAreaView>
        );
    }

    const { attended, total, target, name } = planner;
    const accent = mode === 'skip' ? COLORS.danger : COLORS.success;
    const accentDark = mode === 'skip' ? COLORS.dangerDark : COLORS.successDark;

    // ── Selection → projection ──────────────────────────────────────
    const selectedUnits = plannable.reduce(
        (sum, cls) => (selected[cls.classKey] ? sum + (cls.units || 1) : sum),
        0
    );
    const offset = mode === 'skip' ? -selectedUnits : selectedUnits;

    const currentPercentage = calculatePlannerPercentage(attended, total);
    const simulated = simulateAttendance(attended, total, offset);
    const delta = +(simulated.percentage - currentPercentage).toFixed(1);
    const belowTarget = simulated.percentage < target;

    const toggleDay = (dateKey) => {
        const dayClasses = classesByDateKey[dateKey] || [];
        if (dayClasses.length === 0) return;
        const anySelected = dayClasses.some((c) => selected[c.classKey]);
        setSelected((prev) => {
            const next = { ...prev };
            for (const c of dayClasses) {
                if (anySelected) delete next[c.classKey];
                else next[c.classKey] = true;
            }
            return next;
        });
    };

    const clearAll = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setSelected({});
    };

    const switchMode = (next) => {
        if (next === mode) return;
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setMode(next);
        setSelected({});
    };

    // ── Insight ─────────────────────────────────────────────────────
    const insight = useMemo(() => {
        if (mode === 'skip') {
            if (belowTarget) {
                const recovery = calculateRecoveryClasses(simulated.attended, simulated.total, target);
                return {
                    label: 'Below target',
                    text: recovery
                        ? `You'd need ${recovery.classesNeeded} class${recovery.classesNeeded === 1 ? '' : 'es'} to climb back to ${target}%.`
                        : `This drops you under ${target}%.`,
                    tone: 'danger',
                };
            }
            // Max additional safe skips from the *current* real state.
            let maxSafe = 0;
            while (calculatePlannerPercentage(attended, total + maxSafe + 1) >= target) maxSafe++;
            const remaining = maxSafe - selectedUnits;
            if (remaining > 0) {
                return {
                    label: 'Safe',
                    text: `You can skip ${remaining} more class${remaining === 1 ? '' : 'es'} and stay above ${target}%.`,
                    tone: 'success',
                };
            }
            return {
                label: 'On the edge',
                text: `One more skip drops you below ${target}%.`,
                tone: 'warning',
            };
        }
        // Attend mode
        if (currentPercentage < target && simulated.percentage >= target) {
            return {
                label: 'Recovered',
                text: `Attending these ${selectedUnits} get${selectedUnits === 1 ? 's' : ''} you back to ${target}%.`,
                tone: 'success',
            };
        }
        const plusOne = simulateAttendance(simulated.attended, simulated.total, 1);
        const gain = (plusOne.percentage - simulated.percentage).toFixed(1);
        return {
            label: 'Climbing',
            text: selectedUnits > 0
                ? `Each attended class adds about +${gain}% from here.`
                : `Tap upcoming classes you plan to attend.`,
            tone: 'success',
        };
    }, [mode, belowTarget, simulated, target, attended, total, selectedUnits, currentPercentage]);

    const toneColor = {
        success: COLORS.successDark,
        danger: COLORS.dangerDark,
        warning: COLORS.warningDark,
    }[insight.tone];

    // ── Week strip (next 7 days) ────────────────────────────────────
    const weekStrip = useMemo(() => {
        const out = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        for (let i = 0; i < 7; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            const dateKey = toKey(d);
            const dayClasses = classesByDateKey[dateKey] || [];
            const selCount = dayClasses.filter((c) => selected[c.classKey]).length;
            out.push({
                key: dateKey,
                dayName: WEEKDAY_SHORT[d.getDay()],
                date: d.getDate(),
                isToday: i === 0,
                plannable: dayClasses.length > 0,
                selected: selCount > 0,
            });
        }
        return out;
    }, [classesByDateKey, selected]);

    // ── Selected summary ────────────────────────────────────────────
    const selectedList = useMemo(
        () => plannable
            .filter((c) => selected[c.classKey])
            .sort((a, b) => a.date - b.date),
        [plannable, selected]
    );

    const verb = mode === 'skip' ? 'Skipping' : 'Attending';
    const hasPlannable = plannable.length > 0;

    return (
        <SafeAreaView style={styles.screen} edges={['bottom']}>
            <ScreenHeader title={name} />
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* Mode toggle */}
                <View style={styles.modeSwitch}>
                    <TouchableOpacity
                        style={[styles.modeBtn, mode === 'skip' && [styles.modeBtnActive, { borderColor: COLORS.danger }]]}
                        onPress={() => switchMode('skip')}
                        accessibilityRole="button"
                        accessibilityState={{ selected: mode === 'skip' }}
                    >
                        <Text style={[styles.modeBtnText, mode === 'skip' && { color: COLORS.dangerDark }]}>Plan skips</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.modeBtn, mode === 'attend' && [styles.modeBtnActive, { borderColor: COLORS.success }]]}
                        onPress={() => switchMode('attend')}
                        accessibilityRole="button"
                        accessibilityState={{ selected: mode === 'attend' }}
                    >
                        <Text style={[styles.modeBtnText, mode === 'attend' && { color: COLORS.successDark }]}>Plan attendance</Text>
                    </TouchableOpacity>
                </View>

                {/* Projection — the number is the hero */}
                <View style={styles.projection}>
                    <View style={styles.projRow}>
                        <View style={styles.projCol}>
                            <Text style={styles.projLabel}>Now</Text>
                            <Text style={styles.projNow}>{currentPercentage.toFixed(1)}%</Text>
                        </View>
                        <Text style={styles.projArrow}>→</Text>
                        <View style={[styles.projCol, styles.projColEnd]}>
                            <Text style={styles.projLabel}>Projected</Text>
                            <Text style={[styles.projValue, { color: belowTarget ? COLORS.dangerDark : COLORS.textPrimary }]}>
                                {simulated.percentage.toFixed(1)}%
                            </Text>
                        </View>
                    </View>

                    {/* Progress bar with target marker */}
                    <View style={styles.progressBg}>
                        <View
                            style={[
                                styles.progressFill,
                                { width: `${Math.min(100, simulated.percentage)}%`, backgroundColor: belowTarget ? COLORS.danger : COLORS.success },
                            ]}
                        />
                        <View style={[styles.targetMarker, { left: `${Math.min(100, target)}%` }]} />
                    </View>
                    <View style={styles.progressLabels}>
                        <Text style={styles.progressLabel}>{verb} {selectedUnits} class{selectedUnits === 1 ? '' : 'es'}</Text>
                        <Text style={styles.progressLabel}>Target {target}%</Text>
                    </View>

                    {selectedUnits > 0 && (
                        <View style={[styles.deltaChip, { backgroundColor: delta < 0 ? COLORS.dangerLight : COLORS.successLight }]}>
                            <Text style={[styles.deltaChipText, { color: delta < 0 ? COLORS.dangerDark : COLORS.successDark }]}>
                                {delta > 0 ? '+' : ''}{delta}% vs now
                            </Text>
                        </View>
                    )}
                </View>

                {/* Insight */}
                <View style={styles.insightPill}>
                    <View style={[styles.insightDot, { backgroundColor: toneColor }]} />
                    <Text style={styles.insightText}>
                        <Text style={{ color: toneColor, fontWeight: '700' }}>{insight.label} · </Text>
                        {insight.text}
                    </Text>
                </View>

                {hasPlannable ? (
                    <>
                        {/* Week strip */}
                        <Text style={styles.sectionLabel}>This week</Text>
                        <View style={styles.weekStrip}>
                            {weekStrip.map((d) => (
                                <TouchableOpacity
                                    key={d.key}
                                    style={[
                                        styles.weekCell,
                                        d.isToday && styles.weekCellToday,
                                        d.selected && { backgroundColor: mode === 'skip' ? COLORS.dangerLight : COLORS.successLight, borderColor: accent },
                                    ]}
                                    disabled={!d.plannable}
                                    activeOpacity={d.plannable ? 0.6 : 1}
                                    onPress={() => toggleDay(d.key)}
                                >
                                    <Text style={[styles.weekDay, d.selected && { color: accentDark }]}>{d.dayName}</Text>
                                    <Text style={[styles.weekDate, d.selected && { color: accentDark, fontWeight: '800' }, !d.plannable && { color: COLORS.textMuted }]}>
                                        {d.date}
                                    </Text>
                                    <View style={[
                                        styles.weekTick,
                                        d.selected ? { backgroundColor: accent } : d.plannable ? styles.weekTickPlannable : styles.weekTickEmpty,
                                    ]} />
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Calendar */}
                        <Text style={styles.sectionLabel}>Pick classes to {mode === 'skip' ? 'skip' : 'attend'}</Text>
                        <View style={styles.calendarCard}>
                            <PlannerCalendar
                                state={state}
                                subjectId={subjectId}
                                mode={mode}
                                classesByDateKey={classesByDateKey}
                                selectedKeys={selected}
                                onToggleDay={toggleDay}
                            />
                        </View>

                        {/* Assumed-schedule disclosure */}
                        {isAssumed && (
                            <View style={styles.note}>
                                <Text style={styles.noteText}>
                                    Assuming one class on each weekday. Connect your timetable to plan exact slots and periods.
                                </Text>
                            </View>
                        )}

                        {/* Selected summary */}
                        {selectedList.length > 0 && (
                            <View style={styles.summary}>
                                <View style={styles.summaryHeader}>
                                    <Text style={styles.summaryTitle}>{verb} {selectedList.length} class{selectedList.length === 1 ? '' : 'es'}</Text>
                                    <TouchableOpacity onPress={clearAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                        <Text style={styles.clearText}>Clear</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.chipWrap}>
                                    {selectedList.map((c) => (
                                        <TouchableOpacity
                                            key={c.classKey}
                                            style={[styles.chip, { backgroundColor: mode === 'skip' ? COLORS.dangerLight : COLORS.successLight, borderColor: accent }]}
                                            onPress={() => toggleDay(c.dateKey)}
                                            accessibilityLabel={`Remove ${c.dayName} ${c.date.getDate()}`}
                                        >
                                            <Text style={[styles.chipText, { color: accentDark }]}>
                                                {WEEKDAY_SHORT[c.date.getDay()]} {c.date.getDate()}
                                            </Text>
                                            <Text style={[styles.chipX, { color: accentDark }]}>×</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}
                    </>
                ) : (
                    <View style={styles.emptyWrap}>
                        <Text style={styles.emptyTitle}>No upcoming classes to plan</Text>
                        <Text style={styles.emptyBody}>
                            {planner.semesterEndDate
                                ? 'There are no class days left in your semester window.'
                                : 'Set a semester end date in settings, or connect your timetable, to plan upcoming classes.'}
                        </Text>
                    </View>
                )}

                <View style={{ height: SPACING.xl }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const getStyles = () => StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        padding: SPACING.screenPadding,
        paddingTop: SPACING.md,
    },
    // Mode toggle
    modeSwitch: {
        flexDirection: 'row',
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.full,
        padding: 4,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: SPACING.lg,
    },
    modeBtn: {
        flex: 1,
        paddingVertical: 9,
        borderRadius: BORDER_RADIUS.full,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'transparent',
    },
    modeBtnActive: {
        backgroundColor: COLORS.cardBackground,
        ...SHADOWS.small,
    },
    modeBtnText: {
        ...TYPOGRAPHY.labelMedium,
        color: COLORS.textMuted,
    },
    // Projection
    projection: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: SPACING.md,
        ...SHADOWS.small,
    },
    projRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: SPACING.md,
    },
    projCol: {
        alignItems: 'flex-start',
    },
    projColEnd: {
        alignItems: 'flex-end',
    },
    projLabel: {
        ...TYPOGRAPHY.captionMedium,
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        marginBottom: 2,
    },
    projNow: {
        ...TYPOGRAPHY.displaySmall,
        color: COLORS.textSecondary,
    },
    projValue: {
        fontSize: 40,
        lineHeight: 44,
        fontWeight: '800',
        color: COLORS.textPrimary,
    },
    projArrow: {
        fontSize: 22,
        color: COLORS.textMuted,
        marginTop: 14,
    },
    progressBg: {
        height: 8,
        backgroundColor: COLORS.inputBackground,
        borderRadius: 4,
        position: 'relative',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 4,
    },
    targetMarker: {
        position: 'absolute',
        top: -2,
        bottom: -2,
        width: 2,
        backgroundColor: COLORS.textSecondary,
        borderRadius: 1,
    },
    progressLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: SPACING.sm,
    },
    progressLabel: {
        ...TYPOGRAPHY.captionMedium,
        color: COLORS.textMuted,
    },
    deltaChip: {
        alignSelf: 'flex-start',
        marginTop: SPACING.md,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.full,
    },
    deltaChipText: {
        ...TYPOGRAPHY.labelSmall,
    },
    // Insight
    insightPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.cardBackground,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: BORDER_RADIUS.md,
        gap: SPACING.sm,
        marginBottom: SPACING.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    insightDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
    },
    insightText: {
        ...TYPOGRAPHY.bodySmall,
        color: COLORS.textSecondary,
        flex: 1,
    },
    sectionLabel: {
        ...TYPOGRAPHY.labelMedium,
        color: COLORS.textSecondary,
        marginBottom: SPACING.sm,
    },
    // Week strip
    weekStrip: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: SPACING.lg,
    },
    weekCell: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.cardBackground,
    },
    weekCellToday: {
        borderColor: COLORS.primary,
    },
    weekDay: {
        ...TYPOGRAPHY.captionSmall,
        color: COLORS.textMuted,
        textTransform: 'uppercase',
    },
    weekDate: {
        ...TYPOGRAPHY.headingSmall,
        color: COLORS.textPrimary,
        marginVertical: 2,
    },
    weekTick: {
        width: 5,
        height: 5,
        borderRadius: 3,
    },
    weekTickPlannable: {
        backgroundColor: COLORS.textMuted,
        opacity: 0.45,
    },
    weekTickEmpty: {
        backgroundColor: 'transparent',
    },
    // Calendar
    calendarCard: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: SPACING.md,
        ...SHADOWS.small,
    },
    // Assumed note
    note: {
        backgroundColor: COLORS.primaryLight,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        marginBottom: SPACING.md,
    },
    noteText: {
        ...TYPOGRAPHY.captionLarge,
        color: COLORS.primaryDark,
        lineHeight: 18,
    },
    // Summary
    summary: {
        marginTop: SPACING.xs,
    },
    summaryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    summaryTitle: {
        ...TYPOGRAPHY.headingSmall,
        color: COLORS.textPrimary,
    },
    clearText: {
        ...TYPOGRAPHY.labelSmall,
        color: COLORS.primary,
    },
    chipWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: BORDER_RADIUS.full,
        borderWidth: 1,
        gap: 6,
    },
    chipText: {
        ...TYPOGRAPHY.labelSmall,
    },
    chipX: {
        fontSize: 14,
        fontWeight: '700',
        marginTop: -1,
    },
    // Empty / error
    emptyWrap: {
        alignItems: 'center',
        paddingVertical: SPACING.xxl,
        paddingHorizontal: SPACING.lg,
    },
    emptyTitle: {
        ...TYPOGRAPHY.headingMedium,
        color: COLORS.textPrimary,
        marginBottom: SPACING.sm,
        textAlign: 'center',
    },
    emptyBody: {
        ...TYPOGRAPHY.bodyMedium,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },
});
