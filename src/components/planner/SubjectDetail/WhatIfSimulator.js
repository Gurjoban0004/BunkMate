import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../../theme/theme';
import { calculatePlannerPercentage, simulateAttendance, calculateRecoveryClasses } from '../../../utils/planner/attendanceCalculations';
import { generateRecoveryPaths } from '../../../utils/planner/recoveryPlanner';
import { useApp } from '../../../context/AppContext';

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

    // Compute active steps combining manual slider and selected calendar dates
    const selectedCount = Object.values(selectedDates).filter(Boolean).length;
    
    // Total offset is manual offset + selected calendar offsets
    let finalOffset = simulationOffset;
    if (mode === 'skip') {
        finalOffset = simulationOffset - selectedCount;
    } else {
        finalOffset = simulationOffset + selectedCount;
    }

    const activeSteps = Math.abs(finalOffset);
    const offset = finalOffset;

    // Find upcoming dates for this subject
    const upcomingDates = React.useMemo(() => {
        const dates = [];
        let d = new Date();
        d.setHours(0,0,0,0);
        d.setDate(d.getDate() + 1); // Start from tomorrow
        
        let count = 0;
        let safeGuard = 0;
        
        while (count < 14 && safeGuard < 100) {
            const dateStr = d.toISOString().split('T')[0];
            const isHoliday = state.holidays?.includes(dateStr);
            if (!isHoliday) {
                const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
                const classes = state.timetable[dayName] || [];
                const subjectClasses = classes.filter(c => c.subjectId === subjectData.id);
                if (subjectClasses.length > 0) {
                    dates.push({
                        date: new Date(d),
                        units: subjectClasses.reduce((sum, c) => sum + (c.units || 1), 0)
                    });
                    count++;
                }
            }
            d.setDate(d.getDate() + 1);
            safeGuard++;
        }
        return dates;
    }, [state.timetable, state.holidays, subjectData.id]);

    const toggleDate = (dateObj) => {
        const key = dateObj.date.toISOString().split('T')[0];
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

            <View style={styles.insightPill}>
                <View style={[styles.insightDot, { backgroundColor: insight.color }]} />
                <Text style={styles.insightText}>
                    <Text style={{ color: insight.color }}>{insight.label} · </Text>
                    {insight.text}
                </Text>
            </View>

            {/* Interactive Timetable Sandbox */}
            <View style={styles.sandboxContainer}>
                <Text style={styles.sandboxTitle}>OR SELECT SPECIFIC CLASSES</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sandboxScroll}>
                    {upcomingDates.map((item, index) => {
                        const key = item.date.toISOString().split('T')[0];
                        const isSelected = !!selectedDates[key];
                        return (
                            <TouchableOpacity 
                                key={index}
                                style={[
                                    styles.sandboxDateCard,
                                    isSelected && (mode === 'skip' ? styles.sandboxDateCardSkip : styles.sandboxDateCardAttend)
                                ]}
                                onPress={() => toggleDate(item)}
                            >
                                <Text style={[styles.sandboxDayText, isSelected && styles.sandboxTextActive]}>
                                    {item.date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                                </Text>
                                <Text style={[styles.sandboxDateText, isSelected && styles.sandboxTextActive]}>
                                    {item.date.getDate()} {item.date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                                </Text>
                                {isSelected && (
                                    <View style={styles.sandboxCheck}>
                                        <Text style={styles.sandboxCheckIcon}>
                                            {mode === 'skip' ? '✕' : '✓'}
                                        </Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            <View style={styles.progressContainer}>
                <View style={styles.progressBg}>
                    <Animated.View style={[styles.progressFill, {
                        width: `${Math.min(100, simulated.percentage)}%`,
                        backgroundColor: simulated.percentage < target ? COLORS.danger : COLORS.success
                    }]} />
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
        padding: SPACING.lg,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
        ...SHADOWS.small,
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
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.full,
        padding: 4,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
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
        letterSpacing: 0,
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
        letterSpacing: 0,
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
        letterSpacing: 0,
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
        letterSpacing: 0,
        marginTop: 2,
    },
    insightPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.inputBackground,
        paddingHorizontal: SPACING.lg,
        paddingVertical: 14,
        borderRadius: BORDER_RADIUS.lg,
        alignSelf: 'center',
        gap: SPACING.md,
        marginBottom: SPACING.xxl,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
    },
    insightDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    insightText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.textSecondary,
        lineHeight: 18,
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
        letterSpacing: 0,
    },
    sandboxContainer: {
        marginBottom: SPACING.xl,
    },
    sandboxTitle: {
        fontSize: 11,
        fontWeight: '800',
        color: COLORS.textMuted,
        letterSpacing: 0,
        marginBottom: SPACING.sm,
        textAlign: 'center',
    },
    sandboxScroll: {
        gap: SPACING.md,
        paddingHorizontal: SPACING.xs,
        paddingBottom: SPACING.sm,
    },
    sandboxDateCard: {
        backgroundColor: COLORS.inputBackground,
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.lg,
        borderRadius: BORDER_RADIUS.md,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
        minWidth: 70,
        position: 'relative',
    },
    sandboxDateCardSkip: {
        backgroundColor: COLORS.dangerLight,
        borderColor: COLORS.danger,
    },
    sandboxDateCardAttend: {
        backgroundColor: COLORS.successLight,
        borderColor: COLORS.success,
    },
    sandboxDayText: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.textSecondary,
    },
    sandboxDateText: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.textPrimary,
        marginTop: 2,
    },
    sandboxTextActive: {
        color: COLORS.textPrimary,
    },
    sandboxCheck: {
        position: 'absolute',
        top: -6,
        right: -6,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: COLORS.textPrimary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sandboxCheckIcon: {
        color: COLORS.cardBackground,
        fontSize: 10,
        fontWeight: 'bold',
    }
});
