import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Modal,
} from 'react-native';
import { format, addDays, subDays } from 'date-fns';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../theme/theme';
import {
    generateRealisticHistory,
    HISTORY_TEMPLATES
} from './mockData/mockHistory';
import {
    generatePredictions,
    findCriticalDates,
} from './mockData/mockPredictions';
import { generateSemesterCalendar, getCalendarStats } from './mockData/mockCalendar';

export default function PlannerDevTools({
    subjects,
    timetable,
    records,
    onLoadScenario,
    onUpdateSubject,
    onUpdateRecords,
    currentDate,
    onChangeDate,
    isVisible,
    onClose,
    scenarios,
}) {
    const styles = getStyles();
    const [selectedSubject, setSelectedSubject] = useState(null);

    const loadScenario = (scenarioName) => {
        onLoadScenario(scenarios[scenarioName]);
    };

    const changeDate = (days) => {
        const newDate = days > 0
            ? addDays(currentDate, Math.abs(days))
            : subDays(currentDate, Math.abs(days));
        onChangeDate(newDate);
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
                        <Text style={styles.title}>🔧 Planner Dev Tools</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Text style={styles.closeText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content}>

                        {/* 1: Quick Scenarios */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>📦 Quick Scenarios</Text>

                            <TouchableOpacity style={[styles.button, { backgroundColor: COLORS.success }]} onPress={() => loadScenario('PERFECT_STUDENT')}>
                                <Text style={styles.buttonText}>Perfect Student (All 85%+)</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.button, { backgroundColor: COLORS.danger }]} onPress={() => loadScenario('STRUGGLING')}>
                                <Text style={styles.buttonText}>Struggling (All below target)</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.button, { backgroundColor: COLORS.warning }]} onPress={() => loadScenario('MIXED_BAG')}>
                                <Text style={styles.buttonText}>Mixed Bag (Variety)</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.button, { backgroundColor: COLORS.primary }]} onPress={() => loadScenario('EDGE_CASES')}>
                                <Text style={styles.buttonText}>Edge Cases (0%, 100%, exact)</Text>
                            </TouchableOpacity>
                        </View>

                        {/* 2: Time Travel */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>⏰ Time Travel & Autopilot</Text>
                            <Text style={styles.currentDate}>
                                Current: {format(currentDate, 'EEEE, MMM dd, yyyy')}
                            </Text>

                            <View style={styles.buttonRow}>
                                <TouchableOpacity style={[styles.button, styles.buttonSmall]} onPress={() => changeDate(-7)}>
                                    <Text style={styles.buttonText}>-7d</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.button, styles.buttonSmall]} onPress={() => changeDate(-1)}>
                                    <Text style={styles.buttonText}>-1d</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.button, styles.buttonSmall, { backgroundColor: COLORS.primary }]} onPress={() => onChangeDate(null)}>
                                    <Text style={styles.buttonText}>Today</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.button, styles.buttonSmall]} onPress={() => changeDate(1)}>
                                    <Text style={styles.buttonText}>+1d</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.button, styles.buttonSmall]} onPress={() => changeDate(7)}>
                                    <Text style={styles.buttonText}>+7d</Text>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                style={[styles.button, { backgroundColor: COLORS.secondary, marginTop: 8 }]}
                                onPress={() => {
                                    // Trigger manual autopilot run
                                    const { runAutopilotCheck } = require('../context/AppContext');
                                    // This is a bit tricky since we are in a component, 
                                    // but we can pass it as a prop or use the dispatch
                                    alert('Triggering Autopilot Check...');
                                    onLoadScenario({ ...scenarios.CURRENT, _triggerAutopilot: true });
                                }}
                            >
                                <Text style={styles.buttonText}>🤖 Force Autopilot Run</Text>
                            </TouchableOpacity>
                        </View>

                        {/* 3: Subject Info */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>🎯 Subjects Info Console</Text>
                            <TouchableOpacity
                                style={[styles.button, { backgroundColor: COLORS.primary }]}
                                onPress={() => {
                                    console.log('=== SUBJECTS ===');
                                    subjects.forEach(s => {
                                        const pct = s.initialAttended / (s.initialTotal || 1) * 100;
                                        console.log(`${s.name}: ${pct.toFixed(1)}% (${s.initialAttended}/${s.initialTotal})`);
                                    });
                                }}
                            >
                                <Text style={styles.buttonText}>Log Subjects to Console</Text>
                            </TouchableOpacity>
                        </View>

                        {/* 4: Historical Data Generation */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>📅 Historical Data</Text>
                            <TouchableOpacity
                                style={[styles.button, { backgroundColor: COLORS.warning }]}
                                onPress={() => {
                                    const history = generateRealisticHistory({ subjects, timetable, weeksBack: 8, currentDate, pattern: 'realistic' });
                                    onUpdateRecords(history);
                                    alert('Generated realistic 8-week history');
                                }}
                            >
                                <Text style={styles.buttonText}>Generate Realistic History (All)</Text>
                            </TouchableOpacity>
                        </View>

                        {/* 5: Predictions & Calendar Output */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>🔮 Predictions (Console Output)</Text>
                            {subjects.map(subject => (
                                <View style={styles.buttonRow} key={subject.id}>
                                    <TouchableOpacity
                                        style={[styles.button, styles.buttonSmall, { backgroundColor: COLORS.primary }]}
                                        onPress={() => {
                                            const predictions = generatePredictions({ subject, timetable, weeksAhead: 8, currentDate });
                                            console.log(`=== PREDICTIONS FOR ${subject.name} ===`);
                                            predictions.forEach(p => console.log(`${p.dateFormatted}: ${p.predictedPercentage}% (${p.predictedAttended}/${p.predictedTotal}) ${p.assumedStatus}`));
                                            alert('Check console for predictions');
                                        }}
                                    >
                                        <Text style={styles.buttonText}>{subject.name} (Predict 8w)</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}

                            <Text style={styles.sectionTitle}>📆 Calendar View</Text>
                            {subjects.map(subject => (
                                <View style={styles.buttonRow} key={`cal-${subject.id}`}>
                                    <TouchableOpacity
                                        style={[styles.button, styles.buttonSmall, { backgroundColor: COLORS.secondary }]}
                                        onPress={() => {
                                            const calendar = generateSemesterCalendar({ subject, timetable, records, currentDate });
                                            const stats = getCalendarStats(calendar);
                                            console.log(`=== CALENDAR FOR ${subject.name} ===`);
                                            console.log(stats);
                                            alert('Check console for calendar stats');
                                        }}
                                    >
                                        <Text style={styles.buttonText}>{subject.name} (Calendar)</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
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
        maxHeight: '85%',
        paddingBottom: SPACING.xl,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.lg,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.cardBackground,
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
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: SPACING.md,
    },
    button: {
        backgroundColor: COLORS.cardBackground,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: BORDER_RADIUS.sm,
        marginBottom: 8,
        alignItems: 'center',
        ...SHADOWS.small,
    },
    buttonSmall: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        flex: 1,
        marginHorizontal: 4,
    },
    buttonText: {
        color: COLORS.white,
        fontWeight: '600',
        fontSize: 14,
    },
    buttonRow: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    currentDate: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginBottom: SPACING.md,
        textAlign: 'center',
    },
});
