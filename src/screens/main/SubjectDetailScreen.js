import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, LayoutAnimation } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { getSubjectAttendance, getErpCoverageDateForSubject, shouldCountLocalRecord } from '../../utils/attendance';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
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
    const { state, dispatch } = useApp();
    const [editModal, setEditModal] = useState(null); // { date, record }
    const [showAllHistory, setShowAllHistory] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    const subject = state.subjects.find((s) => s.id === subjectId);
    const stats = useMemo(() => getSubjectAttendance(subjectId, state), [subjectId, state]);

    // Portal sync note: coverage date + how many of the user's own marks are
    // still bridging the gap until the portal catches up.
    const syncInfo = useMemo(() => {
        const coverageDate = getErpCoverageDateForSubject(subjectId, state);
        let pendingMarks = 0;
        Object.entries(state.attendanceRecords || {}).forEach(([dateKey, dayRecord]) => {
            if (dayRecord._holiday || (state.holidays || []).includes(dateKey)) return;
            const rec = dayRecord[subjectId];
            if (rec && rec.status !== 'cancelled' && shouldCountLocalRecord(dateKey, subjectId, rec, state)) {
                pendingMarks++;
            }
        });
        return { coverageDate, pendingMarks };
    }, [subjectId, state]);

    if (!subject || !stats) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={styles.errorText}>Subject not found</Text>
            </SafeAreaView>
        );
    }

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

    // Planner data for merged components
    const plannerData = useMemo(() => getSubjectPlannerData(subjectId, state), [subjectId, state]);
    const [simulationOffset, setSimulationOffset] = useState(0);
    const simulatedData = useMemo(() => {
        if (!plannerData || simulationOffset === 0) return plannerData;
        // The simulator stepper counts classes, so each step costs a whole session.
        const sim = simulateAttendance(plannerData.attended, plannerData.total, simulationOffset, plannerData.unitsPerClass);
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
                    {(syncInfo.coverageDate || syncInfo.pendingMarks > 0) && (
                        <Text style={styles.syncNote}>
                            {syncInfo.coverageDate
                                ? `Portal data through ${formatRecordDate(syncInfo.coverageDate)}`
                                : 'Waiting for portal data'}
                            {syncInfo.pendingMarks > 0
                                ? ` · ${syncInfo.pendingMarks} mark${syncInfo.pendingMarks === 1 ? '' : 's'} by you`
                                : ''}
                        </Text>
                    )}
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
                            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Recent Attendance</Text>
                            <Text style={styles.toggleChevron}>{showHistory ? '▲' : '▼'}</Text>
                        </TouchableOpacity>

                        {showHistory && (
                            <View style={styles.historyContent}>
                                {(showAllHistory ? recentRecords : recentRecords.slice(0, 5)).map((rec, idx) => (
                                    <View key={idx} style={styles.historyRow}>
                                        <View>
                                            <Text style={styles.historyDate}>{formatRecordDate(rec.date)}</Text>
                                            <Text style={styles.historyUnits}>
                                                {rec.units} {rec.units === 1 ? 'hr' : 'hrs'}
                                                {rec.isExtra ? ' · Extra' : ''}
                                                {rec.source !== 'erp' ? ' · by you' : ''}
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
    editBtn: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
    },
    editBtnText: {
        fontWeight: '600',
        fontSize: 12,
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
