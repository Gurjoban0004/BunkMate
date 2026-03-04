import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Modal,
    TextInput,
} from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import Button from '../../components/common/Button';
import { formatTimeRange } from '../../utils/dateHelpers';
import { showAlert } from '../../utils/alert';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const EditTimetableScreen = ({ navigation }) => {
    const { state, dispatch } = useApp();
    const [activeDay, setActiveDay] = useState('Monday');

    // Slot Edit Modal
    const [slotModalVisible, setSlotModalVisible] = useState(false);
    const [editingSlot, setEditingSlot] = useState(null); // The actual time slot object
    const [selectedSubjectId, setSelectedSubjectId] = useState(null);
    const [isTwoHours, setIsTwoHours] = useState(false);

    // Global Time Slot Modal
    const [timeModalVisible, setTimeModalVisible] = useState(false);
    const [newStartTime, setNewStartTime] = useState('09:00'); // simple string for now HH:mm
    const [newEndTime, setNewEndTime] = useState('10:00');

    // Get ordered time slots
    const orderedTimeSlots = useMemo(() => {
        return [...(state.timeSlots || [])].sort((a, b) => {
            const timeA = new Date(`1970/01/01 ${a.start}`).getTime();
            const timeB = new Date(`1970/01/01 ${b.start}`).getTime();
            return timeA - timeB;
        });
    }, [state.timeSlots]);

    const activeDayClasses = state.timetable[activeDay] || [];

    const openSlotModal = (slot, existingClass = null) => {
        setEditingSlot(slot);
        if (existingClass) {
            setSelectedSubjectId(existingClass.subjectId);
            // Check if it's a 2-hour class by looking at the next slot
            const currentIndex = orderedTimeSlots.findIndex(s => s.id === slot.id);
            const nextSlot = orderedTimeSlots[currentIndex + 1];
            if (nextSlot) {
                const nextClass = activeDayClasses.find(c => c.slotId === nextSlot.id);
                setIsTwoHours(nextClass && nextClass.subjectId === existingClass.subjectId);
            } else {
                setIsTwoHours(false);
            }
        } else {
            setSelectedSubjectId(null);
            setIsTwoHours(false);
        }
        setSlotModalVisible(true);
    };

    const handleSaveSlot = () => {
        if (!selectedSubjectId) {
            showAlert('Error', 'Please select a subject');
            return;
        }

        let newDaySlots = [...activeDayClasses.filter(c => c.slotId !== editingSlot.id)];
        newDaySlots.push({ slotId: editingSlot.id, subjectId: selectedSubjectId });

        if (isTwoHours) {
            const currentIndex = orderedTimeSlots.findIndex(s => s.id === editingSlot.id);
            const nextSlot = orderedTimeSlots[currentIndex + 1];
            if (nextSlot) {
                // Remove existing class in next slot and add this one
                newDaySlots = newDaySlots.filter(c => c.slotId !== nextSlot.id);
                newDaySlots.push({ slotId: nextSlot.id, subjectId: selectedSubjectId });
            }
        }

        dispatch({
            type: 'SET_TIMETABLE_DAY',
            payload: { day: activeDay, slots: newDaySlots },
        });

        setSlotModalVisible(false);
    };

    const handleDeleteClass = (slotId) => {
        showAlert('Remove Class?', 'This will clear this time slot and make it a Free Period.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: () => {
                    const newDaySlots = activeDayClasses.filter(c => c.slotId !== slotId);
                    dispatch({
                        type: 'SET_TIMETABLE_DAY',
                        payload: { day: activeDay, slots: newDaySlots },
                    });
                }
            }
        ]);
    };

    const handleAddTimeSlot = () => {
        // Validate HH:MM format
        const regex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!regex.test(newStartTime) || !regex.test(newEndTime)) {
            showAlert('Invalid format', 'Please use HH:MM format (24-hour)');
            return;
        }

        const newSlot = {
            id: Date.now().toString(),
            start: newStartTime,
            end: newEndTime,
        };

        dispatch({
            type: 'SET_TIME_SLOTS',
            payload: [...state.timeSlots, newSlot],
        });

        setTimeModalVisible(false);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daysScroll}>
                    {DAYS.map(day => (
                        <TouchableOpacity
                            key={day}
                            style={[styles.dayTab, activeDay === day && styles.dayTabActive]}
                            onPress={() => setActiveDay(day)}
                        >
                            <Text style={[styles.dayTabText, activeDay === day && styles.dayTabTextActive]}>
                                {day.substring(0, 3)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.dayTitle}>{activeDay}'s Classes</Text>

                {orderedTimeSlots.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No time slots configured.</Text>
                    </View>
                ) : (
                    orderedTimeSlots.map((slot, index) => {
                        const classData = activeDayClasses.find(c => c.slotId === slot.id);
                        const subject = classData ? state.subjects.find(s => s.id === classData.subjectId) : null;

                        // Check if this slot should be merged visually with the previous
                        if (subject && index > 0) {
                            const prevSlot = orderedTimeSlots[index - 1];
                            const prevClassData = activeDayClasses.find(c => c.slotId === prevSlot.id);
                            if (prevClassData && prevClassData.subjectId === subject.id) {
                                return null; // Skip rendering, it's merged into the previous card
                            }
                        }

                        let displayStart = slot.start;
                        let displayEnd = slot.end;

                        // Find the total span of this class
                        if (subject) {
                            let iterIndex = index + 1;
                            while (iterIndex < orderedTimeSlots.length) {
                                const nextSlot = orderedTimeSlots[iterIndex];
                                const nextClassData = activeDayClasses.find(c => c.slotId === nextSlot.id);
                                if (nextClassData && nextClassData.subjectId === subject.id) {
                                    displayEnd = nextSlot.end;
                                    iterIndex++;
                                } else {
                                    break;
                                }
                            }
                        }

                        return (
                            <View key={slot.id} style={styles.slotContainer}>
                                <Text style={styles.timeLabel}>
                                    {formatTimeRange(displayStart, displayEnd)}
                                </Text>

                                {subject ? (
                                    <View style={[styles.classCard, { borderLeftColor: subject.color }]}>
                                        <View style={styles.classInfo}>
                                            <Text style={styles.subjectName}>{subject.name}</Text>
                                            {subject.teacher ? (
                                                <Text style={styles.teacherName}>{subject.teacher}</Text>
                                            ) : null}
                                        </View>
                                        <View style={styles.actionButtons}>
                                            <TouchableOpacity
                                                style={styles.iconButton}
                                                onPress={() => openSlotModal(slot, classData)}
                                            >
                                                <Text>✏️</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.iconButton}
                                                onPress={() => handleDeleteClass(slot.id)}
                                            >
                                                <Text>🗑️</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={styles.freePeriodCard}
                                        onPress={() => openSlotModal(slot)}
                                    >
                                        <Text style={styles.freePeriodText}>+ Free Period (Tap to add class)</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        );
                    })
                )}

                <TouchableOpacity
                    style={styles.addSlotButton}
                    onPress={() => setTimeModalVisible(true)}
                >
                    <Text style={styles.addSlotButtonText}>+ Add New Time Slot</Text>
                </TouchableOpacity>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Class Edit/Add Modal */}
            <Modal
                visible={slotModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setSlotModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {selectedSubjectId ? 'Edit Class' : 'Add Class'}
                            </Text>
                            <TouchableOpacity onPress={() => setSlotModalVisible(false)}>
                                <Text style={styles.closeText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.slotTimeText}>
                            {formatTimeRange(editingSlot?.start, editingSlot?.end)}
                        </Text>

                        <Text style={styles.inputLabel}>Select Subject</Text>
                        <ScrollView style={styles.subjectList} nestedScrollEnabled>
                            {state.subjects.map(sub => (
                                <TouchableOpacity
                                    key={sub.id}
                                    style={[
                                        styles.subjectOption,
                                        selectedSubjectId === sub.id && styles.subjectOptionSelected,
                                    ]}
                                    onPress={() => setSelectedSubjectId(sub.id)}
                                >
                                    <View style={[styles.colorDot, { backgroundColor: sub.color }]} />
                                    <Text style={[
                                        styles.subjectOptionText,
                                        selectedSubjectId === sub.id && styles.subjectOptionTextSelected
                                    ]}>
                                        {sub.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                            <TouchableOpacity
                                style={styles.newSubjectButton}
                                onPress={() => {
                                    setSlotModalVisible(false);
                                    navigation.navigate('EditSubjects');
                                }}
                            >
                                <Text style={styles.newSubjectButtonText}>+ Create New Subject</Text>
                            </TouchableOpacity>
                        </ScrollView>

                        <Text style={styles.inputLabel}>Duration</Text>
                        <View style={styles.durationRow}>
                            <TouchableOpacity
                                style={[styles.durationButton, !isTwoHours && styles.durationButtonActive]}
                                onPress={() => setIsTwoHours(false)}
                            >
                                <Text style={[styles.durationText, !isTwoHours && styles.durationTextActive]}>1 Hour</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.durationButton, isTwoHours && styles.durationButtonActive]}
                                onPress={() => setIsTwoHours(true)}
                            >
                                <Text style={[styles.durationText, isTwoHours && styles.durationTextActive]}>2 Hours</Text>
                            </TouchableOpacity>
                        </View>
                        {isTwoHours && (
                            <Text style={styles.durationWarning}>
                                This will also assign the subject to the next time slot.
                            </Text>
                        )}

                        <View style={styles.modalActions}>
                            <Button
                                title="Cancel"
                                variant="outline"
                                onPress={() => setSlotModalVisible(false)}
                                style={styles.flex1}
                            />
                            <Button
                                title="Save"
                                onPress={handleSaveSlot}
                                style={styles.flex1}
                            />
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Time Slot Modal */}
            <Modal
                visible={timeModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setTimeModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Add Global Time Slot</Text>
                        <Text style={styles.modalSubtitle}>This will add a new slot to ALL days.</Text>

                        <Text style={styles.inputLabel}>Start Time (HH:MM)</Text>
                        <TextInput
                            style={styles.input}
                            value={newStartTime}
                            onChangeText={setNewStartTime}
                            placeholder="e.g., 14:00"
                        />

                        <Text style={styles.inputLabel}>End Time (HH:MM)</Text>
                        <TextInput
                            style={styles.input}
                            value={newEndTime}
                            onChangeText={setNewEndTime}
                            placeholder="e.g., 15:00"
                        />

                        <View style={styles.modalActions}>
                            <Button
                                title="Cancel"
                                variant="outline"
                                onPress={() => setTimeModalVisible(false)}
                                style={styles.flex1}
                            />
                            <Button
                                title="Add Slot"
                                onPress={handleAddTimeSlot}
                                style={styles.flex1}
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
    header: {
        backgroundColor: COLORS.cardBackground,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        paddingVertical: SPACING.sm,
    },
    daysScroll: {
        paddingHorizontal: SPACING.md,
    },
    dayTab: {
        paddingHorizontal: SPACING.lg,
        paddingVertical: 8,
        borderRadius: BORDER_RADIUS.full,
        marginHorizontal: 4,
    },
    dayTabActive: {
        backgroundColor: COLORS.primary,
    },
    dayTabText: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    dayTabTextActive: {
        color: COLORS.textOnPrimary,
    },
    content: {
        padding: SPACING.lg,
    },
    dayTitle: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: SPACING.lg,
    },
    slotContainer: {
        marginBottom: SPACING.md,
    },
    timeLabel: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginBottom: 4,
        marginLeft: 4,
    },
    classCard: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        flexDirection: 'row',
        alignItems: 'center',
        borderLeftWidth: 4,
        
        
        ...SHADOWS.small,
    },
    classInfo: {
        flex: 1,
    },
    subjectName: {
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    teacherName: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    actionButtons: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconButton: {
        padding: SPACING.sm,
        marginLeft: SPACING.xs,
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.sm,
    },
    freePeriodCard: {
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        alignItems: 'center',
        
        
        borderStyle: 'dashed',
    },
    freePeriodText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textMuted,
        fontWeight: '500',
    },
    addSlotButton: {
        marginTop: SPACING.lg,
        padding: SPACING.md,
        backgroundColor: COLORS.primaryLight,
        borderRadius: BORDER_RADIUS.md,
        alignItems: 'center',
    },
    addSlotButtonText: {
        color: COLORS.primary,
        fontWeight: '600',
        fontSize: FONT_SIZES.md,
    },
    emptyState: {
        padding: SPACING.xxl,
        alignItems: 'center',
    },
    emptyText: {
        color: COLORS.textMuted,
        fontSize: FONT_SIZES.md,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: COLORS.cardBackground,
        borderTopLeftRadius: BORDER_RADIUS.xl,
        borderTopRightRadius: BORDER_RADIUS.xl,
        padding: SPACING.xl,
        paddingBottom: 40,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    modalTitle: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    modalSubtitle: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        marginBottom: SPACING.md,
    },
    closeText: {
        fontSize: 24,
        color: COLORS.textMuted,
    },
    slotTimeText: {
        fontSize: FONT_SIZES.md,
        color: COLORS.primary,
        fontWeight: '600',
        marginBottom: SPACING.lg,
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
        
        
    },
    subjectList: {
        maxHeight: 200,
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.xs,
    },
    subjectOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.sm,
    },
    subjectOptionSelected: {
        backgroundColor: COLORS.primaryLight,
    },
    colorDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: SPACING.sm,
    },
    subjectOptionText: {
        fontSize: FONT_SIZES.md,
        color: COLORS.textPrimary,
    },
    subjectOptionTextSelected: {
        fontWeight: '600',
        color: COLORS.primary,
    },
    newSubjectButton: {
        padding: SPACING.md,
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        marginTop: SPACING.xs,
    },
    newSubjectButtonText: {
        color: COLORS.primary,
        fontWeight: '600',
    },
    durationRow: {
        flexDirection: 'row',
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: 4,
        marginTop: SPACING.xs,
    },
    durationButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: BORDER_RADIUS.sm,
    },
    durationButtonActive: {
        backgroundColor: COLORS.primary,
    },
    durationText: {
        fontWeight: '500',
        color: COLORS.textSecondary,
    },
    durationTextActive: {
        color: COLORS.textOnPrimary,
        fontWeight: '600',
    },
    durationWarning: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.warning,
        marginTop: SPACING.sm,
    },
    modalActions: {
        flexDirection: 'row',
        gap: SPACING.md,
        marginTop: SPACING.xl,
    },
    flex1: {
        flex: 1,
    }
});

export default EditTimetableScreen;
