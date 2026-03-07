import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Modal,
    Keyboard,
    TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { useApp } from '../../context/AppContext';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../../theme/theme';
import { showAlert } from '../../utils/alert';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

let subjectIdCounter = 1;

function formatTime(time24) {
    const styles = getStyles();
    const [h, m] = time24.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export default function TimetableScreen({ navigation }) {
    const styles = getStyles();
    const { state, dispatch } = useApp();
    const [selectedDay, setSelectedDay] = useState('Monday');
    const [timetable, setTimetable] = useState({
        Monday: [], Tuesday: [], Wednesday: [],
        Thursday: [], Friday: [], Saturday: [],
    });
    const [subjectsList, setSubjectsList] = useState([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedSlotId, setSelectedSlotId] = useState(null);
    const [newSubjectName, setNewSubjectName] = useState('');
    const scrollViewRef = useRef(null);

    const timeSlots = state.timeSlots;

    const getSlotSubject = (slotId) => {
        const entry = timetable[selectedDay].find((e) => e.slotId === slotId);
        if (!entry) return null;
        return subjectsList.find((s) => s.id === entry.subjectId) || null;
    };

    const openModal = (slotId) => {
        setSelectedSlotId(slotId);
        setNewSubjectName('');
        setModalVisible(true);
    };

    const assignSubject = (subjectId) => {
        setTimetable((prev) => {
            const daySlots = prev[selectedDay].filter((e) => e.slotId !== selectedSlotId);
            return { ...prev, [selectedDay]: [...daySlots, { slotId: selectedSlotId, subjectId }] };
        });
        setModalVisible(false);
    };

    const addNewSubject = () => {
        const name = newSubjectName.trim();
        if (!name) {
            showAlert('Error', 'Please enter a subject name.');
            return;
        }
        const existing = subjectsList.find((s) => s.name.toLowerCase() === name.toLowerCase());
        if (existing) { assignSubject(existing.id); return; }
        const colorIndex = subjectsList.length % COLORS.subjectPalette.length;
        const newSub = {
            id: `sub-${subjectIdCounter++}`,
            name,
            teacher: '',
            color: COLORS.subjectPalette[colorIndex],
            initialTotal: 0,
            initialAttended: 0,
            createdAt: new Date().toISOString(),
        };
        setSubjectsList((prev) => [...prev, newSub]);
        assignSubject(newSub.id);
    };

    const clearSlot = (slotId) => {
        setTimetable((prev) => ({
            ...prev,
            [selectedDay]: prev[selectedDay].filter((e) => e.slotId !== slotId),
        }));
    };

    const handleContinue = () => {
        if (subjectsList.length === 0) {
            showAlert('No Subjects', 'Please add at least one subject to your timetable.');
            return;
        }
        dispatch({ type: 'SET_TIMETABLE', payload: timetable });
        dispatch({ type: 'SET_SUBJECTS', payload: subjectsList });
        navigation.navigate('ExistingAttendance');
    };

    const dayCount = (day) => timetable[day].length;

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <Text style={styles.header}>Build Your Timetable</Text>
            <Text style={styles.subtitle}>
                Tap a slot to assign a subject. Same subject in consecutive slots = multi-hour class.
            </Text>

            {/* Day tabs */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.dayTabs}
                contentContainerStyle={styles.dayTabsContent}
            >
                {DAYS.map((day) => (
                    <TouchableOpacity
                        key={day}
                        style={[styles.dayTab, selectedDay === day && styles.dayTabActive]}
                        onPress={() => setSelectedDay(day)}
                    >
                        <Text style={[styles.dayTabText, selectedDay === day && styles.dayTabTextActive]}>
                            {day.slice(0, 3)}
                        </Text>
                        {dayCount(day) > 0 && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{dayCount(day)}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Slots grid */}
            <ScrollView
                ref={scrollViewRef}
                style={styles.slotsContainer}
                keyboardShouldPersistTaps="handled"
            >
                {timeSlots.map((slot) => {
                    const subject = getSlotSubject(slot.id);
                    return (
                        <TouchableOpacity
                            key={slot.id}
                            style={[styles.slotRow, subject && styles.slotFilled]}
                            onPress={() => (subject ? clearSlot(slot.id) : openModal(slot.id))}
                            onLongPress={() => subject && clearSlot(slot.id)}
                        >
                            <Text style={styles.slotTime}>
                                {formatTime(slot.start)} — {formatTime(slot.end)}
                            </Text>
                            <Text style={[styles.slotSubject, !subject && styles.slotEmpty]}>
                                {subject ? subject.name : 'Tap to add'}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
                <View style={{ height: 80 }} />
            </ScrollView>

            <Button title="Continue" onPress={handleContinue} />

            {/* Subject picker modal */}
            <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Select Subject</Text>

                            {subjectsList.length > 0 && (
                                <ScrollView style={styles.existingSubjects} nestedScrollEnabled>
                                    <Text style={styles.modalSectionTitle}>Existing:</Text>
                                    {subjectsList.map((sub) => (
                                        <TouchableOpacity
                                            key={sub.id}
                                            style={styles.subjectOption}
                                            onPress={() => assignSubject(sub.id)}
                                        >
                                            <Text style={styles.subjectOptionText}>{sub.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            )}

                            <Text style={styles.modalSectionTitle}>
                                {subjectsList.length > 0 ? 'Or add new:' : 'Add subject:'}
                            </Text>
                            <Input
                                placeholder="Subject name (e.g. DSOOPS)"
                                value={newSubjectName}
                                onChangeText={setNewSubjectName}
                                autoFocus
                            />
                            <View style={styles.modalActions}>
                                <Button
                                    title="Cancel"
                                    variant="secondary"
                                    onPress={() => setModalVisible(false)}
                                    style={styles.modalButton}
                                />
                                <Button
                                    title="Add"
                                    onPress={addNewSubject}
                                    style={styles.modalButton}
                                />
                            </View>
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </SafeAreaView>
    );
}

const getStyles = () => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        padding: SPACING.screenPadding,
    },
    header: {
        ...TYPOGRAPHY.headerMedium,
        color: COLORS.textPrimary,
        marginBottom: SPACING.xs,
    },
    subtitle: {
        ...TYPOGRAPHY.bodySmall,
        color: COLORS.textSecondary,
        marginBottom: SPACING.md,
    },
    dayTabs: {
        maxHeight: 50,
        marginBottom: SPACING.md,
    },
    dayTabsContent: {
        gap: SPACING.sm,
    },
    dayTab: {
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        borderRadius: BORDER_RADIUS.full,
        backgroundColor: COLORS.cardBackground,


        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
    },
    dayTabActive: {
        backgroundColor: COLORS.primary,

    },
    dayTabText: {
        ...TYPOGRAPHY.button,
        color: COLORS.textSecondary,
    },
    dayTabTextActive: {
        color: COLORS.textOnPrimary,
    },
    badge: {
        backgroundColor: COLORS.success,
        borderRadius: BORDER_RADIUS.full,
        width: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textOnPrimary,
        fontWeight: 'bold',
    },
    slotsContainer: {
        flex: 1,
        marginBottom: SPACING.md,
    },
    slotRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: COLORS.cardBackground,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.sm,
        marginBottom: SPACING.sm,
        borderLeftWidth: 3,
        borderLeftColor: 'transparent',


        ...SHADOWS.small,
    },
    slotFilled: {
        borderLeftColor: COLORS.primary,
        backgroundColor: COLORS.primaryLight,
    },
    slotTime: {
        ...TYPOGRAPHY.bodySmall,
        color: COLORS.textSecondary,
        width: 140,
    },
    slotSubject: {
        ...TYPOGRAPHY.body,
        color: COLORS.textPrimary,
        flex: 1,
        textAlign: 'right',
    },
    slotEmpty: {
        color: COLORS.textMuted,
        fontStyle: 'italic',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: COLORS.overlay,
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: COLORS.cardBackground,
        borderTopLeftRadius: BORDER_RADIUS.lg,
        borderTopRightRadius: BORDER_RADIUS.lg,
        padding: SPACING.screenPadding,
        paddingBottom: SPACING.xxl,
        ...SHADOWS.large,
    },
    modalTitle: {
        ...TYPOGRAPHY.headerSmall,
        color: COLORS.textPrimary,
        marginBottom: SPACING.md,
    },
    modalSectionTitle: {
        ...TYPOGRAPHY.bodySmall,
        color: COLORS.textSecondary,
        marginBottom: SPACING.sm,
        marginTop: SPACING.md,
    },
    existingSubjects: {
        marginBottom: SPACING.sm,
    },
    subjectOption: {
        padding: SPACING.md,
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.sm,
        marginBottom: SPACING.sm,


    },
    subjectOptionText: {
        ...TYPOGRAPHY.body,
        color: COLORS.textPrimary,
    },
    modalActions: {
        flexDirection: 'row',
        gap: SPACING.sm,
        marginTop: SPACING.md,
    },
    modalButton: {
        flex: 1,
    },
});
