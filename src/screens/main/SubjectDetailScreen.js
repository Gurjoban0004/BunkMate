import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { getSubjectAttendance, calculateSkips } from '../../utils/attendance';
import { calculateSubjectStreak, getStreakMessage } from '../../utils/streak';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import CalendarView from '../../components/subjects/CalendarView';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../../theme/theme';
import ScreenHeader from '../../components/common/ScreenHeader';
import StatusHeader from '../../components/planner/SubjectDetail/StatusHeader';
import NextClassDecision from '../../components/planner/SubjectDetail/NextClassDecision';
import RecoveryPaths from '../../components/planner/SubjectDetail/RecoveryPaths';
import WhatIfSimulator from '../../components/planner/SubjectDetail/WhatIfSimulator';
import Next7DaysView from '../../components/planner/SubjectDetail/Next7DaysView';
import PatternsInsights from '../../components/planner/SubjectDetail/PatternsInsights';
import { getSubjectPlannerData } from '../../utils/planner/dataAdapter';
import { simulateAttendance } from '../../utils/planner/attendanceCalculations';

export default function SubjectDetailScreen({ route }) {
    const styles = getStyles();
    const { subjectId } = route.params;
    const { state, dispatch } = useApp();
    const [editModal, setEditModal] = useState(null); // { date, record }
    const [showAllHistory, setShowAllHistory] = useState(false);

    const subject = state.subjects.find((s) => s.id === subjectId);
    const subjectColor = subject?.color || COLORS.primary;
    const target = subject?.target || state.settings?.dangerThreshold || 75;
    const stats = useMemo(() => getSubjectAttendance(subjectId, state), [subjectId, state]);
    const skip = useMemo(
        () => (stats ? calculateSkips(stats.attendedUnits, stats.totalUnits, target) : null),
        [stats, target]
    );

    // Streak
    const streak = useMemo(() => calculateSubjectStreak(subjectId, state), [subjectId, state]);
    const streakMsg = getStreakMessage(streak);

    if (!subject || !stats) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={styles.errorText}>Subject not found</Text>
            </SafeAreaView>
        );
    }

    const isGood = stats.percentage >= target;

    // Recent records with edit support (last 2 weeks)
    const recentRecords = useMemo(() => {
        const records = [];
        const sortedDates = Object.keys(state.attendanceRecords).sort().reverse();
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

        for (const dateKey of sortedDates) {
            const dayRecord = state.attendanceRecords[dateKey];
            if (dayRecord._holiday) continue;

            const record = dayRecord[subjectId];
            if (record) {
                const recordDate = new Date(dateKey);
                const canEdit = recordDate >= twoWeeksAgo;
                records.push({ date: dateKey, ...record, canEdit });
            }
            if (records.length >= 14) break;
        }
        return records;
    }, [state.attendanceRecords, subjectId]);

    const subjectDataForHeader = useMemo(() => ({
        name: subject.name,
        color: subjectColor,
        attended: stats.attendedUnits,
        total: stats.totalUnits,
        percentage: stats.percentage,
        target: target
    }), [subject, subjectColor, stats, target]);

    // Planner data for merged components
    const plannerData = useMemo(() => getSubjectPlannerData(subjectId, state), [subjectId, state]);
    const [simulationOffset, setSimulationOffset] = useState(0);
    const simulatedData = useMemo(() => {
        if (!plannerData || simulationOffset === 0) return plannerData;
        const sim = simulateAttendance(plannerData.attended, plannerData.total, simulationOffset);
        return { ...plannerData, attended: sim.attended, total: sim.total, percentage: sim.percentage };
    }, [plannerData, simulationOffset]);

    const handleEdit = (rec) => {
        setEditModal(rec);
    };

    const handleSaveEdit = (newStatus) => {
        dispatch({
            type: 'EDIT_ATTENDANCE',
            payload: { date: editModal.date, subjectId, newStatus },
        });
        setEditModal(null);
    };

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
                {/* Main stats */}
                <StatusHeader subjectData={subjectDataForHeader} />

                {/* Streak */}
                {streak >= 5 && streakMsg && (
                    <Card style={styles.streakCard}>
                        <Text style={styles.streakText}>{streakMsg}</Text>
                        <Text style={styles.streakCount}>{streak} classes in a row</Text>
                    </Card>
                )}

                {/* Planner: Next class decision */}
                {simulatedData && <NextClassDecision subjectData={simulatedData} />}

                {/* Planner: Recovery paths */}
                {simulatedData && <RecoveryPaths subjectData={simulatedData} />}

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
                    <CalendarView subjectId={subjectId} state={state} />
                </Card>

                {simulatedData && <Next7DaysView subjectData={simulatedData} />}
                {simulatedData && <PatternsInsights subjectData={simulatedData} />}

                {/* Recent history with edit */}
                {recentRecords.length > 0 && (
                    <View style={styles.historySection}>
                        <Text style={styles.sectionTitle}>Recent Attendance</Text>
                        {(showAllHistory ? recentRecords : recentRecords.slice(0, 5)).map((rec, idx) => (
                            <View key={idx} style={styles.historyRow}>
                                <View>
                                    <Text style={styles.historyDate}>{formatRecordDate(rec.date)}</Text>
                                    <Text style={styles.historyUnits}>
                                        {rec.units} {rec.units === 1 ? 'hr' : 'hrs'}
                                        {rec.isExtra ? ' · Extra' : ''}
                                    </Text>
                                </View>
                                <View style={styles.historyRight}>
                                    <View style={[styles.statusDot, { backgroundColor: rec.status === 'present' ? COLORS.success : rec.status === 'cancelled' ? COLORS.textMuted : COLORS.danger }]} />
                                    <Text style={[styles.historyStatus, { color: rec.status === 'present' ? COLORS.successDark : rec.status === 'cancelled' ? COLORS.textMuted : COLORS.danger }]}>
                                        {rec.status === 'present' ? 'P' : rec.status === 'cancelled' ? 'C' : 'A'}
                                    </Text>
                                    {rec.canEdit && (
                                        <TouchableOpacity onPress={() => handleEdit(rec)} style={styles.editBtn}>
                                            <Text style={styles.editBtnText}>Edit</Text>
                                        </TouchableOpacity>
                                    )}
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
            </ScrollView>

            {/* Edit Modal */}
            <Modal visible={!!editModal} transparent animationType="fade" onRequestClose={() => setEditModal(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Edit Attendance</Text>
                        {editModal && (
                            <>
                                <Text style={styles.modalSubtitle}>{subject.name} · {formatRecordDate(editModal.date)}</Text>
                                <Text style={styles.modalCurrent}>
                                    Current: {editModal.status === 'present' ? 'Present' : editModal.status === 'cancelled' ? 'Cancelled' : 'Absent'}
                                </Text>
                                <Text style={styles.editHint}>Only recent marks can be edited.</Text>

                                <Text style={styles.modalLabel}>Change to:</Text>
                                <View style={styles.modalActions}>
                                    <TouchableOpacity
                                        style={[styles.modalOption, styles.presentOption]}
                                        onPress={() => handleSaveEdit('present')}
                                    >
                                        <Text style={styles.modalOptionText}>Present</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.modalOption, styles.absentOption]}
                                        onPress={() => handleSaveEdit('absent')}
                                    >
                                        <Text style={styles.modalOptionText}>Absent</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.modalOption, styles.cancelledOption]}
                                        onPress={() => handleSaveEdit('cancelled')}
                                    >
                                        <Text style={styles.modalOptionText}>Cancel</Text>
                                    </TouchableOpacity>
                                </View>

                                <Button title="Dismiss" variant="secondary" onPress={() => setEditModal(null)} style={{ marginTop: SPACING.md }} />
                            </>
                        )}
                    </View>
                </View>
            </Modal>
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
    textDisabled: { color: COLORS.textMuted },
    streakCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: SPACING.md,
        backgroundColor: COLORS.warningLight,


    },
    streakText: {
        ...TYPOGRAPHY.bodyMedium,
        fontWeight: '600',
        color: COLORS.warningDark,
    },
    streakCount: {
        ...TYPOGRAPHY.captionMedium,
        color: COLORS.warning,
        fontWeight: '600',
    },
    skipCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.lg,
        gap: 8,
    },
    skipSafe: {
        backgroundColor: COLORS.successLight,
        borderColor: COLORS.success,
        borderWidth: 1,
    },
    skipDanger: {
        backgroundColor: COLORS.dangerLight,
        borderColor: COLORS.danger,
        borderWidth: 1,
    },
    skipLabel: {
        ...TYPOGRAPHY.bodyMedium,
        color: COLORS.textSecondary,
    },
    skipNumber: {
        fontSize: 20,
        fontWeight: 'bold', 
    },
    calendarCard: {
        marginBottom: SPACING.md,
    },
    historySection: {
        marginTop: SPACING.sm,
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
        fontSize: 12,
        fontWeight: '700',
    },
    editBtn: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
    },
    editBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.primary,
    },
    editHint: {
        ...TYPOGRAPHY.captionMedium,
        color: COLORS.textMuted,
        marginTop: SPACING.xs,
        marginBottom: SPACING.md,
        textAlign: 'center',
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
    // Edit Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: COLORS.overlay,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.screenPadding,
        width: '85%',
        maxWidth: 360,
    },
    modalTitle: {
        ...TYPOGRAPHY.headingSmall,
        color: COLORS.textPrimary,
        marginBottom: SPACING.xs,
    },
    modalSubtitle: {
        ...TYPOGRAPHY.bodySmall,
        color: COLORS.textSecondary,
        marginBottom: SPACING.md,
    },
    modalCurrent: {
        ...TYPOGRAPHY.bodyMedium,
        color: COLORS.textPrimary,
        marginBottom: SPACING.md,
    },
    modalLabel: {
        ...TYPOGRAPHY.captionMedium,
        color: COLORS.textSecondary,
        marginBottom: SPACING.sm,
    },
    modalActions: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    modalOption: {
        flex: 1,
        paddingVertical: SPACING.sm + 2,
        borderRadius: BORDER_RADIUS.sm,
        alignItems: 'center',

    },
    presentOption: {
        backgroundColor: COLORS.successLight,
    },
    absentOption: {
        backgroundColor: COLORS.dangerLight,
    },
    cancelledOption: {

        backgroundColor: COLORS.inputBackground,
    },
    modalOptionText: {
        ...TYPOGRAPHY.captionMedium,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
});
