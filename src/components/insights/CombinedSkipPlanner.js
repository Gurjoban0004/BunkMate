import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, KeyboardAvoidingView, Keyboard, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useApp } from '../../context/AppContext';
import { PAPER, COLORS, SERIF_FONT, subjectTint } from '../../theme/theme';
import { getSavedSkipPlan } from '../../utils/planner/combinedSkipPlan';
import { parseLocalDate, toPlannerDateKey } from '../../utils/planner/semesterWindow';
import { formatTimeRange } from '../../utils/dateHelpers';
import { shortSubjectName } from '../../utils/subjectName';

const dateLabel = (key) => parseLocalDate(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const pct = (value) => `${value.toFixed(1)}%`;
const DEFAULT_PLAN = { pairsPerWeek: 2, weeks: 4, skipIds: null };
function Icon({ name, color = COLORS.primaryDark }) {
    const paths = { back: 'M13 4l-6 6 6 6', next: 'M7 4l6 6-6 6', attend: 'M4 10l4 4 8-8', skip: 'M5 5l10 10M15 5L5 15', close: 'M5 5l10 10M15 5L5 15', settings: 'M4 6h12M4 14h12M8 3v6M13 11v6', minus: 'M4 10h12', plus: 'M4 10h12M10 4v12' };
    return <Svg width={20} height={20} viewBox="0 0 20 20" accessible={Platform.OS === 'web' ? undefined : false} aria-hidden><Path d={paths[name]} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}

export default function CombinedSkipPlanner({ navigation, initialSubjectId }) {
    const { state, dispatch, triggerErpSync, isErpSyncing } = useApp();
    const insets = useSafeAreaInsets(), { width, height } = useWindowDimensions();
    const touch = Platform.OS === 'android' ? 48 : 44;
    const styles = getStyles(touch);
    const saved = state.settings?.skipPlan;
    const preferences = saved || DEFAULT_PLAN;
    const [settingsOpen, setSettingsOpen] = useState(!saved);
    const [budget, setBudget] = useState(String(preferences.pairsPerWeek));
    const [weeks, setWeeks] = useState(preferences.weeks);
    const [details, setDetails] = useState(false);
    const [panelMode, setPanelMode] = useState('settings');
    const [mode, setMode] = useState('month');
    const [page, setPage] = useState(null);
    const [selectedDay, setSelectedDay] = useState(null);
    const [subjectFilter, setSubjectFilter] = useState(initialSubjectId || null);
    const plan = useMemo(() => getSavedSkipPlan(state, preferences), [state, preferences]);
    const validBudget = /^\d+$/.test(budget) && Number.isSafeInteger(Number(budget));
    const events = plan?.weeks.flatMap((week) => week.classes) || [];
    const visible = events.filter((cls) => !subjectFilter || cls.subjectId === subjectFilter);
    const start = plan?.startDate || toPlannerDateKey(state.devDate || new Date());
    const end = plan?.endDate || start;
    const focus = selectedDay && selectedDay >= start && selectedDay <= end ? selectedDay : visible[0]?.dateKey || start;
    const focusWeek = Math.max(0, plan?.weeks.findIndex((week) => { const last = parseLocalDate(week.key); last.setDate(last.getDate() + 6); return focus >= week.key && focus <= toPlannerDateKey(last); }) ?? 0);
    const weekIndex = typeof page === 'number' ? Math.min(page, Math.max(0, (plan?.weeks.length || 1) - 1)) : focusWeek;
    const month = typeof page === 'string' && page >= start.slice(0, 7) && page <= end.slice(0, 7) ? page : focus.slice(0, 7);
    const monthDate = parseLocalDate(`${month}-01`);
    const padding = (monthDate.getDay() + 6) % 7, days = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
    const cells = mode === 'month' ? Array.from({ length: Math.ceil((padding + days) / 7) * 7 }, (_, i) => i < padding || i >= padding + days ? null : `${month}-${String(i - padding + 1).padStart(2, '0')}`)
        : Array.from({ length: 7 }, (_, i) => { const d = parseLocalDate(plan?.weeks[weekIndex]?.key || start); d.setDate(d.getDate() + i); return toPlannerDateKey(d); });
    const rows = cells.length / 7;
    // Compress six-row months on short phones; never shrink touch targets.
    const chrome = (touch + 8) + touch + 20 + 26 + 36 + 3 * (touch + 13) + 61 + 24 + 70 + 4;
    const dayHeight = Math.max(touch, Math.min(52, (height - insets.top - chrome) / rows - 4));
    const compactGrid = width < 362 && Platform.OS !== 'android';
    const gridWidth = Math.max(7 * (touch + (compactGrid ? 0 : 2)), Math.min(width, 620) - (compactGrid ? 12 : 40));
    const classes = visible.filter((cls) => cls.dateKey === focus);
    const risky = plan?.subjects.filter((subject) => subject.unsafeSkips || subject.belowTarget) || [];
    const paused = !plan || !!plan.warnings.length;
    const overBudget = plan?.weeks.some((week) => week.overBudget);
    const selectedWeek = plan?.weeks[focusWeek];
    const setPreferences = (next) => dispatch({ type: 'UPDATE_SETTINGS', payload: { skipPlan: next } });
    const openSettings = () => { setPanelMode('settings'); setBudget(String(preferences.pairsPerWeek)); setWeeks(preferences.weeks); setSettingsOpen(true); };
    const toggle = (cls) => {
        const ids = new Set(events.filter((event) => event.action === 'skip').map((event) => event.id));
        if (ids.has(cls.id)) ids.delete(cls.id); else ids.add(cls.id);
        setSelectedDay(cls.dateKey);
        setPreferences({ ...preferences, skipIds: [...ids] });
    };
    const atStart = mode === 'month' ? month <= start.slice(0, 7) : weekIndex === 0;
    const atEnd = mode === 'month' ? month >= end.slice(0, 7) : weekIndex >= (plan?.weeks.length || 1) - 1;
    const shift = (direction) => {
        if (mode === 'week') { const next = weekIndex + direction; setPage(next); setSelectedDay(plan.weeks[next]?.classes[0]?.dateKey || plan.weeks[next]?.key); }
        else { const d = new Date(monthDate); d.setMonth(d.getMonth() + direction); const key = toPlannerDateKey(d).slice(0, 7); setPage(key); setSelectedDay(visible.find((cls) => cls.dateKey.startsWith(key))?.dateKey || `${key}-01`); }
    };
    const close = () => navigation?.canGoBack?.() ? navigation.goBack() : navigation?.navigate('Insights');
    const closePanel = () => { Keyboard.dismiss(); setSettingsOpen(false); setDetails(false); };

    return <View style={[styles.root, { paddingTop: insets.top + 4 }]}>
        <View style={styles.header}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close skip calendar" onPress={close} style={styles.icon}><Icon name="back" /></TouchableOpacity>
            <Text accessibilityRole="header" style={styles.title}>Skip calendar</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Edit plan preferences" onPress={openSettings} style={styles.icon}><Icon name="settings" /></TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <View style={styles.toolbar}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Previous calendar page" disabled={atStart} onPress={() => shift(-1)} style={[styles.icon, atStart && styles.disabled]}><Icon name="back" /></TouchableOpacity>
                <Text style={styles.heading}>{mode === 'month' ? monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : `${dateLabel(cells[0])} – ${dateLabel(cells[6])}`}</Text>
                <View style={styles.modes}>{['month', 'week'].map((value) => <TouchableOpacity key={value} accessibilityRole="button" accessibilityLabel={`Show ${value} calendar`} aria-pressed={mode === value} accessibilityState={{ selected: mode === value }} onPress={() => { setMode(value); setPage(null); }} style={[styles.mode, mode === value && styles.modeOn]}><Text style={styles.caption}>{value === 'month' ? 'Month' : 'Week'}</Text></TouchableOpacity>)}</View>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Next calendar page" disabled={atEnd} onPress={() => shift(1)} style={[styles.icon, atEnd && styles.disabled]}><Icon name="next" /></TouchableOpacity>
            </View>
            <ScrollView horizontal style={compactGrid && { marginHorizontal: -14 }} showsHorizontalScrollIndicator={width < gridWidth + (compactGrid ? 12 : 40)}><View style={{ width: gridWidth }}>
                <View style={styles.grid}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((value, i) => <Text key={i} style={styles.weekday}>{value}</Text>)}</View>
                <View style={styles.grid}>{cells.map((key, i) => {
                    if (!key) return <View key={i} style={[styles.cell, { height: dayHeight + 4 }]} />;
                    const scheduled = visible.filter((cls) => cls.dateKey === key), skips = scheduled.filter((cls) => cls.action === 'skip');
                    const disabled = key < start || key > end, selected = key === focus;
                    return <View key={key} style={[styles.cell, compactGrid && { paddingHorizontal: 0 }]}><TouchableOpacity accessibilityRole="button" accessibilityLabel={`${dateLabel(key)}, ${scheduled.length} scheduled classes, ${skips.reduce((n, cls) => n + cls.pairs, 0)} skip pairs`} aria-pressed={selected} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={() => setSelectedDay(key)} style={[styles.day, { height: dayHeight }, scheduled.length > 0 && styles.attendDay, skips.length > 0 && styles.skipDay, selected && styles.selectedDay, disabled && styles.disabled]}>
                        <Text style={[styles.date, selected && { color: PAPER.apricotInk }]}>{parseLocalDate(key).getDate()}</Text>
                        {skips.length > 0 ? <Text style={styles.cellClass}>{shortSubjectName(skips[0].subjectName, 5)}{skips.length > 1 ? ` +${skips.length - 1}` : ''}</Text> : <View style={styles.marks}>{scheduled.map((cls) => <View key={cls.id} style={[styles.dot, { backgroundColor: cls.unsafe ? COLORS.dangerText : subjectTint(cls.subjectId, state.subjects).accent }, cls.action === 'skip' && styles.diamond]} />)}</View>}
                    </TouchableOpacity></View>;
                })}</View>
            </View></ScrollView>
            <View style={styles.legend}><View style={styles.legendMarks}><View style={[styles.dot, { backgroundColor: COLORS.successDark }]} /><Text style={styles.caption}>Attend</Text><View style={[styles.dot, styles.diamond, { backgroundColor: COLORS.warningDark }]} /><Text style={styles.caption}>Skip</Text></View><Text style={styles.caption}>{selectedWeek?.skippedPairs || 0}/{preferences.pairsPerWeek} pairs this week</Text></View>
            <View style={styles.dayHeading}><Text accessibilityRole="header" style={styles.heading}>{parseLocalDate(focus).toLocaleDateString('en-US', { weekday: 'short' })} · {dateLabel(focus)}</Text>{subjectFilter && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Show all subjects" onPress={() => setSubjectFilter(null)} style={styles.smallButton}><Text style={styles.link}>All subjects</Text></TouchableOpacity>}</View>
            {classes.length ? classes.map((cls) => {
                const tint = subjectTint(cls.subjectId, state.subjects), skip = cls.action === 'skip';
                return <TouchableOpacity key={cls.id} accessibilityRole="checkbox" accessibilityLabel={`Skip ${cls.subjectName} on ${cls.dateKey} at ${cls.startTime}, ${cls.pairs} full pairs`} aria-checked={skip} accessibilityState={{ checked: skip, disabled: paused }} disabled={paused} onPress={() => toggle(cls)} style={[styles.classRow, { backgroundColor: tint.bg }, cls.unsafe && { borderColor: COLORS.dangerText }]}>
                    <View style={[styles.subjectDot, { backgroundColor: tint.accent }]} /><View style={styles.flex}><Text style={[styles.body, { fontWeight: '700' }]}>{shortSubjectName(cls.subjectName, 12)}</Text><Text style={styles.caption}>{formatTimeRange(cls.startTime, cls.endTime)} · {cls.units} lectures</Text></View>
                    <View style={[styles.choice, { backgroundColor: skip ? PAPER.apricot : PAPER.sage }]}><Icon name={skip ? 'skip' : 'attend'} color={skip ? PAPER.apricotInk : PAPER.sageInk} /><Text style={[styles.body, { color: skip ? PAPER.apricotInk : PAPER.sageInk }]}>{skip ? 'Skip' : 'Attend'}</Text></View>
                </TouchableOpacity>;
            }) : <Text style={styles.empty}>{subjectFilter ? 'No classes for this subject.' : 'No classes on this day.'}</Text>}
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="View all subject projections and recovery" onPress={() => { setPanelMode('details'); setDetails(true); }} style={[styles.summary, { backgroundColor: risky.length || paused ? PAPER.apricot : PAPER.sage }]}>
                <View style={styles.flex}><Text style={styles.body}>{paused ? 'Check your records & timetable' : risky.length ? 'A subject needs attention' : overBudget ? 'Over your weekly budget' : 'Your attendance with this plan'}</Text><Text style={styles.caption}>{paused ? plan?.warnings[0] : risky.length ? 'An earlier skip crosses a minimum' : `Through ${dateLabel(end)} · tap for subjects`}</Text></View><Text style={[styles.heading, { color: risky.length ? COLORS.dangerText : COLORS.successText }]}>{plan ? pct(plan.overall.projectedPercentage) : '—'}</Text>
            </TouchableOpacity>
            {paused && <View style={styles.legendMarks}><TouchableOpacity accessibilityRole="button" disabled={!triggerErpSync || isErpSyncing} onPress={() => triggerErpSync?.(true)} style={styles.smallButton}><Text style={styles.link}>{isErpSyncing ? 'Syncing…' : 'Sync college records'}</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" onPress={() => navigation?.navigate('EditTimetable')} style={styles.smallButton}><Text style={styles.link}>Edit timetable</Text></TouchableOpacity></View>}
            <Text style={styles.preview}>Preview only · attend the other classes</Text>
        </ScrollView>

        <Modal visible={settingsOpen || details} transparent animationType="slide" statusBarTranslucent onRequestClose={closePanel}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Dismiss plan panel" onPress={closePanel} style={StyleSheet.absoluteFill} />
            <View style={[styles.sheet, { maxHeight: height - insets.top - 16 }]}>
                <View accessible={false} style={styles.sheetHandle} />
                <View style={styles.sheetHeader}><Text accessibilityRole="header" style={[styles.title, styles.flex]}>{panelMode === 'settings' ? 'Make room in your week' : 'Your subjects'}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Close plan panel" onPress={closePanel} style={styles.icon}><Icon name="close" /></TouchableOpacity></View>
                <ScrollView contentContainerStyle={[styles.sheetContent, { paddingBottom: Math.max(20, insets.bottom) }]} keyboardShouldPersistTaps="handled">
                    {panelMode === 'settings' ? <>
                        <Text style={styles.setupIntro}>Choose your pace. We’ll spread safe skips across your timetable.</Text>
                        <View style={styles.setupGroup}>
                            <Text style={styles.heading}>Skip goal per week</Text>
                            <View style={styles.budgetStepper}>
                                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Decrease weekly skip goal" disabled={!validBudget || Number(budget) === 0} accessibilityState={{ disabled: !validBudget || Number(budget) === 0 }} onPress={() => setBudget(String(Number(budget) - 1))} style={[styles.stepButton, (!validBudget || Number(budget) === 0) && styles.disabled]}><Icon name="minus" /></TouchableOpacity>
                                <View style={styles.budgetValue}><TextInput accessibilityLabel="Skip pairs per week" aria-invalid={!validBudget} value={budget} onChangeText={setBudget} keyboardType="number-pad" selectTextOnFocus returnKeyType="done" onSubmitEditing={Keyboard.dismiss} style={styles.input} /><Text style={styles.caption}>class pairs · 2 lectures each</Text></View>
                                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Increase weekly skip goal" disabled={!validBudget || !Number.isSafeInteger(Number(budget) + 1)} accessibilityState={{ disabled: !validBudget || !Number.isSafeInteger(Number(budget) + 1) }} onPress={() => setBudget(String(Number(budget) + 1))} style={[styles.stepButton, (!validBudget || !Number.isSafeInteger(Number(budget) + 1)) && styles.disabled]}><Icon name="plus" /></TouchableOpacity>
                            </View>
                            <View style={styles.budgetChoices}>{[1, 2, 3].map((value) => <TouchableOpacity key={value} accessibilityRole="button" accessibilityLabel={`${value} skip pairs per week`} accessibilityState={{ selected: budget === String(value) }} aria-pressed={budget === String(value)} onPress={() => setBudget(String(value))} style={[styles.preset, budget === String(value) && styles.modeOn]}><Text style={styles.body}>{value} {value === 1 ? 'pair' : 'pairs'}</Text></TouchableOpacity>)}</View>
                        </View>
                        {!validBudget && <Text accessibilityRole="alert" style={styles.warning}>Use a whole number, 0 or more.</Text>}
                        <View style={styles.setupGroup}><Text style={styles.heading}>Plan ahead</Text><View style={styles.budgetChoices}>{[1, 2, 4, 8].map((value) => <TouchableOpacity key={value} accessibilityRole="button" accessibilityLabel={`Plan ${value} weeks`} accessibilityState={{ selected: weeks === value }} aria-pressed={weeks === value} onPress={() => setWeeks(value)} style={[styles.preset, weeks === value && styles.modeOn]}><Text style={styles.body}>{value} {value === 1 ? 'week' : 'weeks'}</Text></TouchableOpacity>)}</View></View>
                        <Text style={styles.caption}>Fewer skips when needed to protect each subject’s minimum. Your attendance stays unchanged.</Text>
                        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Save balanced weekly plan" accessibilityState={{ disabled: !validBudget }} disabled={!validBudget} onPress={() => { setPreferences({ pairsPerWeek: Number(budget), weeks, skipIds: null }); closePanel(); setSelectedDay(null); setPage(null); }} style={[styles.primaryButton, !validBudget && styles.disabled]}><Text style={styles.primaryText}>{saved ? 'Update my plan' : 'Build my plan'}</Text><Icon name="next" color={PAPER.sageInk} /></TouchableOpacity>
                    </> : <>
                        <Text style={styles.caption}>Projections assume you attend the other classes.</Text>
                        {plan?.subjects.map((subject) => { const tint = subjectTint(subject.id, state.subjects); return <TouchableOpacity key={subject.id} accessibilityRole="button" accessibilityLabel={`Focus calendar on ${subject.name}`} onPress={() => { setSubjectFilter(subject.id); setSelectedDay(null); setDetails(false); }} style={[styles.detailSubject, { backgroundColor: tint.bg }]}><Text style={styles.heading}>{shortSubjectName(subject.name)}</Text><Text style={styles.body}>{pct(subject.currentPercentage)} → {pct(subject.projectedPercentage)} · {subject.target}% minimum</Text><Text style={styles.caption}>{subject.skipNowPairs ?? 'Unlimited'} pairs available now · {subject.skippedPairs} planned</Text>{!!subject.unsafeSkips && <Text style={styles.warning}>A skip crosses this subject’s minimum.</Text>}<Text style={styles.caption}>{subject.recordedA}/{subject.recordedT} → {subject.a}/{subject.t} lectures</Text><Text style={styles.caption}>Recover previous: {subject.recoverPreviousPairs === null ? 'unreachable' : `${subject.recoverPreviousPairs} full pairs`}</Text></TouchableOpacity>; })}
                        <Text style={styles.heading}>Numbers & recovery</Text><Text style={styles.body}>Recorded {plan?.overall.attended}/{plan?.overall.conducted} · projected {plan?.overall.projectedA}/{plan?.overall.projectedT} lectures</Text><Text style={styles.caption}>Consecutive full pairs after this plan</Text>
                        {plan?.overall.recovery.map((target) => <View key={target.label} style={styles.recovery}><Text style={styles.body}>{target.label}</Text><Text style={styles.body}>{target.pairs === null ? 'Unreachable' : `${target.pairs} pairs`}</Text></View>)}
                        {plan?.reservedPairs > 0 && <Text style={styles.caption}>{plan.reservedPairs} unpublished pairs are reserved as missed.</Text>}
                        <TouchableOpacity accessibilityRole="button" onPress={() => { setPreferences({ ...preferences, skipIds: null }); setDetails(false); }} style={styles.primaryButton}><Text style={styles.primaryText}>Rebuild a balanced plan</Text></TouchableOpacity>
                    </>}
                </ScrollView>
            </View>
            </KeyboardAvoidingView>
        </Modal>
    </View>;
}
const getStyles = (touch) => StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.background },
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.28)' },
    sheet: { backgroundColor: COLORS.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, width: '100%', maxWidth: 620, alignSelf: 'center', overflow: 'hidden' },
    sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginTop: 8, marginBottom: 8 },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 8, paddingBottom: 8 },
    sheetContent: { paddingHorizontal: 20 },
    setupIntro: { fontFamily: SERIF_FONT, fontSize: 15, lineHeight: 21, color: COLORS.textSecondary, marginBottom: 24 },
    setupGroup: { backgroundColor: PAPER.surface, padding: 16, borderRadius: 16, marginBottom: 16 },
    budgetStepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginVertical: 12 },
    budgetValue: { alignItems: 'center', flex: 1 },
    stepButton: { minHeight: touch, minWidth: touch, borderRadius: 12, backgroundColor: PAPER.trackBg, alignItems: 'center', justifyContent: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, minHeight: touch + 8, gap: 8, width: '100%', maxWidth: 620, alignSelf: 'center' },
    title: { fontFamily: SERIF_FONT, fontSize: 22, lineHeight: 28, color: COLORS.primaryDark, fontWeight: '700' },
    heading: { fontFamily: SERIF_FONT, fontSize: 17, lineHeight: 22, color: COLORS.textPrimary, fontWeight: '700' },
    body: { fontFamily: SERIF_FONT, fontSize: 15, lineHeight: 20, color: COLORS.textPrimary },
    caption: { fontFamily: SERIF_FONT, fontSize: 12, lineHeight: 16, color: COLORS.textSecondary },
    content: { paddingHorizontal: 20, width: '100%', maxWidth: 620, alignSelf: 'center', paddingBottom: Platform.OS === 'web' ? 'calc(var(--ios-tabbar-reserved, 84px) + 8px)' : 96 },
    flex: { flex: 1 }, icon: { minWidth: touch, minHeight: touch, alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: 0.35 },
    toolbar: { flexDirection: 'row', alignItems: 'center', gap: 2, justifyContent: 'space-between', paddingBottom: 8 },
    modes: { flexDirection: 'row', marginLeft: 'auto', backgroundColor: PAPER.trackBg, borderRadius: 12 }, mode: { minHeight: touch, minWidth: touch, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 12 }, modeOn: { backgroundColor: PAPER.lavender },
    grid: { flexDirection: 'row', flexWrap: 'wrap' }, weekday: { fontFamily: SERIF_FONT, color: COLORS.textSecondary, fontSize: 12, lineHeight: 20, width: '14.285714%', textAlign: 'center' },
    cell: { width: '14.285714%', paddingHorizontal: 1, paddingVertical: 2 }, day: { alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: 'transparent', backgroundColor: PAPER.surface }, attendDay: { backgroundColor: PAPER.sage }, skipDay: { backgroundColor: PAPER.apricot }, selectedDay: { backgroundColor: PAPER.lavender, borderColor: COLORS.primary },
    cellClass: { fontFamily: SERIF_FONT, fontSize: 10, lineHeight: 13, color: PAPER.apricotInk, marginTop: 2, textAlign: 'center' },
    date: { fontFamily: SERIF_FONT, fontSize: 16, lineHeight: 19, color: COLORS.textPrimary, fontWeight: '700' }, marks: { flexDirection: 'row', gap: 3, marginTop: 4, minHeight: 6, flexWrap: 'wrap', justifyContent: 'center' }, dot: { width: 5, height: 5, borderRadius: 3 }, diamond: { borderRadius: 0, transform: [{ rotate: '45deg' }] },
    legend: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 }, legendMarks: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    dayHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32, marginTop: 4 },
    classRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 12, minHeight: touch + 12, marginBottom: 8, borderRadius: 16, borderWidth: 1, borderColor: 'transparent' }, subjectDot: { width: 6, height: 6, borderRadius: 3 }, choice: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, minHeight: 36, borderRadius: 10 },
    summary: { flexDirection: 'row', alignItems: 'center', minHeight: touch + 12, gap: 12, padding: 16, borderRadius: 16, marginTop: 8 }, empty: { fontFamily: SERIF_FONT, fontSize: 15, color: COLORS.textSecondary, paddingVertical: 12 }, preview: { fontFamily: SERIF_FONT, fontSize: 12, lineHeight: 16, color: COLORS.textSecondary, marginTop: 8, textAlign: 'center' },
    smallButton: { minHeight: touch, justifyContent: 'center', paddingHorizontal: 8 }, link: { fontFamily: SERIF_FONT, fontSize: 13, color: PAPER.apricotInk }, warning: { fontFamily: SERIF_FONT, fontSize: 13, lineHeight: 18, color: COLORS.dangerText },
    budgetChoices: { flexDirection: 'row', gap: 4, padding: 4, backgroundColor: PAPER.trackBg, borderRadius: 12, marginTop: 12 }, preset: { flex: 1, minHeight: touch, minWidth: touch, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, input: { width: 88, minHeight: touch, textAlign: 'center', fontFamily: SERIF_FONT, fontSize: 28, lineHeight: 34, fontWeight: '700', color: COLORS.textPrimary },
    primaryButton: { flexDirection: 'row', gap: 8, minHeight: touch + 8, padding: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: PAPER.sage, borderRadius: 16, marginTop: 20 }, primaryText: { fontFamily: SERIF_FONT, fontSize: 17, fontWeight: '700', color: PAPER.sageInk }, detailSubject: { padding: 16, borderRadius: 16, marginBottom: 12, gap: 4 }, recovery: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: PAPER.line },
});
