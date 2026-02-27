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
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../../components/common/Button';
import { useApp } from '../../context/AppContext';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS, FONT_SIZES } from '../../theme/theme';
import { showAlert } from '../../utils/alert';
import { formatMinutesToTime, parseTimeToMinutes } from '../../utils/dateHelpers';

// Formatter for the TimeStepper display
const formatMins = (totalMins) => {
    const hours24 = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    const period = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
    return `${hours12}:${String(mins).padStart(2, '0')} ${period}`;
};

// Reusable micro-stepper for the modal
const TimeStepper = ({ value, min, max, onChange, label }) => (
    <View style={styles.stepperContainer}>
        <Text style={styles.stepperLabel}>{label}</Text>
        <View style={styles.stepperControls}>
            <TouchableOpacity
                style={styles.stepButton}
                onPress={() => onChange(Math.max(min, value - 5))}
            >
                <Text style={styles.stepButtonText}>-</Text>
            </TouchableOpacity>

            <View style={styles.stepperValueContainer}>
                <Text style={styles.stepperValue}>{formatMins(value)}</Text>
            </View>

            <TouchableOpacity
                style={styles.stepButton}
                onPress={() => onChange(Math.min(max, value + 5))}
            >
                <Text style={styles.stepButtonText}>+</Text>
            </TouchableOpacity>
        </View>
    </View>
);

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const THEME_COLORS = ['#FF6B6B', '#FF9F43', '#FDCB6E', '#1DD1A1', '#48DBFB', '#5F27CD', '#C8D6E5', '#222F3E'];

export default function TimetableBuilderScreen({ navigation }) {
    const { state, dispatch } = useApp();

    // UI State
    const [modalVisible, setModalVisible] = useState(false);
    const [newSubjectMode, setNewSubjectMode] = useState(false);

    // Selection state
    const [selectedCell, setSelectedCell] = useState(null); // { day, slotIndex }
    const [selectedSubjectId, setSelectedSubjectId] = useState(null);

    // Custom Time Override State
    const [classStartMins, setClassStartMins] = useState(0);
    const [classEndMins, setClassEndMins] = useState(0);

    // New Subject State
    const [subjectName, setSubjectName] = useState('');
    const [subjectTeacher, setSubjectTeacher] = useState('');
    const [subjectColor, setSubjectColor] = useState(THEME_COLORS[0]);

    // Local timetable state (we'll save to context on finish or incrementally)
    // To make it easy, we can just update the actual context state directly
    const timetable = state.timetable;
    const timeSlots = state.timeSlots; // Assume already sorted from previous screen

    const handleCellTap = (day, slotIndex, timeSlot) => {
        const existingClass = timetable[day].find(c => c.slotId === timeSlot.id);

        setSelectedCell({ day, slotIndex, timeSlotId: timeSlot.id });

        // Initialize the custom times to either the existing override, or the scaffold defaults
        const defaultStart = parseTimeToMinutes(timeSlot.start);
        const defaultEnd = parseTimeToMinutes(timeSlot.end);

        if (existingClass) {
            setSelectedSubjectId(existingClass.subjectId);
            setClassStartMins(existingClass.customStart ? parseTimeToMinutes(existingClass.customStart) : defaultStart);
            setClassEndMins(existingClass.customEnd ? parseTimeToMinutes(existingClass.customEnd) : defaultEnd);

            // If the user previously merged 2 slots together, we want the modal end time to reflect that next slot's end time
            const nextSlot = timeSlots[slotIndex + 1];
            if (nextSlot) {
                const nextClass = timetable[day].find(c => c.slotId === nextSlot.id);
                if (nextClass && nextClass.subjectId === existingClass.subjectId && !existingClass.customEnd) {
                    setClassEndMins(parseTimeToMinutes(nextSlot.end));
                }
            }
        } else {
            setSelectedSubjectId(null);
            setClassStartMins(defaultStart);
            setClassEndMins(defaultEnd);
        }
        setNewSubjectMode(false);
        setModalVisible(true);
    };

    const handleCreateSubject = () => {
        if (!subjectName.trim()) {
            showAlert('Error', 'Subject name is required.');
            return;
        }

        const newId = Date.now().toString();
        dispatch({
            type: 'ADD_SUBJECT',
            payload: {
                id: newId,
                name: subjectName.trim(),
                teacher: subjectTeacher.trim(),
                color: subjectColor,
                initialAttended: 0,
                initialTotal: 0,
            }
        });

        setSelectedSubjectId(newId);
        setNewSubjectMode(false);
        setSubjectName('');
        setSubjectTeacher('');
    };

    const handleSaveClass = () => {
        if (!selectedSubjectId) {
            showAlert('Error', 'Please select a subject or add a new one.');
            return;
        }

        if (classStartMins >= classEndMins) {
            showAlert('Invalid Time', 'End time must be after start time.');
            return;
        }

        const { day, slotIndex, timeSlotId } = selectedCell;
        let daySlots = [...timetable[day]];

        const defaultStartStr = timeSlots[slotIndex].start;
        const defaultEndStr = timeSlots[slotIndex].end;

        const customStartStr = formatMinutesToTime(classStartMins);
        const customEndStr = formatMinutesToTime(classEndMins);

        // Only save overrides if they changed from the scaffolding
        const overrides = {};
        if (customStartStr !== defaultStartStr) overrides.customStart = customStartStr;
        if (customEndStr !== defaultEndStr) overrides.customEnd = customEndStr;

        // Remove whatever was in this slot
        daySlots = daySlots.filter(c => c.slotId !== timeSlotId);

        // Add current slot back
        daySlots.push({
            slotId: timeSlotId,
            subjectId: selectedSubjectId,
            ...overrides
        });

        // 2-hour multi-slot mapping: The old system visually merged slots if the next chronological slot belonged to the same subject.
        // We will maintain this backwards-compatible visual logic: if the user selected an EndTime that spills into the next slot's jurisdiction,
        // we will silently occupy the next slot as well so the visual renderer merges them smoothly and the schedule doesn't look empty there.
        const nextSlot = timeSlots[slotIndex + 1];
        if (nextSlot) {
            const nextSlotStart = parseTimeToMinutes(nextSlot.start);
            // If they increased the duration so much it overlaps with the next block entirely
            if (classEndMins > nextSlotStart) {
                daySlots = daySlots.filter(c => c.slotId !== nextSlot.id);
                daySlots.push({
                    slotId: nextSlot.id,
                    subjectId: selectedSubjectId,
                    customStart: nextSlot.start, // effectively hides visual start text for the second half
                    customEnd: customEndStr !== nextSlot.end ? customEndStr : undefined,
                });
            } else {
                // Check if it was previously occupied by this class and needs clearing
                const nextClass = daySlots.find(c => c.slotId === nextSlot.id);
                if (nextClass && nextClass.subjectId === selectedSubjectId) {
                    daySlots = daySlots.filter(c => c.slotId !== nextSlot.id);
                }
            }
        }

        dispatch({ type: 'SET_TIMETABLE_DAY', payload: { day, slots: daySlots } });
        setModalVisible(false);
    };

    const handleDeleteClass = () => {
        const { day, slotIndex, timeSlotId } = selectedCell;
        let daySlots = [...timetable[day]];

        const classToRemove = daySlots.find(c => c.slotId === timeSlotId);

        // Remove from current
        daySlots = daySlots.filter(c => c.slotId !== timeSlotId);

        // Check if next slot was a spillover from this 2+hr class and clear it too
        const nextSlot = timeSlots[slotIndex + 1];
        if (nextSlot && classToRemove) {
            const nextClass = daySlots.find(c => c.slotId === nextSlot.id);
            if (nextClass && nextClass.subjectId === classToRemove.subjectId) {
                daySlots = daySlots.filter(c => c.slotId !== nextSlot.id);
            }
        }

        dispatch({ type: 'SET_TIMETABLE_DAY', payload: { day, slots: daySlots } });
        setModalVisible(false);
    };

    const handleFinish = () => {
        navigation.navigate('AttendanceStats');
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
            <View style={styles.headerBox}>
                <Text style={styles.header}>📅 Build Timetable</Text>
                <Text style={styles.subtitle}>Tap any cell to add a class</Text>
            </View>

            <View style={styles.gridContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={true} bounces={false}>
                    <ScrollView bounces={false}>
                        {/* Header Row */}
                        <View style={styles.row}>
                            <View style={[styles.cell, styles.headerCell, styles.cornerCell]} />
                            {timeSlots.map(slot => (
                                <View key={slot.id} style={[styles.cell, styles.headerCell]}>
                                    <Text style={styles.timeText}>{slot.start.substring(0, 5)}</Text>
                                    <Text style={styles.timeText}>{slot.end.substring(0, 5)}</Text>
                                </View>
                            ))}
                        </View>

                        {/* Day Rows */}
                        {DAYS.map(day => {
                            let skipNext = false;

                            return (
                                <View key={day} style={styles.row}>
                                    <View style={[styles.cell, styles.dayCell]}>
                                        <Text style={styles.dayText}>{day.substring(0, 3)}</Text>
                                    </View>

                                    {timeSlots.map((slot, index) => {
                                        if (skipNext) {
                                            skipNext = false;
                                            return null;
                                        }

                                        const classInfo = timetable[day].find(c => c.slotId === slot.id);
                                        const subject = classInfo ? state.subjects.find(s => s.id === classInfo.subjectId) : null;

                                        // Check if next slot has the same subject (2-hour class visually merged)
                                        let isMerged = false;
                                        if (subject) {
                                            const nextSlot = timeSlots[index + 1];
                                            if (nextSlot) {
                                                const nextClass = timetable[day].find(c => c.slotId === nextSlot.id);
                                                if (nextClass && nextClass.subjectId === subject.id) {
                                                    isMerged = true;
                                                    skipNext = true;
                                                }
                                            }
                                        }

                                        if (subject) {
                                            const displayStart = classInfo.customStart ? classInfo.customStart.substring(0, 5) : slot.start.substring(0, 5);
                                            const displayEnd = classInfo.customEnd ? classInfo.customEnd.substring(0, 5) : slot.end.substring(0, 5);

                                            // Provide visual distinction if it's deeply customized time
                                            const isCustom = classInfo.customStart || classInfo.customEnd;

                                            return (
                                                <TouchableOpacity
                                                    key={slot.id}
                                                    style={[
                                                        styles.cell,
                                                        styles.filledCell,
                                                        { backgroundColor: subject.color + '40', borderLeftColor: subject.color },
                                                        isMerged && { width: 140 } // Double width (70*2)
                                                    ]}
                                                    onPress={() => handleCellTap(day, index, slot)}
                                                >
                                                    <Text style={[styles.subjectText, { color: subject.color }]} numberOfLines={1}>
                                                        {subject.name}
                                                    </Text>
                                                    {isCustom && (
                                                        <Text style={[styles.customTimeText, { color: subject.color }]} numberOfLines={1}>
                                                            {displayStart} - {displayEnd}
                                                        </Text>
                                                    )}
                                                </TouchableOpacity>
                                            );
                                        }

                                        return (
                                            <TouchableOpacity
                                                key={slot.id}
                                                style={styles.cell}
                                                onPress={() => handleCellTap(day, index, slot)}
                                            >
                                                <Text style={styles.addText}>+</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            );
                        })}
                    </ScrollView>
                </ScrollView>
            </View>

            <View style={styles.footer}>
                <Button title="Continue" onPress={handleFinish} />
            </View>

            {/* Modal for Adding/Editing Class */}
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
                                {newSubjectMode ? 'New Subject' : 'Select Subject'}
                            </Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Text style={styles.closeText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {newSubjectMode ? (
                            <View>
                                <Text style={styles.inputLabel}>Subject Name *</Text>
                                <TextInput
                                    style={styles.input}
                                    value={subjectName}
                                    onChangeText={setSubjectName}
                                    placeholder="e.g., Data Structures"
                                    autoFocus
                                />

                                <Text style={styles.inputLabel}>Teacher (Optional)</Text>
                                <TextInput
                                    style={styles.input}
                                    value={subjectTeacher}
                                    onChangeText={setSubjectTeacher}
                                    placeholder="e.g., Prof. Smith"
                                />

                                <Text style={styles.inputLabel}>Color</Text>
                                <View style={styles.colorPalette}>
                                    {THEME_COLORS.map(color => (
                                        <TouchableOpacity
                                            key={color}
                                            style={[
                                                styles.colorOption,
                                                { backgroundColor: color },
                                                subjectColor === color && styles.colorOptionSelected
                                            ]}
                                            onPress={() => setSubjectColor(color)}
                                        />
                                    ))}
                                </View>

                                <View style={styles.modalActions}>
                                    <Button
                                        title="Cancel"
                                        variant="outline"
                                        onPress={() => setNewSubjectMode(false)}
                                        style={styles.flex1}
                                    />
                                    <Button
                                        title="Create & Select"
                                        onPress={handleCreateSubject}
                                        style={styles.flex1}
                                    />
                                </View>
                            </View>
                        ) : (
                            <View>
                                <Text style={styles.slotDetails}>
                                    {selectedCell?.day}, {selectedCell ? timeSlots[selectedCell.slotIndex].start.substring(0, 5) : ''}
                                </Text>

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
                                            setNewSubjectMode(true);
                                            // Pick unused color
                                            const usedColors = state.subjects.map(s => s.color);
                                            const unused = THEME_COLORS.find(c => !usedColors.includes(c)) || THEME_COLORS[0];
                                            setSubjectColor(unused);
                                        }}
                                    >
                                        <Text style={styles.newSubjectButtonText}>+ Create New Subject</Text>
                                    </TouchableOpacity>
                                </ScrollView>

                                <View style={styles.timeOverridesContainer}>
                                    <TimeStepper
                                        label="Class Starts:"
                                        value={classStartMins}
                                        min={0}
                                        max={classEndMins - 5}
                                        onChange={(val) => setClassStartMins(val)}
                                    />
                                    <View style={styles.microDivider} />
                                    <TimeStepper
                                        label="Class Ends:"
                                        value={classEndMins}
                                        min={classStartMins + 5}
                                        max={1440}
                                        onChange={(val) => setClassEndMins(val)}
                                    />
                                </View>

                                <View style={styles.modalActions}>
                                    {selectedSubjectId ? (
                                        <TouchableOpacity style={styles.deleteIconButton} onPress={handleDeleteClass}>
                                            <Text style={styles.deleteIconText}>🗑️</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <Button
                                            title="Cancel"
                                            variant="outline"
                                            onPress={() => setModalVisible(false)}
                                            style={styles.flex1}
                                        />
                                    )}
                                    <Button
                                        title="Save Class"
                                        onPress={handleSaveClass}
                                        style={styles.flex2}
                                    />
                                </View>
                            </View>
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
    },
    headerBox: {
        padding: SPACING.lg,
    },
    header: {
        ...TYPOGRAPHY.headerMedium,
        color: COLORS.textPrimary,
        marginBottom: SPACING.xs,
    },
    subtitle: {
        ...TYPOGRAPHY.body,
        color: COLORS.textSecondary,
    },
    gridContainer: {
        flex: 1,
        marginHorizontal: SPACING.md,
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    cell: {
        width: 70, // Fixed width for nice grid
        height: 60,
        borderRightWidth: 1,
        borderRightColor: COLORS.border,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.cardBackground, // Empty cell bg
    },
    cornerCell: {
        width: 50,
        backgroundColor: COLORS.inputBackground,
    },
    headerCell: {
        backgroundColor: COLORS.inputBackground,
        height: 40,
    },
    dayCell: {
        width: 50,
        backgroundColor: COLORS.inputBackground,
    },
    timeText: {
        fontSize: 10,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
    dayText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: 'bold',
        color: COLORS.textSecondary,
    },
    filledCell: {
        borderLeftWidth: 4,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 2,
    },
    subjectText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '700',
        textAlign: 'center',
    },
    addText: {
        color: COLORS.textMuted,
        fontSize: 24,
    },
    footer: {
        padding: SPACING.lg,
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
    closeText: {
        fontSize: 24,
        color: COLORS.textMuted,
    },
    slotDetails: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.primaryLight,
        backgroundColor: COLORS.primary + '10', // Very light tint
        paddingVertical: SPACING.xs,
        paddingHorizontal: SPACING.md,
        borderRadius: BORDER_RADIUS.sm,
        alignSelf: 'flex-start',
        marginBottom: SPACING.md,
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
    subjectList: {
        maxHeight: 180,
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
    modalActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
        marginTop: SPACING.xl,
    },
    deleteIconButton: {
        backgroundColor: COLORS.dangerLight,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        alignItems: 'center',
        justifyContent: 'center',
        height: 50,
        width: 50,
    },
    deleteIconText: {
        fontSize: 20,
    },
    flex1: {
        flex: 1,
    },
    flex2: {
        flex: 2,
    },
    timeOverridesContainer: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        marginTop: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.small,
    },
    microDivider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginVertical: SPACING.md,
    },
    stepperContainer: {
        flexDirection: 'column',
    },
    stepperLabel: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: SPACING.sm,
    },
    stepperControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    stepButton: {
        padding: SPACING.sm,
        width: 44,
        alignItems: 'center',
    },
    stepButtonText: {
        fontSize: 20,
        color: COLORS.primary,
        fontWeight: '600',
    },
    stepperValueContainer: {
        flex: 1,
        alignItems: 'center',
    },
    stepperValue: {
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    customTimeText: {
        fontSize: 10,
        fontWeight: '600',
        marginTop: 2,
        opacity: 0.8,
    }
});
