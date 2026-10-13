import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import Svg, { Line, Circle, Path } from 'react-native-svg';
import { useApp } from '../../context/AppContext';
import { PAPER, COLORS, SERIF_FONT, subjectTint } from '../../theme/theme';
import { buildCombinedSkipPlan, projectCombinedSkipPlan } from '../../utils/planner/combinedSkipPlan';
import { parseLocalDate, toPlannerDateKey } from '../../utils/planner/semesterWindow';
import { formatTimeRange } from '../../utils/dateHelpers';
import { shortSubjectName } from '../../utils/subjectName';

const pct = (value) => `${value.toFixed(1)}%`;
const dateLabel = (key) => parseLocalDate(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const monthKey = (key) => key.slice(0, 7);
function Icon({ name, color = COLORS.textPrimary }) {
    const paths = { left: 'M13 4l-6 6 6 6', right: 'M7 4l6 6-6 6', plus: 'M4 10h12M10 4v12', minus: 'M4 10h12',
        attend: 'M4 10l4 4 8-8', skip: 'M5 5l10 10M15 5L5 15', expand: 'M4 7l6 6 6-6' };
    return <Svg width={20} height={20} viewBox="0 0 20 20"><Path d={paths[name]} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function Comparison({ current, projected, target, color }) {
    const x = (value) => 6 + Math.max(0, Math.min(value, 100)) * 3.08;
    return <Svg width="100%" height={24} viewBox="0 0 320 24" accessible={false}>
        <Line x1={6} x2={314} y1={12} y2={12} stroke={PAPER.trackBg} strokeWidth={6} strokeLinecap="round" />
        <Line x1={x(current)} x2={x(projected)} y1={12} y2={12} stroke={color} strokeWidth={6} strokeLinecap="round" />
        {target !== undefined && <Line x1={x(target)} x2={x(target)} y1={2} y2={22} stroke={COLORS.textSecondary} strokeWidth={1} strokeDasharray="2 2" />}
        <Circle cx={x(current)} cy={12} r={4} fill={PAPER.surface} stroke={color} strokeWidth={1.5} />
        <Circle cx={x(projected)} cy={12} r={5} fill={color} />
    </Svg>;
}

export default function CombinedSkipPlanner({ navigation, initialSubjectId }) {
    const { state, triggerErpSync, isErpSyncing } = useApp();
    const [budget, setBudget] = useState('2');
    const [weeks, setWeeks] = useState(4);
    const [showWindow, setShowWindow] = useState(false);
    const [manualIds, setManualIds] = useState(null);
    const [weekIndex, setWeekIndex] = useState(0);
    const [calendarMode, setCalendarMode] = useState('week');
    const [month, setMonth] = useState(null);
    const [selectedDay, setSelectedDay] = useState(null);
    const [subjectFilter, setSubjectFilter] = useState(initialSubjectId || null);
    const [details, setDetails] = useState(false);
    const touchSize = Platform.OS === 'android' ? 48 : 44;
    const styles = getStyles(touchSize);
    const { width } = useWindowDimensions();
    const calendarWidth = Math.max(7 * (touchSize + 2), Math.min(width, 720) - 40);
    const validBudget = /^\d+$/.test(budget) && Number.isSafeInteger(Number(budget));
    const today = toPlannerDateKey(state.devDate || new Date());
    const auto = useMemo(() => buildCombinedSkipPlan(state, { pairsPerWeek: validBudget ? Number(budget) : 0, weeks }), [state, budget, validBudget, weeks, today]);
    const autoIds = useMemo(() => auto.weeks.flatMap((week) => week.classes.filter((cls) => cls.action === 'skip').map((cls) => cls.id)), [auto]);
    const availableIds = useMemo(() => new Set(auto.weeks.flatMap((week) => week.classes.map((cls) => cls.id))), [auto]);
    const plan = useMemo(() => projectCombinedSkipPlan(auto, auto.warnings.length ? [] : manualIds === null ? autoIds : manualIds.filter((id) => availableIds.has(id))), [auto, autoIds, manualIds, availableIds]);
    useEffect(() => { setManualIds(null); setWeekIndex((index) => Math.min(index, Math.max(0, auto.weeks.length - 1))); }, [auto]);
    useEffect(() => { setSubjectFilter(initialSubjectId || null); }, [initialSubjectId]);
    const events = plan.weeks.flatMap((week) => week.classes);
    const visibleEvents = events.filter((cls) => !subjectFilter || cls.subjectId === subjectFilter);
    const week = plan.weeks[weekIndex];
    const activeMonth = month && month >= monthKey(plan.startDate) && month <= monthKey(plan.endDate) ? month : monthKey(week?.classes[0]?.dateKey || plan.startDate);
    const pageEvents = calendarMode === 'month' ? visibleEvents.filter((cls) => monthKey(cls.dateKey) === activeMonth) : (week?.classes || []).filter((cls) => !subjectFilter || cls.subjectId === subjectFilter);
    const fallbackDay = calendarMode === 'month' ? `${activeMonth}-01` : week?.key || plan.startDate;
    const firstDay = pageEvents.find((cls) => cls.action === 'skip')?.dateKey || pageEvents[0]?.dateKey || (fallbackDay < plan.startDate ? plan.startDate : fallbackDay);
    const focusDay = selectedDay && selectedDay >= plan.startDate && selectedDay <= plan.endDate ? selectedDay : firstDay;
    const firstMonthDate = parseLocalDate(`${activeMonth}-01`);
    const monthPadding = (firstMonthDate.getDay() + 6) % 7;
    const monthCount = new Date(firstMonthDate.getFullYear(), firstMonthDate.getMonth() + 1, 0).getDate();
    const cells = calendarMode === 'month'
        ? Array.from({ length: Math.ceil((monthPadding + monthCount) / 7) * 7 }, (_, index) => index < monthPadding || index >= monthPadding + monthCount ? null : `${activeMonth}-${String(index - monthPadding + 1).padStart(2, '0')}`)
        : week ? Array.from({ length: 7 }, (_, index) => { const date = parseLocalDate(week.key); date.setDate(date.getDate() + index); return toPlannerDateKey(date); }) : [];
    const dayEvents = visibleEvents.filter((cls) => cls.dateKey === focusDay);
    const weekForDay = (key) => Math.max(0, plan.weeks.findIndex((item) => {
        const sunday = parseLocalDate(item.key); sunday.setDate(sunday.getDate() + 6);
        return key >= item.key && key <= toPlannerDateKey(sunday);
    }));
    const focusedWeek = plan.weeks[weekForDay(focusDay)] || week;
    const risky = plan.subjects.filter((subject) => subject.unsafeSkips || subject.belowTarget);
    const overBudget = plan.weeks.some((item) => item.overBudget);
    const paused = !!plan.warnings.length || !validBudget || !plan.subjects.length;
    const shift = (delta) => {
        setSelectedDay(null);
        if (calendarMode === 'week') setWeekIndex(weekIndex + delta);
        else { const date = parseLocalDate(`${activeMonth}-01`); date.setMonth(date.getMonth() + delta); setMonth(monthKey(toPlannerDateKey(date))); }
    };
    const atStart = calendarMode === 'week' ? weekIndex === 0 : activeMonth <= monthKey(plan.startDate);
    const atEnd = calendarMode === 'week' ? weekIndex >= plan.weeks.length - 1 : activeMonth >= monthKey(plan.endDate);
    const toggle = (cls) => {
        setSelectedDay(cls.dateKey);
        setManualIds((previous) => { const next = new Set(previous ?? autoIds); if (next.has(cls.id)) next.delete(cls.id); else next.add(cls.id); return [...next]; });
    };

    return <View style={styles.root}>
        <Text accessibilityRole="header" style={styles.title}>Play out your week</Text>
        <Text style={styles.caption}>Tap a day, then a class to try a skip.</Text>
        <View style={styles.tools}>
            <View style={styles.stepper}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="One fewer skip pair per week" disabled={!validBudget || Number(budget) === 0} onPress={() => setBudget(String(Number(budget) - 1))} style={[styles.iconButton, (!validBudget || Number(budget) === 0) && styles.dim]}><Icon name="minus" /></TouchableOpacity>
                <TextInput accessibilityLabel="Skip pairs per week" aria-invalid={!validBudget} value={budget} onChangeText={setBudget} keyboardType="number-pad" selectTextOnFocus style={styles.budget} />
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="One more skip pair per week" disabled={!validBudget || Number(budget) === Number.MAX_SAFE_INTEGER} onPress={() => setBudget(String(Number(budget) + 1))} style={styles.iconButton}><Icon name="plus" /></TouchableOpacity>
            </View>
            <Text style={styles.caption}>pairs / week</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Generate balanced auto plan" disabled={paused} onPress={() => setManualIds(null)} style={[styles.autoButton, paused && styles.dim]}><Text style={styles.autoText}>Auto plan</Text></TouchableOpacity>
        </View>
        {!validBudget && <Text accessibilityRole="alert" style={styles.warning}>Use a whole number, 0 or more.</Text>}
        <View style={styles.calendarToolbar}>
            <View style={styles.modeSwitch}>{['week', 'month'].map((mode) => <TouchableOpacity key={mode} accessibilityRole="button" accessibilityLabel={`Show ${mode} calendar`} accessibilityState={{ selected: calendarMode === mode }} aria-pressed={calendarMode === mode} onPress={() => { if (mode === 'week') setWeekIndex(weekForDay(focusDay)); setCalendarMode(mode); setMonth(monthKey(focusDay)); }} style={[styles.mode, calendarMode === mode && styles.modeOn]}><Text style={styles.caption}>{mode === 'week' ? 'Week' : 'Month'}</Text></TouchableOpacity>)}</View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Choose plan window" accessibilityState={{ expanded: showWindow }} aria-expanded={showWindow} onPress={() => setShowWindow(!showWindow)} style={styles.windowButton}><Text style={styles.caption}>{weeks} weeks ahead</Text><Icon name="expand" /></TouchableOpacity>
        </View>
        {showWindow && <View style={styles.windows}>{[1, 2, 4, 8].map((value) => <TouchableOpacity key={value} accessibilityRole="button" accessibilityLabel={`Plan ${value} weeks`} accessibilityState={{ selected: weeks === value }} onPress={() => { setWeeks(value); setShowWindow(false); setSelectedDay(null); }} style={[styles.windowChoice, weeks === value && styles.modeOn]}><Text style={styles.body}>{value}w</Text></TouchableOpacity>)}</View>}

        <View style={styles.calendar}>
            <View style={styles.monthNav}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Previous calendar page" disabled={atStart} onPress={() => shift(-1)} style={[styles.iconButton, atStart && styles.dim]}><Icon name="left" /></TouchableOpacity>
                <Text style={styles.heading}>{calendarMode === 'month' ? firstMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : week ? `${dateLabel(week.key)} — ${dateLabel(cells[6])}` : 'No upcoming classes'}</Text>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Next calendar page" disabled={atEnd} onPress={() => shift(1)} style={[styles.iconButton, atEnd && styles.dim]}><Icon name="right" /></TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={{ width: calendarWidth }}>
            <View style={styles.grid}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <Text key={index} style={styles.dayHeader}>{day}</Text>)}</View>
            <View style={styles.grid}>{cells.map((key, index) => {
                if (!key) return <View key={`pad-${index}`} style={styles.cell} />;
                const classes = visibleEvents.filter((cls) => cls.dateKey === key);
                const skips = classes.filter((cls) => cls.action === 'skip');
                const disabled = key < plan.startDate || key > plan.endDate;
                const focused = key === focusDay;
                return <View key={key} style={styles.cell}><TouchableOpacity accessibilityRole="button" accessibilityLabel={`${dateLabel(key)}, ${classes.length} scheduled classes, ${skips.reduce((sum, cls) => sum + cls.pairs, 0)} skip pairs`} accessibilityState={{ selected: focused, disabled }} aria-pressed={focused} disabled={disabled} onPress={() => { setSelectedDay(key); if (calendarMode === 'month') setWeekIndex(weekForDay(key)); }} style={[styles.day, classes.length > 0 && styles.classDay, skips.length > 0 && styles.skipDay, focused && styles.focusDay, disabled && styles.dim]}>
                    <Text style={[styles.dayNumber, focused && styles.focusText]}>{parseLocalDate(key).getDate()}</Text>
                    <View style={styles.marks}>{classes.map((cls) => <View key={cls.id} style={[styles.mark, { backgroundColor: focused ? COLORS.background : subjectTint(cls.subjectId, state.subjects).accent }, cls.action === 'skip' && styles.skipMark, cls.unsafe && { backgroundColor: COLORS.dangerText }]} />)}</View>
                </TouchableOpacity></View>;
            })}</View>
            </View></ScrollView>
            <View style={styles.calendarFooter}><View style={styles.legend}><View style={[styles.mark, { backgroundColor: COLORS.textSecondary }]} /><Text style={styles.caption}>Attend</Text><View style={[styles.mark, styles.skipMark, { backgroundColor: COLORS.textPrimary }]} /><Text style={styles.caption}>Skip</Text></View><Text style={styles.caption}>{focusedWeek ? `${focusedWeek.skippedPairs}/${budget} this week` : 'No classes'}</Text></View>
        </View>

        <View accessibilityLiveRegion="polite" style={[styles.live, { backgroundColor: risky.length || paused ? COLORS.warningLight : COLORS.successLight }]}>
            <View style={styles.liveHeading}><Text style={styles.body}>{paused ? 'Preview paused' : risky.length ? `${risky.length} ${risky.length === 1 ? 'subject needs' : 'subjects need'} attention` : overBudget ? 'Over your weekly budget' : 'Within every subject’s minimum'}</Text><Text style={styles.value}>{pct(plan.overall.currentPercentage)} → {pct(plan.overall.projectedPercentage)}</Text></View>
            <Comparison current={plan.overall.currentPercentage} projected={plan.overall.projectedPercentage} color={risky.length ? COLORS.dangerText : COLORS.successDark} />
            <Text style={styles.caption}>Combined · projected through {dateLabel(plan.endDate)}</Text>
        </View>
        {plan.warnings.length > 0 && <View style={styles.notice}><Text style={styles.warning}>{plan.warnings[0]}</Text><View style={styles.tools}><TouchableOpacity accessibilityRole="button" disabled={!triggerErpSync || isErpSyncing} onPress={() => triggerErpSync?.(true)} style={styles.textButton}><Text style={styles.body}>{isErpSyncing ? 'Syncing…' : 'Sync records'}</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" onPress={() => navigation?.navigate('EditTimetable')} style={styles.textButton}><Text style={styles.body}>Fix timetable</Text></TouchableOpacity></View></View>}
        {risky.length > 0 && <Text accessibilityRole="alert" style={styles.warning}>{risky.map((subject) => shortSubjectName(subject.name)).join(', ')}: a skip crosses the minimum or the final projection is below it. Try Auto plan or attend more classes.</Text>}
        {overBudget && <Text style={styles.warning}>Your choices exceed the weekly budget. Auto plan brings them back within it.</Text>}

        <View style={styles.dayTitle}><Text accessibilityRole="header" style={styles.heading}>{parseLocalDate(focusDay).toLocaleDateString('en-US', { weekday: 'long' })} · {dateLabel(focusDay)}</Text>{subjectFilter && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Show all subjects" onPress={() => setSubjectFilter(null)} style={styles.textButton}><Text style={styles.caption}>All subjects</Text></TouchableOpacity>}</View>
        {dayEvents.length ? dayEvents.map((cls) => {
            const tint = subjectTint(cls.subjectId, state.subjects), skipped = cls.action === 'skip';
            return <TouchableOpacity key={cls.id} accessibilityRole="checkbox" accessibilityLabel={`Skip ${cls.subjectName} on ${cls.dateKey} at ${cls.startTime}, ${cls.pairs} full pairs`} accessibilityState={{ checked: skipped, disabled: paused }} aria-checked={skipped} disabled={paused} onPress={() => toggle(cls)} style={[styles.classTile, { backgroundColor: tint.bg }, cls.unsafe && { borderColor: COLORS.dangerText }]}>
                <View style={styles.className}><Text style={styles.heading}>{shortSubjectName(cls.subjectName)}</Text><Text style={styles.caption}>{formatTimeRange(cls.startTime, cls.endTime)} · {cls.units} lectures</Text></View>
                <View style={[styles.choice, skipped && styles.choiceOn]}><Icon name={skipped ? 'skip' : 'attend'} color={skipped ? COLORS.background : COLORS.textPrimary} /><Text style={[styles.choiceText, skipped && styles.focusText]}>{skipped ? 'Skip' : 'Attend'}</Text></View>
            </TouchableOpacity>;
        }) : <Text style={styles.empty}>{subjectFilter ? 'No classes for this subject on this day.' : 'No timetable classes on this day.'}</Text>}
        <Text style={styles.caption}>Each tap changes a full class block. Preview only.</Text>

        <View style={styles.balanceHeading}><Text accessibilityRole="header" style={styles.heading}>Your subjects</Text><Text style={styles.caption}>Tap to focus the calendar</Text></View>
        {plan.subjects.map((subject) => {
            const tint = subjectTint(subject.id, state.subjects), unsafe = subject.unsafeSkips || subject.belowTarget;
            return <View key={subject.id} style={styles.subject}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Focus calendar on ${subject.name}`} accessibilityState={{ selected: subjectFilter === subject.id }} aria-pressed={subjectFilter === subject.id} onPress={() => { setSubjectFilter(subjectFilter === subject.id ? null : subject.id); setSelectedDay(null); }} style={[styles.subjectFocus, subjectFilter === subject.id && { backgroundColor: tint.bg }]}>
                    <View style={styles.subjectLine}><View style={[styles.swatch, { backgroundColor: tint.accent }]} /><Text style={[styles.body, styles.className]}>{shortSubjectName(subject.name)}</Text><Text style={[styles.value, unsafe && { color: COLORS.dangerText }]}>{pct(subject.currentPercentage)} → {pct(subject.projectedPercentage)}</Text></View>
                    <Comparison current={subject.currentPercentage} projected={subject.projectedPercentage} target={subject.target} color={unsafe ? COLORS.dangerText : tint.accent} />
                    <View style={styles.subjectLine}><Text style={styles.caption}>{subject.skipNowPairs === null ? 'No minimum' : `${subject.skipNowPairs} can skip now`} · {subject.skippedPairs} planned</Text><Text style={styles.caption}>{subject.target}% minimum</Text></View>
                </TouchableOpacity>
            </View>;
        })}
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: details }} aria-expanded={details} onPress={() => setDetails(!details)} style={styles.detailsButton}><Text style={styles.body}>Numbers & recovery</Text><Icon name="expand" /></TouchableOpacity>
        {details && <View style={styles.exact}>
            <Text style={styles.body}>Recorded {plan.overall.attended}/{plan.overall.conducted} · projected {plan.overall.projectedA}/{plan.overall.projectedT} lectures</Text>
            <Text style={styles.caption}>Consecutive pairs to recover after this plan</Text>
            <View style={styles.recovery}>{plan.overall.recovery.map((target) => <View key={target.label} style={styles.recoveryItem}><Text style={styles.caption}>{target.label}</Text><Text style={styles.heading}>{target.pairs === null ? 'Unreachable' : `${target.pairs} pairs`}</Text></View>)}</View>
            {plan.subjects.map((subject) => <View key={subject.id} style={styles.recoveryItem}><Text style={styles.body}>{shortSubjectName(subject.name)}: {subject.recordedA}/{subject.recordedT} → {subject.a}/{subject.t} lectures</Text><Text style={styles.caption}>Previous percentage: {subject.recoverPreviousPairs === null ? 'unreachable with full pairs' : `${subject.recoverPreviousPairs} recovery pairs`}</Text></View>)}
        </View>}
        <Text style={styles.assumptions}>Starts tomorrow. Attend the other classes; sync before relying on the plan.{plan.reservedPairs ? ` ${plan.reservedPairs} unpublished pairs are reserved as missed.` : ''} Holidays and your term end apply.</Text>
    </View>;
}

const getStyles = (touchSize) => StyleSheet.create({
    root: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 16 },
    title: { fontFamily: SERIF_FONT, fontSize: 22, lineHeight: 28, fontWeight: '700', color: COLORS.textPrimary },
    heading: { fontFamily: SERIF_FONT, fontSize: 17, lineHeight: 23, fontWeight: '700', color: COLORS.textPrimary },
    body: { fontFamily: SERIF_FONT, fontSize: 15, lineHeight: 21, color: COLORS.textPrimary },
    caption: { fontFamily: SERIF_FONT, fontSize: 13, lineHeight: 18, color: COLORS.textSecondary },
    value: { fontFamily: SERIF_FONT, fontSize: 15, lineHeight: 21, fontWeight: '700', color: COLORS.textPrimary },
    tools: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 12 },
    stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: PAPER.trackBg, borderRadius: 12 },
    iconButton: { width: touchSize, height: touchSize, alignItems: 'center', justifyContent: 'center' },
    budget: { fontFamily: SERIF_FONT, fontSize: 17, fontWeight: '700', textAlign: 'center', color: COLORS.textPrimary, width: 48, minHeight: touchSize, padding: 0 },
    autoButton: { minHeight: touchSize, paddingHorizontal: 14, borderRadius: 12, backgroundColor: COLORS.textPrimary, justifyContent: 'center', marginLeft: 'auto' },
    autoText: { fontFamily: SERIF_FONT, fontSize: 15, lineHeight: 21, color: COLORS.background, fontWeight: '700' },
    calendarToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
    modeSwitch: { flexDirection: 'row', padding: 3, borderRadius: 12, backgroundColor: PAPER.trackBg },
    mode: { minHeight: touchSize, minWidth: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
    modeOn: { backgroundColor: PAPER.surface },
    windowButton: { minHeight: touchSize, flexDirection: 'row', alignItems: 'center', gap: 8 },
    windows: { flexDirection: 'row', gap: 8, marginTop: 8 },
    windowChoice: { minHeight: touchSize, minWidth: 56, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
    calendar: { marginTop: 8 },
    monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    dayHeader: { fontFamily: SERIF_FONT, fontSize: 13, lineHeight: 20, color: COLORS.textSecondary, width: '14.285714%', textAlign: 'center' },
    cell: { width: '14.285714%', paddingHorizontal: 1, paddingVertical: 2, minHeight: 56 },
    day: { minHeight: 52, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: PAPER.trackBg },
    classDay: { backgroundColor: COLORS.successLight },
    skipDay: { backgroundColor: COLORS.warningLight },
    focusDay: { backgroundColor: COLORS.textPrimary },
    dayNumber: { fontFamily: SERIF_FONT, fontSize: 17, lineHeight: 23, fontWeight: '700', color: COLORS.textPrimary },
    focusText: { color: COLORS.background },
    marks: { flexDirection: 'row', gap: 3, minHeight: 8, flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: 3, marginTop: 3 },
    mark: { width: 6, height: 6, borderRadius: 3 },
    skipMark: { borderRadius: 1, transform: [{ rotate: '45deg' }] },
    dim: { opacity: 0.35 },
    calendarFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
    legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    live: { marginTop: 16, padding: 12, borderRadius: 12 },
    liveHeading: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: 8 },
    notice: { marginTop: 8 },
    warning: { fontFamily: SERIF_FONT, fontSize: 13, lineHeight: 18, color: COLORS.dangerText, marginTop: 8 },
    dayTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 8 },
    textButton: { minWidth: touchSize, minHeight: touchSize, justifyContent: 'center', paddingHorizontal: 8 },
    classTile: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, minHeight: 76, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: 'transparent' },
    className: { flex: 1 },
    choice: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8, backgroundColor: PAPER.surface, borderRadius: 12, minHeight: touchSize },
    choiceOn: { backgroundColor: COLORS.textPrimary },
    choiceText: { fontFamily: SERIF_FONT, fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
    empty: { fontFamily: SERIF_FONT, fontSize: 15, lineHeight: 21, color: COLORS.textSecondary, paddingVertical: 16 },
    balanceHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 8 },
    subject: { borderBottomWidth: 1, borderBottomColor: PAPER.line, paddingVertical: 8 },
    subjectFocus: { padding: 8, borderRadius: 12, minHeight: touchSize },
    subjectLine: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'space-between' },
    swatch: { width: 8, height: 8, borderRadius: 4 },
    exact: { padding: 12, gap: 8, backgroundColor: PAPER.trackBg, borderRadius: 12, marginBottom: 8 },
    detailsButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
    recovery: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
    recoveryItem: { minWidth: 72, gap: 4 },
    assumptions: { fontFamily: SERIF_FONT, fontSize: 13, lineHeight: 18, color: COLORS.textSecondary, marginTop: 12 },
});
