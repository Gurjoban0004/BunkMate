import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Platform,
    Modal,
    KeyboardAvoidingView,
    Switch
} from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import { clearAppState, saveAppState } from '../../storage/storage';
import { showAlert } from '../../utils/alert';
import { encodeBase64, decodeBase64 } from '../../utils/base64';

const THRESHOLD_OPTIONS = [70, 75, 80, 85, 90];

const SettingsScreen = ({ navigation }) => {
    const { state, dispatch } = useApp();
    const [editingName, setEditingName] = useState(false);
    const [tempName, setTempName] = useState(state.userName || '');

    // Import Modal State
    const [importModalVisible, setImportModalVisible] = useState(false);
    const [importDataString, setImportDataString] = useState('');

    // Settings values
    const {
        dangerThreshold = 75,
        notificationEnabled = true,
        smartAlertsEnabled = true,
        weeklySummaryEnabled = true,
    } = state.settings || {};

    const updateSetting = (key, value) => {
        dispatch({ type: 'UPDATE_SETTINGS', payload: { [key]: value } });
    };

    const handleSaveName = () => {
        if (tempName.trim()) {
            dispatch({ type: 'SET_USER_NAME', payload: tempName.trim() });
        }
        setEditingName(false);
    };

    const handleExportData = () => {
        try {
            const jsonStr = JSON.stringify(state);
            const base64 = encodeBase64(jsonStr);

            if (Platform.OS === 'web' && navigator.clipboard) {
                navigator.clipboard.writeText(base64)
                    .then(() => showAlert('Export Successful', 'Your backup code has been copied to your clipboard. Keep it safe!'))
                    .catch(() => copyFallback(base64));
            } else {
                copyFallback(base64);
            }
        } catch (e) {
            showAlert('Export Failed', 'There was an error encoding your data.');
        }
    };

    const copyFallback = (base64) => {
        showAlert('Backup Code', 'Copy the following code:\n\n' + base64 + '\n\nSelect all text and copy.');
    };

    const handleImportData = () => {
        if (!importDataString.trim()) {
            showAlert('Error', 'Please enter a valid backup code.');
            return;
        }

        try {
            const decodedStr = decodeBase64(importDataString.trim());
            if (!decodedStr) throw new Error('Invalid Base64');
            const stateObj = JSON.parse(decodedStr);

            if (stateObj && stateObj.subjects && stateObj.timeSlots) {
                dispatch({ type: 'LOAD_STATE', payload: stateObj });
                saveAppState(stateObj);
                setImportModalVisible(false);
                setImportDataString('');
                showAlert('Success', 'Your data was successfully restored!');
            } else {
                throw new Error('Invalid Data Structure');
            }
        } catch (e) {
            showAlert('Import Failed', 'The code you entered is invalid or corrupted.');
        }
    };

    const handleResetSemester = () => {
        showAlert(
            'Reset Semester',
            'This will delete ALL your attendance data. This cannot be undone.\n\nAre you sure?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reset Everything',
                    style: 'destructive',
                    onPress: async () => {
                        await clearAppState();
                        dispatch({ type: 'RESET_STATE' });
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Settings</Text>
                </View>

                {/* Profile Section */}
                <View style={styles.section}>
                    <View style={styles.card}>
                        <View style={styles.settingRow}>
                            <Text style={styles.settingLabel}>Name</Text>
                            {editingName ? (
                                <View style={styles.nameEditContainer}>
                                    <TextInput
                                        style={styles.nameInput}
                                        value={tempName}
                                        onChangeText={setTempName}
                                        autoFocus
                                        onBlur={handleSaveName}
                                        onSubmitEditing={handleSaveName}
                                    />
                                    <TouchableOpacity onPress={handleSaveName}>
                                        <Text style={styles.saveButton}>Save</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <TouchableOpacity style={styles.nameDisplay} onPress={() => { setTempName(state.userName || ''); setEditingName(true); }}>
                                    <Text style={styles.nameText}>{state.userName || 'Not set'}</Text>
                                    <Text style={styles.editIcon}>✏️</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>

                {/* Core Preferences */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>PREFERENCES</Text>
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Danger Threshold</Text>
                        <Text style={styles.cardDescription}>Subjects below this % are flagged as risky.</Text>

                        <View style={styles.optionsRow}>
                            {THRESHOLD_OPTIONS.map((option) => (
                                <TouchableOpacity
                                    key={option}
                                    style={[styles.optionButton, dangerThreshold === option && styles.optionButtonActive]}
                                    onPress={() => updateSetting('dangerThreshold', option)}
                                >
                                    <Text style={[styles.optionText, dangerThreshold === option && styles.optionTextActive]}>
                                        {option}%
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </View>

                {/* Notifications Section (Android Only) */}
                {Platform.OS === 'android' && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>

                        <View style={styles.card}>
                            <View style={styles.settingRow}>
                                <View style={styles.settingInfo}>
                                    <Text style={styles.settingLabel}>Daily Reminder</Text>
                                    <Text style={styles.settingDescription}>
                                        Get reminded to mark attendance
                                    </Text>
                                </View>
                                <Switch
                                    value={notificationEnabled}
                                    onValueChange={(value) => updateSetting('notificationEnabled', value)}
                                    trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
                                    thumbColor={notificationEnabled ? COLORS.primary : COLORS.textMuted}
                                />
                            </View>

                            {notificationEnabled && (
                                <TouchableOpacity style={styles.timePickerRow}>
                                    <Text style={styles.timePickerLabel}>Remind me at</Text>
                                    <View style={styles.timeBadge}>
                                        <Text style={styles.timeText}>6:00 PM</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                        </View>

                        <View style={styles.card}>
                            <View style={styles.settingRow}>
                                <View style={styles.settingInfo}>
                                    <Text style={styles.settingLabel}>Smart Alerts</Text>
                                    <Text style={styles.settingDescription}>
                                        Warn when subjects drop below threshold
                                    </Text>
                                </View>
                                <Switch
                                    value={smartAlertsEnabled}
                                    onValueChange={(value) => updateSetting('smartAlertsEnabled', value)}
                                    trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
                                    thumbColor={smartAlertsEnabled ? COLORS.primary : COLORS.textMuted}
                                />
                            </View>
                        </View>

                        <View style={styles.card}>
                            <View style={styles.settingRow}>
                                <View style={styles.settingInfo}>
                                    <Text style={styles.settingLabel}>Weekly Summary</Text>
                                    <Text style={styles.settingDescription}>
                                        Get insights every Sunday
                                    </Text>
                                </View>
                                <Switch
                                    value={weeklySummaryEnabled}
                                    onValueChange={(value) => updateSetting('weeklySummaryEnabled', value)}
                                    trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
                                    thumbColor={weeklySummaryEnabled ? COLORS.primary : COLORS.textMuted}
                                />
                            </View>
                        </View>
                    </View>
                )}

                {/* Timetable Management */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>MANAGE CLASSES</Text>

                    <View style={styles.cardGroup}>
                        <TouchableOpacity style={styles.groupItem} onPress={() => navigation.navigate('EditTimetable')}>
                            <Text style={styles.linkText}>Edit Timetable</Text>
                            <Text style={styles.chevron}>›</Text>
                        </TouchableOpacity>
                        <View style={styles.divider} />
                        <TouchableOpacity style={styles.groupItem} onPress={() => navigation.navigate('EditSubjects')}>
                            <Text style={styles.linkText}>Edit Subjects</Text>
                            <Text style={styles.chevron}>›</Text>
                        </TouchableOpacity>
                        <View style={styles.divider} />
                        <TouchableOpacity style={styles.groupItem} onPress={() => navigation.navigate('AttendanceStats', { fromSettings: true })}>
                            <Text style={styles.linkText}>Update Past Attendance</Text>
                            <Text style={styles.chevron}>›</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Data Backup */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>BACKUP & RESTORE</Text>
                    <View style={styles.cardGroup}>
                        <TouchableOpacity style={styles.groupItem} onPress={handleExportData}>
                            <Text style={styles.linkText}>Export Backup Code</Text>
                            <Text style={styles.chevron}>›</Text>
                        </TouchableOpacity>
                        <View style={styles.divider} />
                        <TouchableOpacity style={styles.groupItem} onPress={() => setImportModalVisible(true)}>
                            <Text style={styles.linkText}>Restore from Code</Text>
                            <Text style={styles.chevron}>›</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Danger Zone */}
                <View style={styles.section}>
                    <TouchableOpacity style={[styles.card, styles.dangerCard]} onPress={handleResetSemester}>
                        <Text style={styles.dangerText}>Reset Entire Semester</Text>
                    </TouchableOpacity>
                </View>

                {/* About Section */}
                <View style={styles.aboutContainer}>
                    <Text style={styles.appName}>BunkMate</Text>
                    <Text style={styles.version}>v1.0.1</Text>
                </View>

                <View style={styles.bottomPadding} />
            </ScrollView>

            {/* Import Backup Modal stays exactly the same */}
            <Modal visible={importModalVisible} animationType="slide" transparent={true} onRequestClose={() => setImportModalVisible(false)}>
                <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Restore Backup</Text>
                            <TouchableOpacity onPress={() => setImportModalVisible(false)}>
                                <Text style={styles.modalCloseText}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalSubtitle}>Paste your exported backup code below. This will overwrite all your current data!</Text>

                        <TextInput
                            style={styles.backupInput}
                            value={importDataString}
                            onChangeText={setImportDataString}
                            placeholder="Paste code here..."
                            multiline
                            numberOfLines={4}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.modalButton, styles.modalButtonCancel]} onPress={() => { setImportModalVisible(false); setImportDataString(''); }}>
                                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalButton, styles.modalButtonConfirm]} onPress={handleImportData}>
                                <Text style={styles.modalButtonTextConfirm}>Restore Data</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    scrollView: { flex: 1 },
    scrollContent: { paddingTop: SPACING.lg },
    header: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg },
    headerTitle: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.textPrimary },
    section: { marginBottom: SPACING.xl },
    sectionTitle: { fontSize: FONT_SIZES.xs, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 0.5, paddingHorizontal: SPACING.lg, marginBottom: SPACING.sm },
    card: { backgroundColor: COLORS.cardBackground, marginHorizontal: SPACING.lg, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, ...SHADOWS.small },
    cardGroup: { backgroundColor: COLORS.cardBackground, marginHorizontal: SPACING.lg, borderRadius: BORDER_RADIUS.lg, overflow: 'hidden', ...SHADOWS.small },
    groupItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md },
    divider: { height: 1, backgroundColor: COLORS.border, marginLeft: SPACING.md },
    cardTitle: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 4 },
    cardDescription: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginBottom: SPACING.md },
    settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    settingLabel: { fontSize: FONT_SIZES.md, fontWeight: '500', color: COLORS.textPrimary },
    settingInfo: { flex: 1, marginRight: SPACING.md },
    settingDescription: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
    nameEditContainer: { flexDirection: 'row', alignItems: 'center' },
    nameInput: { backgroundColor: COLORS.inputBackground, paddingHorizontal: SPACING.sm, paddingVertical: 6, borderRadius: BORDER_RADIUS.sm, fontSize: FONT_SIZES.md, color: COLORS.textPrimary, minWidth: 120, marginRight: SPACING.sm },
    saveButton: { color: COLORS.primary, fontWeight: '600', fontSize: FONT_SIZES.sm },
    nameDisplay: { flexDirection: 'row', alignItems: 'center' },
    nameText: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, marginRight: SPACING.sm },
    editIcon: { fontSize: 14 },
    optionsRow: { flexDirection: 'row', backgroundColor: COLORS.inputBackground, borderRadius: BORDER_RADIUS.md, padding: 4 },
    optionButton: { flex: 1, paddingVertical: SPACING.sm, alignItems: 'center', borderRadius: BORDER_RADIUS.sm },
    optionButtonActive: { backgroundColor: COLORS.primary },
    optionText: { fontSize: FONT_SIZES.sm, fontWeight: '500', color: COLORS.textSecondary },
    optionTextActive: { color: COLORS.textOnPrimary, fontWeight: '600' },
    timePickerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border },
    timePickerLabel: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
    timeBadge: { backgroundColor: COLORS.primaryLight, paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: BORDER_RADIUS.sm },
    timeText: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.primary },
    linkText: { fontSize: FONT_SIZES.md, fontWeight: '500', color: COLORS.textPrimary },
    chevron: { fontSize: 20, color: COLORS.textMuted },
    dangerCard: { backgroundColor: COLORS.dangerLight, alignItems: 'center', paddingVertical: SPACING.md },
    dangerText: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.danger },
    aboutContainer: { alignItems: 'center', marginTop: SPACING.lg },
    appName: { fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.textMuted },
    version: { fontSize: FONT_SIZES.xs, color: COLORS.textMuted, marginTop: 4 },
    bottomPadding: { height: 100 },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: COLORS.cardBackground, borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.xl, paddingBottom: Platform.OS === 'ios' ? 40 : SPACING.xl },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
    modalTitle: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.textPrimary },
    modalCloseText: { fontSize: 24, color: COLORS.textMuted },
    modalSubtitle: { fontSize: FONT_SIZES.sm, color: COLORS.danger, marginBottom: SPACING.lg },
    backupInput: { backgroundColor: COLORS.inputBackground, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, fontSize: FONT_SIZES.sm, color: COLORS.textPrimary, minHeight: 100, textAlignVertical: 'top', marginBottom: SPACING.lg, ...Platform.select({ web: { outlineStyle: 'none' } }) },
    modalActions: { flexDirection: 'row', gap: SPACING.md },
    modalButton: { flex: 1, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md, alignItems: 'center' },
    modalButtonCancel: { backgroundColor: COLORS.inputBackground },
    modalButtonConfirm: { backgroundColor: COLORS.primary },
    modalButtonTextCancel: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.textSecondary },
    modalButtonTextConfirm: { fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.background },
});

export default SettingsScreen;
