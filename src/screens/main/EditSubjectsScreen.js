import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Modal,
} from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import { getSubjectAttendance } from '../../utils/attendance';
import Button from '../../components/common/Button';
import { showAlert } from '../../utils/alert';

const THEME_COLORS = [
    '#FF6B6B', // Red
    '#FF9F43', // Orange
    '#FDCB6E', // Yellow
    '#1DD1A1', // Green
    '#48DBFB', // Light Blue
    '#5F27CD', // Purple
    '#C8D6E5', // Gray
    '#222F3E', // Dark
];

const EditSubjectsScreen = ({ navigation }) => {
    const { state, dispatch } = useApp();
    const [modalVisible, setModalVisible] = useState(false);
    const [editingSubject, setEditingSubject] = useState(null);

    // Form state
    const [name, setName] = useState('');
    const [teacher, setTeacher] = useState('');
    const [selectedColor, setSelectedColor] = useState(THEME_COLORS[0]);
    const [attended, setAttended] = useState('0');
    const [total, setTotal] = useState('0');

    const openModal = (subject = null) => {
        if (subject) {
            setEditingSubject(subject);
            setName(subject.name);
            setTeacher(subject.teacher || '');
            setSelectedColor(subject.color || THEME_COLORS[0]);

            // For editing, show current attendance so they can override if needed
            // If they change it, we update initialAttended and initialTotal
            setAttended(subject.initialAttended?.toString() || '0');
            setTotal(subject.initialTotal?.toString() || '0');
        } else {
            setEditingSubject(null);
            setName('');
            setTeacher('');
            // Pick an unused color if possible
            const usedColors = state.subjects.map(s => s.color);
            const unusedColor = THEME_COLORS.find(c => !usedColors.includes(c)) || THEME_COLORS[0];
            setSelectedColor(unusedColor);
            setAttended('0');
            setTotal('0');
        }
        setModalVisible(true);
    };

    const handleSave = () => {
        if (!name.trim()) {
            showAlert('Error', 'Subject name is required');
            return;
        }

        const attendedNum = parseInt(attended) || 0;
        const totalNum = parseInt(total) || 0;

        if (attendedNum > totalNum) {
            showAlert('Error', 'Attended classes cannot be greater than total classes');
            return;
        }

        if (editingSubject) {
            dispatch({
                type: 'UPDATE_SUBJECT',
                payload: {
                    id: editingSubject.id,
                    name: name.trim(),
                    teacher: teacher.trim(),
                    color: selectedColor,
                    initialAttended: attendedNum,
                    initialTotal: totalNum,
                },
            });
        } else {
            dispatch({
                type: 'ADD_SUBJECT',
                payload: {
                    id: Date.now().toString(),
                    name: name.trim(),
                    teacher: teacher.trim(),
                    color: selectedColor,
                    initialAttended: attendedNum,
                    initialTotal: totalNum,
                },
            });
        }

        setModalVisible(false);
    };

    const handleDelete = (subject) => {
        showAlert(
            '⚠️ Delete Subject?',
            `Are you sure you want to delete ${subject.name}?\n\nThis will remove it from your timetable and delete all attendance records. This cannot be undone!`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: '🗑️ Delete',
                    style: 'destructive',
                    onPress: () => {
                        dispatch({ type: 'DELETE_SUBJECT', payload: subject.id });
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.header}>
                    <Text style={styles.headerSubtitle}>Your Subjects ({state.subjects.length})</Text>
                </View>

                {state.subjects.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyEmoji}>📚</Text>
                        <Text style={styles.emptyText}>No subjects added yet</Text>
                    </View>
                ) : (
                    state.subjects.map((subject) => {
                        const stats = getSubjectAttendance(subject.id, state);
                        return (
                            <View key={subject.id} style={styles.subjectCard}>
                                <View style={styles.subjectInfo}>
                                    <View style={styles.subjectHeader}>
                                        <View style={[styles.colorDot, { backgroundColor: subject.color }]} />
                                        <Text style={styles.subjectName} numberOfLines={1}>
                                            {subject.name}
                                        </Text>
                                    </View>
                                    {subject.teacher ? (
                                        <Text style={styles.teacherName}>Prof. {subject.teacher}</Text>
                                    ) : null}
                                    <Text style={styles.statsText}>
                                        {stats.percentage}% • {stats.attendedUnits}/{stats.totalUnits} marks
                                    </Text>
                                </View>

                                <View style={styles.actions}>
                                    <TouchableOpacity
                                        style={styles.actionButton}
                                        onPress={() => openModal(subject)}
                                    >
                                        <Text style={styles.actionIcon}>✏️</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.actionButton}
                                        onPress={() => handleDelete(subject)}
                                    >
                                        <Text style={styles.actionIcon}>🗑️</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })
                )}

                <TouchableOpacity style={styles.addButton} onPress={() => openModal()}>
                    <Text style={styles.addButtonText}>+ Add New Subject</Text>
                </TouchableOpacity>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Edit/Add Modal */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {editingSubject ? 'Edit Subject' : 'Add New Subject'}
                            </Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Text style={styles.closeModalText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.inputLabel}>Subject Name *</Text>
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            placeholder="e.g., Data Structures"
                            placeholderTextColor={COLORS.textMuted}
                        />

                        <Text style={styles.inputLabel}>Teacher (Optional)</Text>
                        <TextInput
                            style={styles.input}
                            value={teacher}
                            onChangeText={setTeacher}
                            placeholder="e.g., Prof. Smith"
                            placeholderTextColor={COLORS.textMuted}
                        />

                        <Text style={styles.inputLabel}>Color</Text>
                        <View style={styles.colorPalette}>
                            {THEME_COLORS.map(color => (
                                <TouchableOpacity
                                    key={color}
                                    style={[
                                        styles.colorOption,
                                        { backgroundColor: color },
                                        selectedColor === color && styles.colorOptionSelected
                                    ]}
                                    onPress={() => setSelectedColor(color)}
                                />
                            ))}
                        </View>

                        <Text style={styles.inputLabel}>Initial Attendance</Text>
                        <View style={styles.attendanceRow}>
                            <View style={styles.attendanceInputContainer}>
                                <Text style={styles.attendanceLabel}>Attended:</Text>
                                <TextInput
                                    style={styles.attendanceInput}
                                    value={attended}
                                    onChangeText={setAttended}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={styles.attendanceInputContainer}>
                                <Text style={styles.attendanceLabel}>Total:</Text>
                                <TextInput
                                    style={styles.attendanceInput}
                                    value={total}
                                    onChangeText={setTotal}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        <View style={styles.modalActions}>
                            <Button
                                title="Cancel"
                                variant="outline"
                                onPress={() => setModalVisible(false)}
                                style={styles.modalButton}
                            />
                            <Button
                                title={editingSubject ? 'Save' : 'Add'}
                                onPress={handleSave}
                                style={styles.modalButton}
                            />
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: SPACING.md,
    },
    header: {
        paddingHorizontal: SPACING.lg,
        marginBottom: SPACING.md,
    },
    headerSubtitle: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    subjectCard: {
        backgroundColor: COLORS.cardBackground,
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.md,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...SHADOWS.small,
    },
    subjectInfo: {
        flex: 1,
    },
    subjectHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    colorDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: SPACING.sm,
    },
    subjectName: {
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
        color: COLORS.textPrimary,
        flex: 1,
    },
    teacherName: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        marginBottom: 2,
        marginLeft: SPACING.md + 4,
    },
    statsText: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
        marginLeft: SPACING.md + 4,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionButton: {
        padding: SPACING.sm,
        marginLeft: SPACING.sm,
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.sm,
    },
    actionIcon: {
        fontSize: 16,
    },
    addButton: {
        marginHorizontal: SPACING.lg,
        marginTop: SPACING.sm,
        padding: SPACING.md,
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        borderStyle: 'dashed',
    },
    addButtonText: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.primary,
    },
    emptyState: {
        alignItems: 'center',
        padding: SPACING.xxl,
    },
    emptyEmoji: {
        fontSize: 48,
        marginBottom: SPACING.md,
    },
    emptyText: {
        fontSize: FONT_SIZES.md,
        color: COLORS.textSecondary,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: COLORS.cardBackground,
        borderTopLeftRadius: BORDER_RADIUS.xl,
        borderTopRightRadius: BORDER_RADIUS.xl,
        padding: SPACING.xl,
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.lg,
    },
    modalTitle: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    closeModalText: {
        fontSize: 24,
        color: COLORS.textMuted,
        padding: SPACING.xs,
    },
    inputLabel: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginBottom: SPACING.xs,
        marginTop: SPACING.md,
    },
    input: {
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        fontSize: FONT_SIZES.md,
        color: COLORS.textPrimary,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    colorPalette: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
        marginTop: SPACING.xs,
    },
    colorOption: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 3,
        borderColor: 'transparent',
    },
    colorOptionSelected: {
        borderColor: COLORS.textPrimary,
    },
    attendanceRow: {
        flexDirection: 'row',
        gap: SPACING.md,
    },
    attendanceInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.md,
        paddingHorizontal: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    attendanceLabel: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        marginRight: SPACING.sm,
    },
    attendanceInput: {
        flex: 1,
        paddingVertical: SPACING.md,
        fontSize: FONT_SIZES.md,
        color: COLORS.textPrimary,
    },
    modalActions: {
        flexDirection: 'row',
        gap: SPACING.md,
        marginTop: SPACING.xl,
    },
    modalButton: {
        flex: 1,
    },
});

export default EditSubjectsScreen;
