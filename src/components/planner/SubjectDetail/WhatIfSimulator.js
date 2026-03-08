import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../../theme/theme';
import { calculatePlannerPercentage, simulateAttendance, calculateRecoveryClasses, calculateSkipAllowance } from '../../../utils/planner/attendanceCalculations';
import { generateRecoveryPaths } from '../../../utils/planner/recoveryPlanner';

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
    };

    // Animations
    const bgAnim = useRef(new Animated.Value(mode === 'skip' ? 0 : 1)).current;

    // Animate background when mode changes
    useEffect(() => {
        Animated.timing(bgAnim, {
            toValue: mode === 'skip' ? 0 : 1,
            duration: 400,
            useNativeDriver: false,
        }).start();
    }, [mode]);

    const backgroundColor = bgAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [COLORS.bgSkip || '#FFF5F5', COLORS.bgAttend || '#F5FFF7'],
    });

    const activeSteps = Math.abs(simulationOffset);
    const offset = simulationOffset;

    // Simulation Data
    const currentPercentage = calculatePlannerPercentage(attended, total);
    const simulated = simulateAttendance(attended, total, offset);
    const delta = (simulated.percentage - currentPercentage).toFixed(1);

    const handleStep = (val) => {
        const newActive = Math.max(0, Math.min(20, activeSteps + val));
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
                        icon: <Text style={{ fontSize: 16 }}>⚠️</Text>,
                        text: `Requires ${recovery.classesNeeded} classes to recover${extraText}.`,
                        color: COLORS.danger
                    };
                }
                return {
                    icon: <Text style={{ fontSize: 16 }}>⚠️</Text>,
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
                        icon: <Text style={{ fontSize: 16 }}>✅</Text>,
                        text: `You can skip ${remainingSkips} more ${remainingSkips === 1 ? 'class' : 'classes'} safely.`,
                        color: COLORS.successDark
                    };
                } else {
                    return {
                        icon: <Text style={{ fontSize: 16 }}>⚠️</Text>,
                        text: `You are on the edge! 1 more skip drops you below ${target}%.`,
                        color: COLORS.warningDark
                    };
                }
            }
        } else {
            // Attend Mode
            if (simulated.percentage >= target && currentPercentage < target) {
                return {
                    icon: <Text style={{ fontSize: 16 }}>✅</Text>,
                    text: `Attending ${attendSteps} gets you back safely to ${target}%.`,
                    color: COLORS.successDark
                };
            } else {
                // Per class gain at current state
                const plusOne = simulateAttendance(simulated.attended, simulated.total, 1);
                const gain = (plusOne.percentage - simulated.percentage).toFixed(1);
                return {
                    icon: <Text style={{ fontSize: 16 }}>📈</Text>,
                    text: `Every class adds +${gain}% to your score.`,
                    color: COLORS.successDark
                };
            }
        }
    };

    const insight = getInsight();

    return (
        <Animated.View style={[styles.container, { backgroundColor }]}>
            {/* Header / Mode Switcher */}
            <View style={styles.header}>
                <Text style={styles.title}>Smart Simulator</Text>
                <View style={styles.modeSwitch}>
                    <TouchableOpacity
                        style={[styles.modeBtn, mode === 'skip' && styles.modeBtnActive]}
                        onPress={() => handleModeChange('skip')}
                    >
                        <Text style={[styles.modeBtnText, mode === 'skip' && styles.modeBtnTextActive]}>SKIP</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.modeBtn, mode === 'attend' && styles.modeBtnActive]}
                        onPress={() => handleModeChange('attend')}
                    >
                        <Text style={[styles.modeBtnText, mode === 'attend' && styles.modeBtnTextActive]}>ATTEND</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Simulated Result display */}
            <View style={styles.resultBox}>
                <Text style={styles.resultLabel}>PREDICTED ATTENDANCE</Text>
                <View style={styles.resultMainRow}>
                    <Text style={[styles.resultMain, {
                        color: simulated.percentage < target ? COLORS.danger : COLORS.textPrimary
                    }]}>
                        {simulated.percentage.toFixed(1)}
                    </Text>
                    <Text style={styles.percentSymbol}>%</Text>
                </View>
                <Text style={[styles.resultDelta, {
                    color: delta > 0 ? COLORS.success : delta < 0 ? COLORS.danger : COLORS.textMuted
                }]}>
                    {delta > 0 ? '+' : ''}{delta}%
                </Text>
            </View>

            {/* Stepper */}
            <View style={styles.stepperWrapper}>
                <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => handleStep(-1)}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.stepperActionText, { color: mode === 'skip' ? COLORS.danger : COLORS.success }]}>-</Text>
                </TouchableOpacity>

                <View style={styles.stepperValueContainer}>
                    <Text style={styles.stepperValue}>{activeSteps}</Text>
                    <Text style={styles.stepperUnit}>CLASSES</Text>
                </View>

                <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => handleStep(1)}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.stepperActionText, { color: mode === 'skip' ? COLORS.danger : COLORS.success }]}>+</Text>
                </TouchableOpacity>
            </View>

            {/* Dynamic Insight Pill */}
            <View style={styles.insightPill}>
                {insight.icon}
                <Text style={[styles.insightText, { color: insight.color }]}>{insight.text}</Text>
            </View>

            {/* Simple Progress Bar */}
            <View style={styles.progressContainer}>
                <View style={styles.progressBg}>
                    <Animated.View style={[styles.progressFill, {
                        width: `${Math.min(100, simulated.percentage)}%`,
                        backgroundColor: simulated.percentage < target ? COLORS.danger : COLORS.success
                    }]} />
                    {/* Target Marker */}
                    <View style={[styles.targetMarker, { left: `${target}%` }]} />
                </View>
                <View style={styles.progressRow}>
                    <Text style={styles.progressLabel}>Current: {currentPercentage.toFixed(1)}%</Text>
                    <Text style={styles.progressLabel}>Target: {target}%</Text>
                </View>
            </View>

        </Animated.View>
    );
}

const getStyles = () => StyleSheet.create({
    container: {
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.02)',
        ...SHADOWS.medium,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.lg,
    },
    title: {
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    modeSwitch: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: BORDER_RADIUS.full,
        padding: 4,
    },
    modeBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: BORDER_RADIUS.full,
    },
    modeBtnActive: {
        backgroundColor: COLORS.cardBackground,
        ...SHADOWS.small,
    },
    modeBtnText: {
        fontSize: 10,
        fontWeight: '800',
        color: COLORS.textMuted,
        letterSpacing: 0.5,
    },
    modeBtnTextActive: {
        color: COLORS.textPrimary,
    },
    resultBox: {
        alignItems: 'center',
        marginBottom: SPACING.xl,
        marginTop: SPACING.md,
    },
    resultLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: COLORS.textMuted,
        letterSpacing: 2,
        marginBottom: 8,
    },
    resultMainRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    resultMain: {
        fontSize: 72,
        fontWeight: '900',
        lineHeight: 76,
        letterSpacing: -2,
    },
    percentSymbol: {
        fontSize: 28,
        fontWeight: '800',
        color: COLORS.textSecondary,
        marginTop: 8,
        marginLeft: 2,
    },
    resultDelta: {
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
        marginTop: 4,
    },
    stepperWrapper: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: SPACING.xl,
        marginBottom: SPACING.xl,
    },
    stepperBtn: {
        width: 60,
        height: 60,
        borderRadius: 24,
        backgroundColor: COLORS.cardBackground,
        justifyContent: 'center',
        alignItems: 'center',
        ...SHADOWS.medium,
    },
    stepperActionText: {
        fontSize: 36,
        fontWeight: 'bold',
        marginTop: -4,
    },
    stepperValueContainer: {
        alignItems: 'center',
        minWidth: 80,
    },
    stepperValue: {
        fontSize: 64,
        fontWeight: '900',
        lineHeight: 68,
        color: COLORS.textPrimary,
    },
    stepperUnit: {
        fontSize: 11,
        fontWeight: '800',
        color: COLORS.textMuted,
        letterSpacing: 2,
        marginTop: 2,
    },
    insightPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.cardBackground,
        paddingHorizontal: SPACING.lg,
        paddingVertical: 14,
        borderRadius: BORDER_RADIUS.full,
        alignSelf: 'center',
        gap: SPACING.md,
        marginBottom: SPACING.xxl,
        ...SHADOWS.small,
    },
    insightText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
    },
    progressContainer: {
        backgroundColor: COLORS.background,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
    },
    progressBg: {
        height: 8,
        backgroundColor: COLORS.inputBackground,
        borderRadius: 4,
        marginBottom: SPACING.md,
        position: 'relative',
    },
    progressFill: {
        height: '100%',
        borderRadius: 4,
    },
    targetMarker: {
        position: 'absolute',
        top: -4,
        bottom: -4,
        width: 3,
        backgroundColor: COLORS.textSecondary,
        zIndex: 1,
        borderRadius: 2,
    },
    progressRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    progressLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
});
