import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView, LayoutAnimation } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../../theme/theme';
import { calculatePlannerPercentage, simulateAttendance, calculateRecoveryClasses } from '../../../utils/planner/attendanceCalculations';
import { generateRecoveryPaths } from '../../../utils/planner/recoveryPlanner';
import { useApp } from '../../../context/AppContext';
import { getPlannerEndDate, getUpcomingSubjectClasses } from '../../../utils/planner/semesterWindow';

/**
 * Interactive What-If Simulator with Skip/Attend stepper and dynamic predictions.
 */
export default function WhatIfSimulator({ subjectData, initialMode = 'skip', simulationOffset = 0, setSimulationOffset }) {
    const styles = getStyles();
    const { attended, total, target } = subjectData;

    // 'skip' or 'attend' (fix)
    const [mode, setMode] = useState(initialMode === 'skip' ? 'skip' : 'attend');

    const handleModeChange = (newMode) => {
        setMode(newMode);
        if (setSimulationOffset) setSimulationOffset(0);
        setSelectedDates({}); // Clear selected dates on mode switch
    };

    const { state } = useApp();
    const [selectedDates, setSelectedDates] = useState({});

    // Find upcoming dates for this subject
    const upcomingDates = React.useMemo(() => {
        return getUpcomingSubjectClasses(state, subjectData.id, { maxClasses: 14 });
    }, [state, subjectData.id]);

    const hasSemesterEndDate = !!getPlannerEndDate(state);
    const futureClassUnits = upcomingDates.reduce((sum, item) => sum + (item.units || 1), 0);
    const maxSimulatorSteps = hasSemesterEndDate ? futureClassUnits : 20;

    // Compute active steps combining manual stepper and selected calendar classes.
    const selectedUnits = upcomingDates.reduce((sum, item) => {
        return selectedDates[item.classKey] ? sum + (item.units || 1) : sum;
    }, 0);
    const manualSteps = Math.abs(simulationOffset);
    const activeSteps = Math.min(maxSimulatorSteps, manualSteps + selectedUnits);
    const offset = mode === 'skip' ? -activeSteps : activeSteps;

    const toggleDate = (dateObj) => {
        const key = dateObj.classKey;
        setSelectedDates(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    // Simulation Data
    const currentPercentage = calculatePlannerPercentage(attended, total);
    const simulated = simulateAttendance(attended, total, offset);
    const delta = (simulated.percentage - currentPercentage).toFixed(1);

    const handleStep = (val) => {
        const maxManualSteps = Math.max(0, maxSimulatorSteps - selectedUnits);
        const newActive = Math.max(0, Math.min(maxManualSteps, manualSteps + val));
        if (setSimulationOffset) {
            setSimulationOffset(mode === 'skip' ? -newActive : newActive);
        }
    };

    // Generate Dynamic Insight
    const getInsight = () => {
        if (mode === 'skip') {
            if (simulated.percentage < target) {
                // How many to recover?
                const recovery = calculateRecoveryClasses(simulated.attended, simulated.total, target);
                if (recovery) {
                    // Try to get recovery paths for timeline/specific dates
                    // We simulate the subject state with the newly skipped classes
                    const simulatedSubject = {
                        ...subjectData,
                        attended: simulated.attended,
                        total: simulated.total
                    };
                    const paths = generateRecoveryPaths(simulatedSubject, [target]);

                    let extraText = '';
                    if (paths.paths && paths.paths.length > 0) {
                        extraText = ` (See Recovery Plan)`;
                    }

                    return {
                        label: 'Warning',
                        text: `Requires ${recovery.classesNeeded} classes to recover${extraText}.`,
                        color: COLORS.danger
                    };
                }
                return {
                    label: 'Warning',
                    text: `Danger! You will drop below ${target}%.`,
                    color: COLORS.danger
                };
            } else {
                // Calculate absolute consecutive skips possible from real state
                let maxSafeSkips = 0;
                while (calculatePlannerPercentage(attended, total + maxSafeSkips + 1) >= target) {
                    maxSafeSkips++;
                }
                const remainingSkips = maxSafeSkips - Math.abs(offset);

                if (remainingSkips > 0) {
                    return {
                        label: 'Safe',
                        text: `You can skip ${remainingSkips} more ${remainingSkips === 1 ? 'class' : 'classes'} safely.`,
                        color: COLORS.successDark
                    };
                } else {
                    return {
                        label: 'Edge',
                        text: `You are on the edge! 1 more skip drops you below ${target}%.`,
                        color: COLORS.warningDark
                    };
                }
            }
        } else {
            // Attend Mode
            if (simulated.percentage >= target && currentPercentage < target) {
                return {
                    label: 'Recovered',
                    text: `Attending ${activeSteps} gets you back safely to ${target}%.`,
                    color: COLORS.successDark
                };
            } else {
                // Per class gain at current state
                const plusOne = simulateAttendance(simulated.attended, simulated.total, 1);
                const gain = (plusOne.percentage - simulated.percentage).toFixed(1);
                return {
                    label: 'Improving',
                    text: `Every class adds +${gain}% to your score.`,
                    color: COLORS.successDark
                };
            }
        }
    };

    const insight = getInsight();

    const [showDates, setShowDates] = useState(false);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Simulator</Text>
                <View style={styles.modeSwitch}>
                    <TouchableOpacity style={[styles.modeBtn, mode === 'skip' && styles.modeBtnActive]} onPress={() => handleModeChange('skip')}>
                        <Text style={[styles.modeBtnText, mode === 'skip' && styles.modeBtnTextActive]}>SKIP</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modeBtn, mode === 'attend' && styles.modeBtnActive]} onPress={() => handleModeChange('attend')}>
                        <Text style={[styles.modeBtnText, mode === 'attend' && styles.modeBtnTextActive]}>ATTEND</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Compact result + stepper in one block */}
            <View style={styles.compactResultRow}>
                <View style={styles.stepperWrapper}>
                    <TouchableOpacity style={[styles.stepperBtn, manualSteps <= 0 && styles.stepperBtnDisabled]} onPress={() => handleStep(-1)} disabled={manualSteps <= 0}>
                        <Text style={[styles.stepperActionText, { color: mode === 'skip' ? COLORS.danger : COLORS.success }]}>-</Text>
                    </TouchableOpacity>
                    <View style={styles.stepperValueContainer}>
                        <Text style={styles.stepperValue}>{activeSteps}</Text>
                        <Text style={styles.stepperUnit}>classes</Text>
                    </View>
                    <TouchableOpacity style={[styles.stepperBtn, activeSteps >= maxSimulatorSteps && styles.stepperBtnDisabled]} onPress={() => handleStep(1)} disabled={activeSteps >= maxSimulatorSteps}>
                        <Text style={[styles.stepperActionText, { color: mode === 'skip' ? COLORS.danger : COLORS.success }]}>+</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.resultBox}>
                    <Text style={[styles.resultMain, { color: simulated.percentage < target ? COLORS.danger : COLORS.textPrimary }]}>
                        {simulated.percentage.toFixed(1)}%
                    </Text>
                    <Text style={[styles.resultDelta, { color: delta > 0 ? COLORS.success : delta < 0 ? COLORS.danger : COLORS.textMuted }]}>
                        {delta > 0 ? '+' : ''}{delta}%
                    </Text>
                </View>
            </View>

            <View style={styles.insightPill}>
                <View style={[styles.insightDot, { backgroundColor: insight.color }]} />
                <Text style={styles.insightText}>
                    <Text style={{ color: insight.color }}>{insight.label} · </Text>
                    {insight.text}
                </Text>
            </View>

            {/* Collapsible date picker */}
            <TouchableOpacity onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setShowDates(!showDates); }} style={styles.dateToggle}>
                <Text style={styles.dateToggleText}>Select dates {showDates ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {showDates && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sandboxScroll}>
                    {upcomingDates.map((item, index) => {
                        const key = item.classKey;
                        const isSelected = !!selectedDates[key];
                        return (
                            <TouchableOpacity key={index} style={[styles.sandboxDateCard, isSelected && (mode === 'skip' ? styles.sandboxDateCardSkip : styles.sandboxDateCardAttend)]} onPress={() => toggleDate(item)}>
                                <Text style={[styles.sandboxDayText, isSelected && styles.sandboxTextActive]}>{item.date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</Text>
                                <Text style={[styles.sandboxDateText, isSelected && styles.sandboxTextActive]}>{item.date.getDate()}</Text>
                                {isSelected && <View style={styles.sandboxCheck}><Text style={styles.sandboxCheckIcon}>{mode === 'skip' ? '✕' : '✓'}</Text></View>}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            )}

            <View style={styles.progressContainer}>
                <View style={styles.progressBg}>
                    <Animated.View style={[styles.progressFill, { width: `${Math.min(100, simulated.percentage)}%`, backgroundColor: simulated.percentage < target ? COLORS.danger : COLORS.success }]} />
                    <View style={[styles.targetMarker, { left: `${target}%` }]} />
                </View>
                <View style={styles.progressRow}>
                    <Text style={styles.progressLabel}>Current: {currentPercentage.toFixed(1)}%</Text>
                    <Text style={styles.progressLabel}>Target: {target}%</Text>
                </View>
            </View>
        </View>
    );
}

const getStyles = () => StyleSheet.create({
    container: {
        backgroundColor: COLORS.cardBackground, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md,
        marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.borderSubtle, ...SHADOWS.small,
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
    title: { fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.textPrimary },
    modeSwitch: { flexDirection: 'row', backgroundColor: COLORS.inputBackground, borderRadius: BORDER_RADIUS.full, padding: 3, borderWidth: 1, borderColor: COLORS.borderSubtle },
    modeBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: BORDER_RADIUS.full },
    modeBtnActive: { backgroundColor: COLORS.cardBackground, ...SHADOWS.small },
    modeBtnText: { fontSize: 10, fontWeight: '800', color: COLORS.textMuted },
    modeBtnTextActive: { color: COLORS.textPrimary },
    compactResultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
    resultBox: { alignItems: 'flex-end' },
    resultMain: { fontSize: 36, fontWeight: '900', lineHeight: 40 },
    resultDelta: { fontSize: FONT_SIZES.sm, fontWeight: '700', marginTop: 2 },
    stepperWrapper: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    stepperBtn: { width: 40, height: 40, borderRadius: 16, backgroundColor: COLORS.cardBackground, justifyContent: 'center', alignItems: 'center', ...SHADOWS.medium },
    stepperBtnDisabled: { opacity: 0.4 },
    stepperActionText: { fontSize: 24, fontWeight: 'bold', marginTop: -2 },
    stepperValueContainer: { alignItems: 'center', minWidth: 50 },
    stepperValue: { fontSize: 32, fontWeight: '900', lineHeight: 36, color: COLORS.textPrimary },
    stepperUnit: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, marginTop: 1 },
    insightPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBackground, paddingHorizontal: SPACING.md, paddingVertical: 10, borderRadius: BORDER_RADIUS.md, gap: SPACING.sm, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.borderSubtle },
    insightDot: { width: 6, height: 6, borderRadius: 3 },
    insightText: { fontSize: FONT_SIZES.xs, fontWeight: '600', color: COLORS.textSecondary, lineHeight: 16, flex: 1 },
    dateToggle: { alignItems: 'center', paddingVertical: SPACING.xs, marginBottom: SPACING.sm },
    dateToggleText: { fontSize: FONT_SIZES.xs, fontWeight: '700', color: COLORS.textMuted },
    progressContainer: { backgroundColor: COLORS.background, borderRadius: BORDER_RADIUS.md, padding: SPACING.sm },
    progressBg: { height: 6, backgroundColor: COLORS.inputBackground, borderRadius: 3, marginBottom: SPACING.sm, position: 'relative' },
    progressFill: { height: '100%', borderRadius: 3 },
    targetMarker: { position: 'absolute', top: -3, bottom: -3, width: 2, backgroundColor: COLORS.textSecondary, zIndex: 1, borderRadius: 1 },
    progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
    progressLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted },
    sandboxScroll: { gap: SPACING.sm, paddingHorizontal: SPACING.xs, paddingBottom: SPACING.sm },
    sandboxDateCard: { backgroundColor: COLORS.inputBackground, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderRadius: BORDER_RADIUS.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.borderSubtle, minWidth: 56, position: 'relative' },
    sandboxDateCardSkip: { backgroundColor: COLORS.dangerLight, borderColor: COLORS.danger },
    sandboxDateCardAttend: { backgroundColor: COLORS.successLight, borderColor: COLORS.success },
    sandboxDayText: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary },
    sandboxDateText: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary, marginTop: 1 },
    sandboxTextActive: { color: COLORS.textPrimary },
    sandboxCheck: { position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.textPrimary, alignItems: 'center', justifyContent: 'center' },
    sandboxCheckIcon: { color: COLORS.cardBackground, fontSize: 9, fontWeight: 'bold' },
});
