import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Platform,
    Modal,
    TextInput,
    KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../../components/common/Button';
import { useApp } from '../../context/AppContext';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS, FONT_SIZES } from '../../theme/theme';
import { showAlert } from '../../utils/alert';
import { formatMinutesToTime, parseTimeToMinutes } from '../../utils/dateHelpers';
import FloatingBackButton from '../../components/common/FloatingBackButton';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function TimetableBuilderScreen({ navigation }) {
    const styles = getStyles();
    const { state, dispatch } = useApp();

    const [selectedBrush, setSelectedBrush] = useState(null); // subjectId or 'ERASER'
    const [showAddModal, setShowAddModal] = useState(false);
    const [newSubjectName, setNewSubjectName] = useState('');

    const timetable = state.timetable;
    const timeSlots = state.timeSlots || [];

    // 2. Painting logic
    const handleCellTap = (day, slotIndex, timeSlot) => {
        if (!selectedBrush) {
            showAlert('Select a Tool', 'Please select a subject or the eraser from the palette below first.');
            return;
        }

        let daySlots = [...timetable[day]];

        // Remove existing class in this slot
        daySlots = daySlots.filter(c => c.slotId !== timeSlot.id);

        if (selectedBrush !== 'ERASER') {
            daySlots.push({
                slotId: timeSlot.id,
                subjectId: selectedBrush,
            });
        }

        dispatch({ type: 'SET_TIMETABLE_DAY', payload: { day, slots: daySlots } });
    };

    // 3. Copy Day logic
    const handleCopyDay = (targetDay, prevDay) => {
        const slotsToCopy = [...timetable[prevDay]];
        dispatch({ type: 'SET_TIMETABLE_DAY', payload: { day: targetDay, slots: slotsToCopy } });
    };

    const handleFinish = () => {
        navigation.navigate('AttendanceStats');
    };

    const handleCreateSubject = () => {
        const name = newSubjectName.trim();
        if (!name) return;

        // Generate a random color from the global theme palette
        const randomColor = COLORS.subjectPalette[Math.floor(Math.random() * COLORS.subjectPalette.length)];

        const newSubject = {
            id: Date.now().toString(),
            name,
            color: randomColor,
        };

        dispatch({ type: 'ADD_SUBJECT', payload: newSubject });
        setNewSubjectName('');
        setShowAddModal(false);
        setSelectedBrush(newSubject.id);
    };

    if (timeSlots.length === 0) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorBox}>
                    <Text style={styles.errorText}>No time slots generated. Please go back and ensure your start/end times are configured properly.</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
            {Platform.OS === 'web' && <FloatingBackButton />}
            <View style={styles.headerBox}>
                <Text style={styles.header}>Paint Timetable</Text>
                <Text style={styles.subtitle}>Select a subject below, then tap the grid to fill it.</Text>
            </View>

            <View style={styles.gridContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={true} bounces={false}>
                    <ScrollView bounces={false} style={styles.gridScroll}>
                        {/* Header Row */}
                        <View style={styles.row}>
                            <View style={[styles.cell, styles.headerCell, styles.cornerCell]} />
                            {timeSlots.map(slot => (
                                <View key={slot.id} style={[styles.cell, styles.headerCell]}>
                                    <Text style={styles.timeText}>{slot.start.substring(0, 5)}</Text>
                                    <View style={styles.timeDivider} />
                                    <Text style={styles.timeText}>{slot.end.substring(0, 5)}</Text>
                                </View>
                            ))}
                        </View>

                        {/* Day Rows */}
                        {DAYS.map((day, dayIndex) => {
                            let skipNext = false;
                            const prevDay = dayIndex > 0 ? DAYS[dayIndex - 1] : null;

                            return (
                                <View key={day} style={styles.row}>
                                    <View style={[styles.cell, styles.dayCell]}>
                                        <Text style={styles.dayText}>{day.substring(0, 3)}</Text>
                                        {prevDay && (
                                            <TouchableOpacity
                                                style={styles.copyBtn}
                                                onPress={() => handleCopyDay(day, prevDay)}
                                                hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
                                            >
                                                <Text style={styles.copyBtnText}>Copy {prevDay.substring(0, 3)}</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    {timeSlots.map((slot, index) => {
                                        if (skipNext) {
                                            skipNext = false;
                                            return null;
                                        }

                                        const classInfo = timetable[day].find(c => c.slotId === slot.id);
                                        const subject = classInfo ? state.subjects.find(s => s.id === classInfo.subjectId) : null;

                                        // Auto-merge visually if consecutive slots have same subject
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
                                            return (
                                                <TouchableOpacity
                                                    key={slot.id}
                                                    activeOpacity={0.7}
                                                    style={[
                                                        styles.cell,
                                                        styles.filledCell,
                                                        { backgroundColor: subject.color + '20', borderLeftColor: subject.color },
                                                        isMerged && { width: 140 } // Double width
                                                    ]}
                                                    onPress={() => handleCellTap(day, index, slot)}
                                                >
                                                    <Text style={[styles.subjectText, { color: subject.color }]} numberOfLines={2}>
                                                        {subject.name}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        }

                                        return (
                                            <TouchableOpacity
                                                key={slot.id}
                                                activeOpacity={0.5}
                                                style={styles.cell}
                                                onPress={() => handleCellTap(day, index, slot)}
                                            />
                                        );
                                    })}
                                </View>
                            );
                        })}
                    </ScrollView>
                </ScrollView>
            </View>

            {/* Bottom Palette */}
            <View style={styles.paletteContainer}>
                <Text style={styles.paletteHeader}>Palette</Text>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.paletteScroll}
                >
                    <TouchableOpacity
                        style={[
                            styles.paletteBtn,
                            styles.eraserBtn,
                            selectedBrush === 'ERASER' && styles.paletteBtnActive
                        ]}
                        onPress={() => setSelectedBrush('ERASER')}
                    >
                        <Text style={[styles.paletteBtnText, selectedBrush === 'ERASER' && styles.paletteTextActive]}>🧹 Eraser</Text>
                    </TouchableOpacity>

                    {state.subjects.map(sub => {
                        const isSelected = selectedBrush === sub.id;
                        return (
                            <TouchableOpacity
                                key={sub.id}
                                style={[
                                    styles.paletteBtn,
                                    { backgroundColor: sub.color + '15', borderColor: sub.color },
                                    isSelected && { backgroundColor: sub.color }
                                ]}
                                onPress={() => setSelectedBrush(sub.id)}
                            >
                                <Text style={[
                                    styles.paletteBtnText,
                                    { color: sub.color },
                                    isSelected && { color: '#FFF' }
                                ]}>
                                    {sub.name}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}

                    <TouchableOpacity
                        style={[styles.paletteBtn, styles.addBtn]}
                        onPress={() => setShowAddModal(true)}
                    >
                        <Text style={styles.addBtnText}>+ Add Subject</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>

            <View style={styles.footer}>
                <Button title="Continue" onPress={handleFinish} />
            </View>

            {/* Add Subject Modal */}
            <Modal
                visible={showAddModal}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setShowAddModal(false)}
            >
                <KeyboardAvoidingView
                    style={styles.modalOverlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>New Subject</Text>

                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Mathematics"
                            placeholderTextColor={COLORS.textMuted}
                            value={newSubjectName}
                            onChangeText={setNewSubjectName}
                            autoFocus
                            onSubmitEditing={handleCreateSubject}
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.modalCancel]}
                                onPress={() => setShowAddModal(false)}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.modalSave]}
                                onPress={handleCreateSubject}
                            >
                                <Text style={styles.modalSaveText}>Create</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}

const getStyles = () => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    errorBox: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xl,
    },
    errorText: {
        color: COLORS.danger,
        textAlign: 'center',
        ...TYPOGRAPHY.body,
    },
    headerBox: {
        padding: SPACING.lg,
        paddingBottom: SPACING.sm,
    },
    header: {
        ...TYPOGRAPHY.headerMedium,
        color: COLORS.textPrimary,
        marginBottom: SPACING.xs,
    },
    subtitle: {
        ...TYPOGRAPHY.body,
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
    },
    gridContainer: {
        flex: 1,
        backgroundColor: COLORS.cardBackground,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: COLORS.border,
        marginTop: SPACING.sm,
    },
    gridScroll: {
        paddingBottom: SPACING.xl, // some breathing room at the bottom of the grid 
    },
    row: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    cell: {
        width: 70,
        height: 64,
        borderRightWidth: 1,
        borderRightColor: COLORS.border,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.cardBackground,
    },
    cornerCell: {
        width: 55,
        backgroundColor: COLORS.inputBackground,
    },
    headerCell: {
        backgroundColor: COLORS.inputBackground,
        height: 48,
        paddingVertical: 2,
    },
    dayCell: {
        width: 55,
        backgroundColor: COLORS.background,
        paddingVertical: SPACING.xs,
        justifyContent: 'center',
    },
    timeText: {
        fontSize: 10,
        color: COLORS.textSecondary,
        fontWeight: '600',
    },
    timeDivider: {
        height: 1,
        width: 12,
        backgroundColor: COLORS.border,
        marginVertical: 2,
    },
    dayText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
    },
    copyBtn: {
        marginTop: SPACING.xs,
        backgroundColor: COLORS.primaryLight,
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 4,
    },
    copyBtnText: {
        fontSize: 8,
        fontWeight: '600',
        color: COLORS.primary,
        textAlign: 'center',
    },
    filledCell: {
        borderLeftWidth: 4,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    subjectText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '700',
        textAlign: 'center',
    },
    paletteContainer: {
        backgroundColor: COLORS.cardBackground,
        paddingVertical: SPACING.md,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        ...SHADOWS.small,
    },
    paletteHeader: {
        paddingHorizontal: SPACING.lg,
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginBottom: SPACING.sm,
    },
    paletteScroll: {
        paddingHorizontal: SPACING.lg,
        gap: SPACING.sm,
        alignItems: 'center',
    },
    paletteBtn: {
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    eraserBtn: {
        backgroundColor: COLORS.inputBackground,
        borderColor: COLORS.border,
    },
    paletteBtnActive: {
        backgroundColor: COLORS.textSecondary,
        borderColor: COLORS.textSecondary,
    },
    paletteBtnText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '700',
    },
    paletteTextActive: {
        color: COLORS.background,
    },
    addBtn: {
        backgroundColor: COLORS.cardBackground,
        borderColor: COLORS.primaryLight,
        borderStyle: 'dashed',
    },
    addBtnText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.primary,
    },
    footer: {
        padding: SPACING.lg,
        backgroundColor: COLORS.background,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: COLORS.overlay,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xl,
    },
    modalContent: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.xl,
        width: '100%',
        ...SHADOWS.medium,
    },
    modalTitle: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: SPACING.lg,
        textAlign: 'center',
    },
    input: {
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        fontSize: FONT_SIZES.md,
        color: COLORS.textPrimary,
        marginBottom: SPACING.lg,
        ...Platform.select({ web: { outlineStyle: 'none' } }),
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: SPACING.md,
    },
    modalBtn: {
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.lg,
        borderRadius: BORDER_RADIUS.md,
    },
    modalCancel: {
        backgroundColor: 'transparent',
    },
    modalSave: {
        backgroundColor: COLORS.primary,
    },
    modalCancelText: {
        color: COLORS.textSecondary,
        fontWeight: '600',
        fontSize: FONT_SIZES.md,
    },
    modalSaveText: {
        color: COLORS.textOnPrimary,
        fontWeight: '700',
        fontSize: FONT_SIZES.md,
    }
});
