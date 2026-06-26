import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS, TYPOGRAPHY } from '../../../theme/theme';
import { calculatePlannerPercentage, simulateAttendance, calculateRecoveryClasses } from '../../../utils/planner/attendanceCalculations';
import { generateRecoveryPaths } from '../../../utils/planner/recoveryPlanner';
import { useApp } from '../../../context/AppContext';
import { getPlannerEndDate, getPlannableSubjectClasses } from '../../../utils/planner/semesterWindow';

/**
 * Interactive What-If Simulator with Skip/Attend stepper and dynamic predictions.
 */
export default function WhatIfSimulator({ subjectData, initialMode = 'skip', simulationOffset = 0, setSimulationOffset }) {
    const styles = getStyles();
    const { attended, total, target } = subjectData;

    // 'skip' or 'attend' (fix)
    const [mode, setMode] = useState(initialMode === 'skip' ? 'skip' : 'attend');

    const navigation = useNavigation();

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
    const hasSemesterEndDate = !!getPlannerEndDate(state);
    const futureClassUnits = plannableClasses.reduce((sum, item) => sum + (item.units || 1), 0);
    const maxSimulatorSteps = Math.min(40, futureClassUnits > 0 ? futureClassUnits : 20);

    const manualSteps = Math.abs(simulationOffset);
    const activeSteps = Math.min(maxSimulatorSteps, manualSteps);
    const offset = mode === 'skip' ? -activeSteps : activeSteps;

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
        const newActive = Math.max(0, Math.min(maxSimulatorSteps, manualSteps + val));
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
        fontFamily: 'Outfit-ExtraBold',
        fontWeight: '800',
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
        width: 40,
        height: 40,
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
        fontFamily: 'Outfit-ExtraBold',
        fontWeight: '800',
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
