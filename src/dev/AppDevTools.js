import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Modal,
    Alert,
} from 'react-native';
import { format, addDays, subDays } from 'date-fns';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS, TYPOGRAPHY } from '../theme/theme';
import {
    generateRealisticHistory,
} from './mockData/mockHistory';
import {
    generatePredictions,
} from './mockData/mockPredictions';
import { generateSemesterCalendar, getCalendarStats } from './mockData/mockCalendar';

export default function AppDevTools({
    subjects,
    timetable,
    records,
    onLoadScenario,
    onUpdateRecords,
    onClearData,
    currentDate,
    onChangeDate,
    isVisible,
    onClose,
    scenarios,
    runAutopilotCheck,
}) {
    const styles = getStyles();

    const loadScenario = (scenarioName) => {
        onLoadScenario(scenarios[scenarioName]);
        // Trigger autopilot after state load
        if (runAutopilotCheck) {
            setTimeout(() => runAutopilotCheck(), 500);
        }
    };

    const changeDate = (days) => {
        if (days === 0) {
            onChangeDate(null);
        } else {
            const newDate = days > 0
                ? addDays(currentDate, Math.abs(days))
                : subDays(currentDate, Math.abs(days));
            onChangeDate(newDate);
        }
        
        // Trigger autopilot after time travel
        if (runAutopilotCheck) {
            setTimeout(() => runAutopilotCheck(), 500);
        }
    };

    const handleGenerateHistory = () => {
        const history = generateRealisticHistory({ subjects, timetable, weeksBack: 8, currentDate, pattern: 'realistic' });
        onUpdateRecords(history);
        Alert.alert('Success', 'Generated realistic 8-week history');
    };

    const handleClearAll = () => {
        Alert.alert(
            '⚠️ Danger Zone',
            'This will completely reset the app state. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Reset Everything', style: 'destructive', onPress: onClearData }
            ]
        );
    };

    return (
        <Modal
            visible={isVisible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.panel}>
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.title}>🔧 Dev Tools</Text>
                            <Text style={styles.subtitle}>Unified Testing Hub</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Text style={styles.closeText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

                        {/* 1: Time Travel */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>⏱ Time Travel</Text>
                            <View style={styles.dateDisplay}>
                                <Text style={styles.currentDateLabel}>Active Mock Date</Text>
                                <Text style={styles.currentDateValue}>
                                    {format(currentDate, 'EEEE, MMM dd, yyyy')}
                                </Text>
                            </View>

                            <View style={styles.stepperContainer}>
                                <TouchableOpacity style={styles.stepperBtn} onPress={() => changeDate(-7)}>
                                    <Text style={styles.stepperBtnText}>-7d</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.stepperBtn} onPress={() => changeDate(-1)}>
                                    <Text style={styles.stepperBtnText}>-1d</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.stepperBtn, styles.resetBtn]} onPress={() => changeDate(0)}>
                                    <Text style={styles.resetBtnText}>Reset</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.stepperBtn} onPress={() => changeDate(1)}>
                                    <Text style={styles.stepperBtnText}>+1d</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.stepperBtn} onPress={() => changeDate(7)}>
                                    <Text style={styles.stepperBtnText}>+7d</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* 2: State Scenarios */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>📦 State Scenarios</Text>
                            <View style={styles.grid}>
                                <TouchableOpacity 
                                    style={[styles.card, { borderLeftColor: COLORS.success }]} 
                                    onPress={() => loadScenario('PERFECT_STUDENT')}
                                >
                                    <Text style={styles.cardEmoji}>🌟</Text>
                                    <Text style={styles.cardTitle}>Perfect Student</Text>
                                    <Text style={styles.cardDesc}>All subjects 85%+</Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={[styles.card, { borderLeftColor: COLORS.danger }]} 
                                    onPress={() => loadScenario('STRUGGLING')}
                                >
                                    <Text style={styles.cardEmoji}>📉</Text>
                                    <Text style={styles.cardTitle}>Struggling</Text>
                                    <Text style={styles.cardDesc}>Below all targets</Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={[styles.card, { borderLeftColor: COLORS.warning }]} 
                                    onPress={() => loadScenario('MIXED_BAG')}
                                >
                                    <Text style={styles.cardEmoji}>⚖️</Text>
                                    <Text style={styles.cardTitle}>Mixed Bag</Text>
                                    <Text style={styles.cardDesc}>Realistic variety</Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={[styles.card, { borderLeftColor: COLORS.primary }]} 
                                    onPress={() => loadScenario('EDGE_CASES')}
                                >
                                    <Text style={styles.cardEmoji}>🧪</Text>
                                    <Text style={styles.cardTitle}>Edge Cases</Text>
                                    <Text style={styles.cardDesc}>0%, 100%, exact</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* 3: Simulator & Autopilot */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>🤖 Simulator & Autopilot</Text>
                            <TouchableOpacity
                                style={styles.wideButton}
                                onPress={handleGenerateHistory}
                            >
                                <View style={styles.wideButtonContent}>
                                    <Text style={styles.wideButtonEmoji}>📅</Text>
                                    <View>
                                        <Text style={styles.wideButtonTitle}>Generate History</Text>
                                        <Text style={styles.wideButtonDesc}>8 weeks of realistic attendance</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.wideButton, { marginTop: SPACING.sm }]}
                                onPress={() => {
                                    if (runAutopilotCheck) {
                                        runAutopilotCheck();
                                        Alert.alert('🤖 Autopilot', 'Check triggered successfully.');
                                    }
                                }}
                            >
                                <View style={styles.wideButtonContent}>
                                    <Text style={styles.wideButtonEmoji}>🤖</Text>
                                    <View>
                                        <Text style={styles.wideButtonTitle}>Trigger Autopilot</Text>
                                        <Text style={styles.wideButtonDesc}>Manually run unmarked class check</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* 4: Console Loggers */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>� Console Loggers</Text>
                            <TouchableOpacity
                                style={styles.logButton}
                                onPress={() => {
                                    console.log('=== SUBJECTS ===');
                                    subjects.forEach(s => {
                                        const pct = s.initialAttended / (s.initialTotal || 1) * 100;
                                        console.log(`${s.name}: ${pct.toFixed(1)}% (${s.initialAttended}/${s.initialTotal})`);
                                    });
                                    Alert.alert('Console', 'Subject info dumped to terminal.');
                                }}
                            >
                                <Text style={styles.logButtonText}>Dump Subjects Info</Text>
                            </TouchableOpacity>

                            <View style={styles.grid}>
                                <TouchableOpacity
                                    style={styles.smallLogBtn}
                                    onPress={() => {
                                        console.log('=== PREDICTIONS ===');
                                        subjects.forEach(subject => {
                                            const predictions = generatePredictions({ subject, timetable, weeksAhead: 8, currentDate });
                                            console.log(`\n[${subject.name}]`);
                                            predictions.forEach(p => console.log(`${p.dateFormatted}: ${p.predictedPercentage}%`));
                                        });
                                        Alert.alert('Console', 'Predictions dumped to terminal.');
                                    }}
                                >
                                    <Text style={styles.smallLogBtnText}>Log Predictions</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.smallLogBtn}
                                    onPress={() => {
                                        console.log('=== CALENDAR STATS ===');
                                        subjects.forEach(subject => {
                                            const calendar = generateSemesterCalendar({ subject, timetable, records, currentDate });
                                            const stats = getCalendarStats(calendar);
                                            console.log(`\n[${subject.name}]`, stats);
                                        });
                                        Alert.alert('Console', 'Calendar stats dumped.');
                                    }}
                                >
                                    <Text style={styles.smallLogBtnText}>Log Calendar</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Danger Zone */}
                        <View style={[styles.section, { marginTop: SPACING.lg }]}>
                            <TouchableOpacity
                                style={styles.dangerButton}
                                onPress={handleClearAll}
                            >
                                <Text style={styles.dangerButtonText}>Clear All App Data</Text>
                            </TouchableOpacity>
                        </View>

                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const getStyles = () => StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: COLORS.overlay,
        justifyContent: 'flex-end',
    },
    panel: {
        backgroundColor: COLORS.background,
        borderTopLeftRadius: BORDER_RADIUS.lg,
        borderTopRightRadius: BORDER_RADIUS.lg,
        maxHeight: '90%',
        paddingBottom: SPACING.xl,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.lg,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        backgroundColor: COLORS.cardBackground,
        borderTopLeftRadius: BORDER_RADIUS.lg,
        borderTopRightRadius: BORDER_RADIUS.lg,
    },
    title: {
        ...TYPOGRAPHY.headingMedium,
        color: COLORS.textPrimary,
    },
    subtitle: {
        ...TYPOGRAPHY.captionMedium,
        color: COLORS.textSecondary,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.inputBackground,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeText: {
        fontSize: 18,
        color: COLORS.textSecondary,
    },
    content: {
        padding: SPACING.lg,
    },
    section: {
        marginBottom: SPACING.xl,
    },
    sectionTitle: {
        ...TYPOGRAPHY.labelLarge,
        color: COLORS.textSecondary,
        marginBottom: SPACING.md,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    
    // Time Travel
    dateDisplay: {
        backgroundColor: COLORS.cardBackground,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        alignItems: 'center',
        marginBottom: SPACING.sm,
        ...SHADOWS.small,
    },
    currentDateLabel: {
        ...TYPOGRAPHY.captionSmall,
        color: COLORS.textMuted,
        marginBottom: 2,
    },
    currentDateValue: {
        ...TYPOGRAPHY.bodyLarge,
        fontWeight: '700',
        color: COLORS.primary,
    },
    stepperContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    stepperBtn: {
        backgroundColor: COLORS.primaryLight,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: BORDER_RADIUS.sm,
        flex: 1,
        marginHorizontal: 4,
        alignItems: 'center',
    },
    stepperBtnText: {
        ...TYPOGRAPHY.labelSmall,
        color: COLORS.primaryDark,
    },
    resetBtn: {
        backgroundColor: COLORS.primary,
    },
    resetBtnText: {
        ...TYPOGRAPHY.labelSmall,
        color: COLORS.white,
    },

    // Grid Cards
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -SPACING.xs,
    },
    card: {
        backgroundColor: COLORS.cardBackground,
        width: '47%',
        margin: '1.5%',
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        borderLeftWidth: 4,
        ...SHADOWS.small,
    },
    cardEmoji: {
        fontSize: 24,
        marginBottom: SPACING.xs,
    },
    cardTitle: {
        ...TYPOGRAPHY.labelMedium,
        color: COLORS.textPrimary,
    },
    cardDesc: {
        ...TYPOGRAPHY.captionSmall,
        color: COLORS.textSecondary,
        marginTop: 2,
    },

    // Wide Buttons
    wideButton: {
        backgroundColor: COLORS.cardBackground,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        ...SHADOWS.small,
    },
    wideButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    wideButtonEmoji: {
        fontSize: 32,
        marginRight: SPACING.md,
    },
    wideButtonTitle: {
        ...TYPOGRAPHY.labelLarge,
        color: COLORS.textPrimary,
    },
    wideButtonDesc: {
        ...TYPOGRAPHY.captionMedium,
        color: COLORS.textSecondary,
    },

    // Log Buttons
    logButton: {
        backgroundColor: COLORS.inputBackground,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    logButtonText: {
        ...TYPOGRAPHY.labelMedium,
        color: COLORS.textPrimary,
    },
    smallLogBtn: {
        backgroundColor: COLORS.inputBackground,
        flex: 1,
        margin: '1.5%',
        padding: SPACING.sm,
        borderRadius: BORDER_RADIUS.sm,
        alignItems: 'center',
    },
    smallLogBtnText: {
        ...TYPOGRAPHY.captionLarge,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },

    // Danger Zone
    dangerButton: {
        borderWidth: 1,
        borderColor: COLORS.danger,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        alignItems: 'center',
    },
    dangerButtonText: {
        ...TYPOGRAPHY.labelMedium,
        color: COLORS.danger,
        fontWeight: '700',
    },
});
