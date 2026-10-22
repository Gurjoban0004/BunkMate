import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS, TYPOGRAPHY } from '../../../theme/theme';
import { calculatePlannerPercentage, simulateAttendance, calculateRecoveryClasses, calculateSkipAllowance } from '../../../utils/planner/attendanceCalculations';
import { useApp } from '../../../context/AppContext';
import { getPlannableSubjectClasses } from '../../../utils/planner/semesterWindow';

/**
 * Interactive What-If Simulator with Skip/Attend stepper and dynamic predictions.
 */
export default function WhatIfSimulator({ subjectData, navigation, initialMode = 'skip', simulationOffset = 0, setSimulationOffset, allowSkip = true, title = 'Skip / Attend simulator', classLabel = 'classes' }) {
    const styles = getStyles();
    const { attended, total, target, unitsPerClass = 1 } = subjectData;

    // 'skip' or 'attend' (fix)
    const [mode, setMode] = useState(allowSkip && initialMode === 'skip' ? 'skip' : 'attend');

    const handleModeChange = (newMode) => {
        setMode(newMode);
        if (setSimulationOffset) setSimulationOffset(0);
    };

    const { state } = useApp();

    // Cap the quick stepper by the real upcoming class load (timetable when
    // present, assumed weekdays otherwise) so it can't promise impossible skips.
    const plannableClasses = React.useMemo(
        () => getPlannableSubjectClasses(state, subjectData.id, { maxClasses: 60 }),
        [state, subjectData.id]
    );
    // The stepper counts CLASSES, so cap it by classes left, not periods.
    const maxSimulatorSteps = Math.min(40, plannableClasses.length);

    const manualSteps = Math.abs(simulationOffset);
    const activeSteps = Math.min(maxSimulatorSteps, manualSteps);
    const selectedUnits = plannableClasses.slice(0, activeSteps).reduce((sum, cls) => sum + (cls.assumed ? unitsPerClass : cls.units), 0);
    const offset = mode === 'skip' ? -selectedUnits : selectedUnits;

    const openCalendarPlanner = () => {
        navigation.navigate('SubjectPlanner', {
            subjectId: subjectData.id,
            subjectName: subjectData.name,
            initialMode: mode,
        });
    };

    // Simulation Data
    const currentPercentage = calculatePlannerPercentage(attended, total);
    const simulated = simulateAttendance(attended, total, offset);
    const delta = (simulated.percentage - currentPercentage).toFixed(1);

    const handleStep = (val) => {
        const newActive = Math.max(0, Math.min(maxSimulatorSteps, activeSteps + val));
        if (setSimulationOffset) {
            setSimulationOffset(mode === 'skip' ? -newActive : newActive);
        }
    };

    // Generate Dynamic Insight
    const getInsight = () => {
        if (mode === 'skip') {
            if (simulated.percentage < target) {
                // How many to recover?
                const recovery = calculateRecoveryClasses(simulated.attended, simulated.total, target, unitsPerClass);
                if (recovery) {
                    return {
                        label: 'Warning',
                        text: `Requires about ${recovery.classesNeeded} more classes to recover to ${target}%.`,
                        color: COLORS.dangerText
                    };
                }
                return {
                    label: 'Warning',
                    text: `${target}% cannot be reached with the absences already recorded.`,
                    color: COLORS.dangerText
                };
            } else {
                // Calculate absolute consecutive skips possible from real state
                let budget = calculateSkipAllowance(target, simulated.attended, simulated.total).units;
                let remainingSkips = 0;
                for (const cls of plannableClasses.slice(activeSteps)) {
                    const units = cls.assumed ? unitsPerClass : cls.units;
                    if (units > budget) break;
                    budget -= units;
                    remainingSkips++;
                }

                if (remainingSkips > 0) {
                    return {
                        label: 'Safe',
                        text: `You can skip ${remainingSkips} more ${remainingSkips === 1 ? 'class' : 'classes'} and stay at ${target}% or above.`,
                        color: COLORS.successDark
                    };
                } else {
                    return {
                        label: 'Edge',
                        text: activeSteps === maxSimulatorSteps ? 'No more upcoming classes in this planning window.' : `The next skip drops you below ${target}%.`,
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
                const nextClass = plannableClasses[activeSteps];
                if (!nextClass) {
                    return {
                        label: 'End of plan',
                        text: 'No more upcoming classes in this planning window.',
                        color: COLORS.textSecondary
                    };
                }
                const nextUnits = nextClass.assumed ? unitsPerClass : nextClass.units;
                const plusOne = simulateAttendance(simulated.attended, simulated.total, 1, nextUnits);
                const gain = (plusOne.percentage - simulated.percentage).toFixed(1);
                return {
                    label: 'Improving',
                    text: `The next class adds about ${gain} percentage points.`,
                    color: COLORS.successDark
                };
            }
        }
    };

    const insight = getInsight();

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={[styles.title, { flex: 1 }]}>{title}</Text>
                <View style={styles.modeSwitch}>
                    {allowSkip && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Simulate skipping classes" accessibilityState={{ selected: mode === 'skip' }} style={[styles.modeBtn, mode === 'skip' && styles.modeBtnActive]} onPress={() => handleModeChange('skip')}>
                        <Text style={[styles.modeBtnText, mode === 'skip' && styles.modeBtnTextActive]}>SKIP</Text>
                    </TouchableOpacity>}
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Simulate attending classes" accessibilityState={{ selected: mode === 'attend' }} style={[styles.modeBtn, mode === 'attend' && styles.modeBtnActive]} onPress={() => handleModeChange('attend')}>
                        <Text style={[styles.modeBtnText, mode === 'attend' && styles.modeBtnTextActive]}>ATTEND</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Compact result + stepper in one block */}
            <View style={styles.compactResultRow}>
                <View style={styles.stepperWrapper}>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Remove one simulated class" style={[styles.stepperBtn, activeSteps <= 0 && styles.stepperBtnDisabled]} onPress={() => handleStep(-1)} disabled={activeSteps <= 0}>
                        <Text style={[styles.stepperActionText, { color: mode === 'skip' ? COLORS.danger : COLORS.success }]}>-</Text>
                    </TouchableOpacity>
                    <View style={styles.stepperValueContainer}>
                        <Text style={styles.stepperValue}>{activeSteps}</Text>
                        <Text style={styles.stepperUnit}>{activeSteps === 1 && classLabel === 'classes' ? 'class' : classLabel}</Text>
                    </View>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Add one simulated class" style={[styles.stepperBtn, activeSteps >= maxSimulatorSteps && styles.stepperBtnDisabled]} onPress={() => handleStep(1)} disabled={activeSteps >= maxSimulatorSteps}>
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

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
                <Text style={styles.progressLabel}>Preview · records unchanged</Text>
                {activeSteps > 0 && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Reset simulation" onPress={() => setSimulationOffset(0)} style={{ minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' }}><Text style={styles.planCtaText}>Reset</Text></TouchableOpacity>}
            </View>
            {plannableClasses[0]?.assumed && <Text style={styles.progressLabel}>Estimated weekday classes · connect a timetable for exact dates.</Text>}

            <View style={styles.insightPill}>
                <View style={[styles.insightDot, { backgroundColor: insight.color }]} />
                <Text style={styles.insightText}>
                    <Text style={{ color: insight.color }}>{insight.label} · </Text>
                    {insight.text}
                </Text>
            </View>

            {/* Pick specific classes on a calendar */}
            <TouchableOpacity
                onPress={openCalendarPlanner}
                style={styles.planCta}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Plan specific classes on a calendar"
            >
                <Text style={styles.planCtaText}>Plan on a calendar</Text>
                <Text style={styles.planCtaArrow}>→</Text>
            </TouchableOpacity>

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
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: 16,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.small,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        ...TYPOGRAPHY.headingMedium,
        color: COLORS.textPrimary,
    },
    modeSwitch: {
        flexDirection: 'row',
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.full,
        padding: 3,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    modeBtn: {
        minHeight: 48,
        justifyContent: 'center',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: BORDER_RADIUS.full,
    },
    modeBtnActive: {
        backgroundColor: COLORS.cardBackground,
        ...SHADOWS.small,
    },
    modeBtnText: {
        ...TYPOGRAPHY.micro,
        color: COLORS.textMuted,
    },
    modeBtnTextActive: {
        color: COLORS.textPrimary,
    },
    compactResultRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    resultBox: {
        alignItems: 'flex-end',
    },
    resultMain: {
        fontSize: 32,
        lineHeight: 36,
        fontWeight: '700',
    },
    resultDelta: {
        ...TYPOGRAPHY.bodySmall,
        fontWeight: '700',
        marginTop: 2,
    },
    stepperWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    stepperBtn: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: COLORS.cardBackground,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.small,
    },
    stepperBtnDisabled: {
        opacity: 0.4,
    },
    stepperActionText: {
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: -2,
    },
    stepperValueContainer: {
        alignItems: 'center',
        minWidth: 44,
    },
    stepperValue: {
        fontSize: 28,
        lineHeight: 32,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    stepperUnit: {
        ...TYPOGRAPHY.captionSmall,
        color: COLORS.textMuted,
        marginTop: 1,
    },
    insightPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.inputBackground,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: BORDER_RADIUS.md,
        gap: SPACING.sm,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    insightDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    insightText: {
        ...TYPOGRAPHY.bodySmall,
        color: COLORS.textSecondary,
        flex: 1,
    },
    planCta: {
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 11,
        marginBottom: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        backgroundColor: COLORS.inputBackground,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    planCtaText: {
        ...TYPOGRAPHY.labelMedium,
        color: COLORS.primaryDark,
    },
    planCtaArrow: {
        ...TYPOGRAPHY.labelMedium,
        color: COLORS.primaryDark,
    },
    progressContainer: {
        backgroundColor: COLORS.background,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.sm,
    },
    progressBg: {
        height: 6,
        backgroundColor: COLORS.inputBackground,
        borderRadius: 3,
        marginBottom: SPACING.sm,
        position: 'relative',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    targetMarker: {
        position: 'absolute',
        top: -3,
        bottom: -3,
        width: 2,
        backgroundColor: COLORS.textSecondary,
        zIndex: 1,
        borderRadius: 1,
    },
    progressRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    progressLabel: {
        ...TYPOGRAPHY.captionSmall,
        color: COLORS.textMuted,
    },
});
