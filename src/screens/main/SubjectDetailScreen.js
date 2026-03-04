import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { getSubjectAttendance, calculateBunks } from '../../utils/attendance';
import { calculateSubjectStreak, getStreakMessage } from '../../utils/streak';
import ProgressBar from '../../components/common/ProgressBar';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import AttendanceGraph from '../../components/subjects/AttendanceGraph';
import CalendarView from '../../components/subjects/CalendarView';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../../theme/theme';
import FloatingBackButton from '../../components/common/FloatingBackButton';

export default function SubjectDetailScreen({ route }) {
    const { subjectId } = route.params;
    const { state, dispatch } = useApp();
    const [editModal, setEditModal] = useState(null); // { date, record }

    const subject = state.subjects.find((s) => s.id === subjectId);
    const subjectColor = subject?.color || COLORS.primary;
    const stats = useMemo(() => getSubjectAttendance(subjectId, state), [subjectId, state]);
    const bunk = useMemo(
        () => (stats ? calculateBunks(stats.attendedUnits, stats.totalUnits, 75) : null),
        [stats]
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

    const isGood = stats.percentage >= 75;

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

    // Format date nicely
    const formatRecordDate = (dateStr) => {
        const d = new Date(dateStr + 'T00:00:00');
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[d.getMonth()]} ${d.getDate()}, ${days[d.getDay()]}`;
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <FloatingBackButton />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Main stats */}
                <Card style={[styles.mainCard, { borderTopWidth: 3, borderTopColor: subjectColor }]}>
                    <Text style={[styles.bigPercentage, isGood ? styles.textGreen : styles.textRed]}>
                        {stats.percentage}%
                    </Text>
                    <ProgressBar percentage={stats.percentage} style={styles.progressBar} />
                    <Text style={styles.statsText}>
                        {stats.attendedUnits} / {stats.totalUnits} marks
                    </Text>
                    {/* Teacher removed */}
                </Card>

                {/* Streak */}
                {streakMsg && (
                    <Card style={styles.streakCard}>
                        <Text style={styles.streakText}>{streakMsg}</Text>
                        <Text style={styles.streakCount}>{streak} classes in a row</Text>
                    </Card>
                )}

                {/* Bunk calculation */}
                {bunk && (
                    <Card style={[styles.bunkCard, bunk.status === 'safe' ? styles.bunkSafe : styles.bunkDanger]}>
                        {bunk.status === 'safe' ? (
                            <>
                                <Text style={styles.bunkLabel}>You can bunk</Text>
                                <Text style={[styles.bunkNumber, styles.textGreen]}>{bunk.count}</Text>
                                <Text style={styles.bunkLabel}>more classes and stay at 75%</Text>
                            </>
                        ) : (
                            <>
                                <Text style={styles.bunkLabel}>You need to attend</Text>
                                <Text style={[styles.bunkNumber, styles.textRed]}>{bunk.count}</Text>
                                <Text style={styles.bunkLabel}>classes to reach 75%</Text>
                            </>
                        )}
                    </Card>
                )}

                {/* Attendance Graph */}
                <Card style={styles.graphCard}>
                    <Text style={styles.sectionTitle}>Attendance Trend</Text>
                    <AttendanceGraph subjectId={subjectId} state={state} days={14} />
                </Card>

                {/* Calendar Heatmap */}
                <Card style={styles.calendarCard}>
                    <Text style={styles.sectionTitle}>Calendar</Text>
                    <CalendarView subjectId={subjectId} state={state} />
                </Card>

                {/* Recent history with edit */}
                {recentRecords.length > 0 && (
                    <View style={styles.historySection}>
                        <Text style={styles.sectionTitle}>Recent Attendance</Text>
                        {recentRecords.map((rec, idx) => (
                            <View key={idx} style={styles.historyRow}>
                                <View>
                                    <Text style={styles.historyDate}>{formatRecordDate(rec.date)}</Text>
                                    <Text style={styles.historyUnits}>
                                        {rec.units} {rec.units === 1 ? 'hr' : 'hrs'}
                                        {rec.isExtra ? ' · Extra' : ''}
                                    </Text>
                                </View>
                                <View style={styles.historyRight}>
                                    <Text style={[styles.historyStatus, rec.status === 'present' ? styles.textGreen : rec.status === 'cancelled' ? styles.textDisabled : styles.textRed]}>
                                        {rec.status === 'present' ? '✅' : rec.status === 'cancelled' ? '🚫' : '❌'}
                                    </Text>
                                    {rec.canEdit && (
                                        <TouchableOpacity onPress={() => handleEdit(rec)} style={styles.editBtn}>
                                            <Text style={styles.editBtnText}>✏️</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        ))}
                        <Text style={styles.editHint}>Records older than 2 weeks cannot be edited</Text>
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        padding: SPACING.screenPadding,
    },
    scrollContent: {
        paddingBottom: SPACING.xxl,
    },
    errorText: {
        ...TYPOGRAPHY.body,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginTop: SPACING.xxl,
    },
    mainCard: {
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    bigPercentage: {
        fontSize: 48,
        fontWeight: 'bold',
        marginBottom: SPACING.md,
    },
    progressBar: {
        width: '100%',
        marginBottom: SPACING.sm,
    },
    statsText: {
        ...TYPOGRAPHY.body,
        color: COLORS.textSecondary,
    },
    textGreen: { color: COLORS.success },
    textRed: { color: COLORS.danger },
    textDisabled: { color: COLORS.textMuted },
    streakCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: SPACING.md,
        backgroundColor: COLORS.warningLight,


    },
    streakText: {
        ...TYPOGRAPHY.body,
        fontWeight: '600',
        color: COLORS.warningDark,
    },
    streakCount: {
        ...TYPOGRAPHY.caption,
        color: COLORS.warning,
        fontWeight: '600',
    },
    bunkCard: {
        alignItems: 'center',
        marginBottom: SPACING.md,
        borderLeftWidth: 4,
    },
    bunkSafe: {
        borderLeftColor: COLORS.success,
        backgroundColor: COLORS.successLight,
    },
    bunkDanger: {
        borderLeftColor: COLORS.danger,
        backgroundColor: COLORS.dangerLight,
    },
    bunkLabel: {
        ...TYPOGRAPHY.body,
        color: COLORS.textSecondary,
    },
    bunkNumber: {
        fontSize: 40,
        fontWeight: 'bold',
        marginVertical: SPACING.xs,
    },
    graphCard: {
        marginBottom: SPACING.md,
    },
    calendarCard: {
        marginBottom: SPACING.md,
    },
    historySection: {
        marginTop: SPACING.sm,
    },
    sectionTitle: {
        ...TYPOGRAPHY.headerSmall,
        color: COLORS.textPrimary,
        marginBottom: SPACING.md,
    },
    historyRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: COLORS.cardBackground,
        padding: SPACING.md,
        borderRadius: 8,
        marginBottom: SPACING.sm,


        ...SHADOWS.small,
    },
    historyDate: {
        ...TYPOGRAPHY.bodySmall,
        color: COLORS.textPrimary,
    },
    historyUnits: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        marginTop: 2,
    },
    historyRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    historyStatus: {
        fontSize: 16,
    },
    editBtn: {
        padding: SPACING.xs,
    },
    editBtnText: {
        fontSize: 14,
    },
    editHint: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        marginTop: SPACING.xs,
        textAlign: 'center',
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
        ...TYPOGRAPHY.headerSmall,
        color: COLORS.textPrimary,
        marginBottom: SPACING.xs,
    },
    modalSubtitle: {
        ...TYPOGRAPHY.bodySmall,
        color: COLORS.textSecondary,
        marginBottom: SPACING.md,
    },
    modalCurrent: {
        ...TYPOGRAPHY.body,
        color: COLORS.textPrimary,
        marginBottom: SPACING.md,
    },
    modalLabel: {
        ...TYPOGRAPHY.caption,
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
        ...TYPOGRAPHY.caption,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
});
