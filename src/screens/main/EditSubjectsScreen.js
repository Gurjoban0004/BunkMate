import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, TYPOGRAPHY, TABULAR } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import { getSubjectAttendance, roundPct } from '../../utils/attendance';
import Button from '../../components/common/Button';
import { showAlert } from '../../utils/alert';
import ScreenHeader from '../../components/common/ScreenHeader';

/**
 * Subjects come from the college and so do their numbers. What a student can
 * change here is how a subject looks and what goal it has — never the count.
 */
const EditSubjectsScreen = () => {
    const styles = getStyles();
    const { state, dispatch } = useApp();
    const [editing, setEditing] = useState(null);
    const [name, setName] = useState('');
    const [color, setColor] = useState(COLORS.subjectPalette[0]);
    const [target, setTarget] = useState('');

    const globalGoal = state.settings?.dangerThreshold || 75;
    const isFromCollege = (s) => !!(s.erpSubjectId || s.code || s.source === 'erp');

    const openEditor = (subject) => {
        setEditing(subject);
        setName(subject.name);
        setColor(subject.color || COLORS.subjectPalette[0]);
        setTarget(subject.target ? String(subject.target) : '');
    };

    const handleSave = () => {
        if (!name.trim()) { showAlert('Name needed', 'Give the subject a name.'); return; }
        const goal = target.trim() === '' ? null : Math.min(100, Math.max(1, parseInt(target, 10) || globalGoal));
        dispatch({ type: 'UPDATE_SUBJECT', payload: { id: editing.id, name: name.trim(), color, target: goal } });
        setEditing(null);
    };

    const handleDelete = (subject) => {
        showAlert(
            'Remove this subject?',
            'It disappears from your timetable and calendar. It was not sent by your college, so it will not come back on sync.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => dispatch({ type: 'DELETE_SUBJECT', payload: subject.id }) },
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScreenHeader title="Subjects" />
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Text style={styles.intro}>
                    Your subjects and their numbers come from your college. Rename them, pick a colour, or set a goal for one that needs a different target.
                </Text>

                {state.subjects.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyTitle}>No subjects yet</Text>
                        <Text style={styles.emptyText}>They appear after your first sync.</Text>
                    </View>
                ) : (
                    state.subjects.map((subject) => {
                        const stats = getSubjectAttendance(subject.id, state);
                        return (
                            <TouchableOpacity key={subject.id} style={styles.card} onPress={() => openEditor(subject)} activeOpacity={0.8}>
                                <View style={[styles.colorDot, { backgroundColor: subject.color }]} />
                                <View style={styles.info}>
                                    <Text style={styles.name} numberOfLines={1}>{subject.name}</Text>
                                    <Text style={styles.meta}>
                                        <Text style={TABULAR}>{roundPct(stats?.percentage || 0).toFixed(1)}%</Text>
                                        {'  ·  '}{stats?.attendedUnits ?? 0} of {stats?.totalUnits ?? 0} hours
                                        {'  ·  goal '}{subject.target || globalGoal}%
                                    </Text>
                                </View>
                                <Text style={styles.chevron}>›</Text>
                            </TouchableOpacity>
                        );
                    })
                )}
                <View style={{ height: 100 }} />
            </ScrollView>

            <Modal visible={!!editing} animationType="slide" transparent onRequestClose={() => setEditing(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Edit subject</Text>
                            <TouchableOpacity onPress={() => setEditing(null)} accessibilityRole="button" accessibilityLabel="Close">
                                <Text style={styles.closeModalText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.inputLabel}>NAME</Text>
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            placeholder="Subject name"
                            placeholderTextColor={COLORS.textMuted}
                            accessibilityLabel="Subject name"
                        />

                        <Text style={styles.inputLabel}>COLOUR</Text>
                        <View style={styles.palette}>
                            {COLORS.subjectPalette.map((c) => (
                                <TouchableOpacity
                                    key={c}
                                    style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchSelected]}
                                    onPress={() => setColor(c)}
                                    accessibilityRole="radio"
                                    accessibilityState={{ selected: color === c }}
                                    accessibilityLabel={`Colour ${c}`}
                                />
                            ))}
                        </View>

                        <Text style={styles.inputLabel}>GOAL</Text>
                        <TextInput
                            style={styles.input}
                            value={target}
                            onChangeText={(t) => setTarget(t.replace(/[^0-9]/g, '').slice(0, 3))}
                            placeholder={`Leave empty to use ${globalGoal}%`}
                            placeholderTextColor={COLORS.textMuted}
                            keyboardType="number-pad"
                            accessibilityLabel="Attendance goal percent"
                        />

                        {editing && isFromCollege(editing) ? (
                            <Text style={styles.hint}>Attendance numbers for this subject come from your college and cannot be edited.</Text>
                        ) : editing ? (
                            <TouchableOpacity style={styles.removeLink} onPress={() => { const s = editing; setEditing(null); handleDelete(s); }}>
                                <Text style={styles.removeLinkText}>Remove this subject</Text>
                            </TouchableOpacity>
                        ) : null}

                        <View style={styles.modalActions}>
                            <Button title="Cancel" variant="outline" onPress={() => setEditing(null)} style={styles.modalButton} />
                            <Button title="Save" onPress={handleSave} style={styles.modalButton} />
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const getStyles = () => StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    scrollContent: { paddingTop: SPACING.md, paddingBottom: SPACING.xxl },
    intro: { ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary, paddingHorizontal: SPACING.lg, marginBottom: SPACING.md },
    card: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
        backgroundColor: COLORS.cardBackground, marginHorizontal: SPACING.lg, marginBottom: SPACING.sm,
        padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
    },
    colorDot: { width: 12, height: 12, borderRadius: 6 },
    info: { flex: 1 },
    name: { ...TYPOGRAPHY.headingSmall, color: COLORS.textPrimary },
    meta: { ...TYPOGRAPHY.captionMedium, color: COLORS.textMuted, marginTop: 2 },
    chevron: { fontSize: 20, color: COLORS.textMuted },
    emptyState: { alignItems: 'center', padding: SPACING.xxl },
    emptyTitle: { ...TYPOGRAPHY.headingSmall, color: COLORS.textPrimary },
    emptyText: { ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary, marginTop: 4 },
    modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: COLORS.cardBackground, borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl,
        padding: SPACING.xl, paddingBottom: 40,
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
    modalTitle: { ...TYPOGRAPHY.headingLarge, fontSize: FONT_SIZES.lg, color: COLORS.textPrimary },
    closeModalText: { fontSize: 22, color: COLORS.textMuted, padding: SPACING.xs },
    inputLabel: { ...TYPOGRAPHY.micro, color: COLORS.textMuted, marginBottom: 6, marginTop: SPACING.md },
    input: {
        backgroundColor: COLORS.inputBackground, borderRadius: BORDER_RADIUS.sm, paddingHorizontal: SPACING.md, paddingVertical: 12,
        ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary,
    },
    palette: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: 'transparent' },
    swatchSelected: { borderColor: COLORS.textPrimary },
    hint: { ...TYPOGRAPHY.captionMedium, color: COLORS.textMuted, marginTop: SPACING.md },
    removeLink: { marginTop: SPACING.md, minHeight: 36, justifyContent: 'center' },
    removeLinkText: { ...TYPOGRAPHY.labelMedium, color: COLORS.dangerText },
    modalActions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.lg },
    modalButton: { flex: 1 },
});

export default EditSubjectsScreen;
