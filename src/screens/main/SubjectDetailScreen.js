import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, LayoutAnimation } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { getSubjectAttendance, getErpCoverageDateForSubject } from '../../utils/attendance';
import Card from '../../components/common/Card';
import CalendarView from '../../components/subjects/CalendarView';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../../theme/theme';
import ScreenHeader from '../../components/common/ScreenHeader';
import SubjectSummaryCard from '../../components/planner/SubjectDetail/SubjectSummaryCard';
import WhatIfSimulator from '../../components/planner/SubjectDetail/WhatIfSimulator';
import PatternsInsights from '../../components/planner/SubjectDetail/PatternsInsights';
import { getSubjectPlannerData } from '../../utils/planner/dataAdapter';
import { simulateAttendance } from '../../utils/planner/attendanceCalculations';

export default function SubjectDetailScreen({ route }) {
    const styles = getStyles();
    const { subjectId } = route.params;
    const { state } = useApp();
    const [showAllHistory, setShowAllHistory] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    const subject = state.subjects.find((s) => s.id === subjectId);
    const stats = useMemo(() => getSubjectAttendance(subjectId, state), [subjectId, state]);

    // How far the college has updated this subject.
    const coverageDate = useMemo(() => getErpCoverageDateForSubject(subjectId, state), [subjectId, state]);

    if (!subject || !stats) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={styles.errorText}>Subject not found</Text>
            </SafeAreaView>
        );
    }

    // The last 14 recorded days for this subject, newest first.
    const recentRecords = useMemo(() => {
        const records = [];
        const sortedDates = Object.keys(state.attendanceRecords).sort().reverse();
        for (const dateKey of sortedDates) {
            const dayRecord = state.attendanceRecords[dateKey];
            if (!dayRecord || dayRecord._holiday) continue;
            const record = dayRecord[subjectId];
            if (record) records.push({ date: dateKey, ...record });
            if (records.length >= 14) break;
        }
        return records;
    }, [state.attendanceRecords, subjectId]);

    // Planner data for merged components
    const plannerData = useMemo(() => getSubjectPlannerData(subjectId, state), [subjectId, state]);
    const [simulationOffset, setSimulationOffset] = useState(0);
    const simulatedData = useMemo(() => {
        if (!plannerData || simulationOffset === 0) return plannerData;
        // The simulator stepper counts classes, so each step costs a whole session.
        const sim = simulateAttendance(plannerData.attended, plannerData.total, simulationOffset, plannerData.unitsPerClass);
        return { ...plannerData, attended: sim.attended, total: sim.total, percentage: sim.percentage };
    }, [plannerData, simulationOffset]);

    // Format date nicely — use parseDate to avoid timezone shift on Android/Safari
    const formatRecordDate = (dateStr) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        const d = new Date(year, month - 1, day, 12, 0, 0);
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[d.getMonth()]} ${d.getDate()}, ${days[d.getDay()]}`;
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScreenHeader title={subject?.name || 'Subject'} />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Where it stands + what the next class does + the way back */}
                {simulatedData && <SubjectSummaryCard subjectData={simulatedData} />}

                {/* Planner: What-If Simulator */}
                {plannerData && (
                    <WhatIfSimulator
                        subjectData={plannerData}
                        simulatedSubjectData={simulatedData}
                        simulationOffset={simulationOffset}
                        setSimulationOffset={setSimulationOffset}
                    />
                )}

                {/* Calendar Heatmap */}
                <Card style={styles.calendarCard}>
                    <Text style={styles.sectionTitle}>Calendar</Text>
                    <Text style={styles.syncNote}>
                        {coverageDate
                            ? `Your college has updated through ${formatRecordDate(coverageDate)}`
                            : 'Waiting for your college to record the first class'}
                    </Text>
                    <CalendarView subjectId={subjectId} state={state} flat={true} />
                </Card>

                {simulatedData && <PatternsInsights subjectData={simulatedData} />}

                {/* Recent history with edit */}
                {recentRecords.length > 0 && (
                    <View style={styles.historySection}>
                        <TouchableOpacity
                            style={styles.historyHeaderToggle}
                            onPress={() => {
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                setShowHistory(!showHistory);
                            }}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Recent classes</Text>
                            <Text style={styles.toggleChevron}>{showHistory ? '▲' : '▼'}</Text>
                        </TouchableOpacity>

                        {showHistory && (
                            <View style={styles.historyContent}>
                                {(showAllHistory ? recentRecords : recentRecords.slice(0, 5)).map((rec, idx) => (
                                    <View key={idx} style={styles.historyRow}>
                                        <View>
                                            <Text style={styles.historyDate}>{formatRecordDate(rec.date)}</Text>
                                            <Text style={styles.historyUnits}>
                                                {rec.units} {rec.units === 1 ? 'hour' : 'hours'}
                                                {rec.status === 'partial' ? ` · ${rec.attendedUnits} attended` : ''}
                                            </Text>
                                        </View>
                                        <View style={styles.historyRight}>
                                            <View style={[styles.statusDot, { backgroundColor: rec.status === 'present' ? COLORS.success : rec.status === 'partial' ? COLORS.warning : COLORS.danger }]} />
                                            <Text style={[styles.historyStatus, { color: rec.status === 'present' ? COLORS.successDark : rec.status === 'partial' ? COLORS.warningText : COLORS.danger }]}>
                                                {rec.status === 'present' ? 'Present' : rec.status === 'partial' ? 'Partly' : 'Absent'}
                                            </Text>
                                        </View>
                                    </View>
                                ))}
                                {recentRecords.length > 5 && (
                                    <TouchableOpacity
                                        style={styles.showMoreButton}
                                        onPress={() => setShowAllHistory(!showAllHistory)}
                                    >
                                        <Text style={styles.showMoreText}>
                                            {showAllHistory ? 'Show less' : `View all ${recentRecords.length}`}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>

        </SafeAreaView>
    );
}

const getStyles = () => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        padding: SPACING.screenPadding,
        paddingBottom: SPACING.xxl,
        paddingTop: SPACING.md,
    },
    errorText: {
        ...TYPOGRAPHY.bodyMedium,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginTop: SPACING.xxl,
    },
    syncNote: {
        ...TYPOGRAPHY.captionMedium,
        color: COLORS.textMuted,
        marginTop: -SPACING.sm,
        marginBottom: SPACING.sm,
    },
    historySection: {
        marginTop: SPACING.sm,
    },
    historyHeaderToggle: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: SPACING.sm,
    },
    toggleChevron: {
        fontSize: 12,
        color: COLORS.textMuted,
        fontWeight: 'bold',
    },
    historyContent: {
        marginTop: SPACING.xs,
    },
    sectionTitle: {
        ...TYPOGRAPHY.headingSmall,
        color: COLORS.textPrimary,
        marginBottom: SPACING.md,
    },
    historyRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: COLORS.cardBackground,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.sm,
        marginBottom: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    historyDate: {
        ...TYPOGRAPHY.bodySmall,
        color: COLORS.textPrimary,
    },
    historyUnits: {
        ...TYPOGRAPHY.captionMedium,
        color: COLORS.textMuted,
        marginTop: 2,
    },
    historyRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    historyStatus: {
        fontWeight: '700',
        fontSize: 12,
    },
    showMoreButton: {
        alignSelf: 'center',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        marginTop: SPACING.xs,
    },
    showMoreText: {
        ...TYPOGRAPHY.captionMedium,
        color: COLORS.primary,
        fontWeight: '700',
    },
});
