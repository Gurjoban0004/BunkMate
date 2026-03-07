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
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import { clearAppState, saveAppState } from '../../storage/storage';
import { showAlert } from '../../utils/alert';
import { encodeBase64, decodeBase64 } from '../../utils/base64';

const THRESHOLD_OPTIONS = [70, 75, 80, 85, 90];

const SettingsScreen = ({ navigation }) => {
    const styles = getStyles();
    const { state, dispatch } = useApp();
    const [editingName, setEditingName] = useState(false);
    const [tempName, setTempName] = useState(state.userName || '');
    const [showTimePicker, setShowTimePicker] = useState(false);

    // Web Time Picker State
    const [webTimePickerVisible, setWebTimePickerVisible] = useState(false);
    const [webHour, setWebHour] = useState('08');
    const [webMinute, setWebMinute] = useState('00');
    const [webAmPm, setWebAmPm] = useState('PM');

    // Import Modal State
    const [importModalVisible, setImportModalVisible] = useState(false);
    const [importDataString, setImportDataString] = useState('');
    const [resetModalVisible, setResetModalVisible] = useState(false);

    // Settings values
    const {
        dangerThreshold = 75,
        notificationEnabled = true,
        smartAlertsEnabled = true,
        weeklySummaryEnabled = true,
        theme = 'light',
        landingPage = 'today',
        autopilotEnabled = false,
        autopilotTime = '20:00',
        autopilotDefault = 'present',
    } = state.settings || {};

    const customTargets = state.subjects ? state.subjects.filter(s => s.target && s.target !== dangerThreshold) : [];

    const updateSetting = (key, value) => {
        dispatch({ type: 'UPDATE_SETTINGS', payload: { [key]: value } });
    };

    const handleToggleAutopilot = () => {
        dispatch({
            type: 'UPDATE_AUTOPILOT_SETTINGS',
            payload: { autopilotEnabled: !autopilotEnabled },
        });
    };

    const handleTimeChange = (event, selectedDate) => {
        if (Platform.OS === 'android') {
            setShowTimePicker(false);
        }
        if (selectedDate) {
            const hours = String(selectedDate.getHours()).padStart(2, '0');
            const minutes = String(selectedDate.getMinutes()).padStart(2, '0');
            dispatch({
                type: 'UPDATE_AUTOPILOT_SETTINGS',
                payload: { autopilotTime: `${hours}:${minutes}` },
            });
        }
    };

    const handleDefaultChange = (value) => {
        dispatch({
            type: 'UPDATE_AUTOPILOT_SETTINGS',
            payload: { autopilotDefault: value },
        });
    };

    const formatTime = (timeStr) => {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':');
        let hours = parseInt(h, 10);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        return `${hours}:${m} ${ampm}`;
    };

    const parseTimeToDate = (timeStr) => {
        const [h, m] = (timeStr || '20:00').split(':');
        const d = new Date();
        d.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
        return d;
    };

    const openWebTimePicker = () => {
        let [h, m] = (autopilotTime || '20:00').split(':');
        let hour = parseInt(h, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12 || 12;

        setWebHour(String(hour).padStart(2, '0'));
        setWebMinute(m);
        setWebAmPm(ampm);
        setWebTimePickerVisible(true);
    };

    const handleSaveWebTime = () => {
        let h = parseInt(webHour, 10);
        if (isNaN(h) || h < 1 || h > 12) h = 12;

        let m = parseInt(webMinute, 10);
        if (isNaN(m) || m < 0 || m > 59) m = 0;

        if (h === 12 && webAmPm === 'AM') h = 0;
        else if (h < 12 && webAmPm === 'PM') h += 12;

        const hStr = String(h).padStart(2, '0');
        const mStr = String(m).padStart(2, '0');

        dispatch({
            type: 'UPDATE_AUTOPILOT_SETTINGS',
            payload: { autopilotTime: `${hStr}:${mStr}` },
        });
        setWebTimePickerVisible(false);
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

    const handleResetSemester = async () => {
        await clearAppState();
        dispatch({ type: 'RESET_STATE' });
        setResetModalVisible(false);
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

                        {/* Custom Targets Sub-list */}
                        {customTargets.length > 0 && (
                            <View style={styles.customTargetsContainer}>
                                <Text style={styles.customTargetsHeader}>Custom Subject Targets</Text>
                                {customTargets.map(sub => (
                                    <View key={sub.id} style={styles.customTargetRow}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: sub.color || COLORS.primary }} />
                                            <Text style={styles.customTargetName}>{sub.name}</Text>
                                        </View>
                                        <Text style={styles.customTargetValue}>{sub.target}%</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Divider */}
                        <View style={[styles.divider, { marginLeft: 0, marginVertical: SPACING.md }]} />

                        {/* Landing Page */}
                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.cardTitle}>Startup Screen</Text>
                                <Text style={styles.cardDescription}>Default app open tab</Text>
                            </View>
                            <View style={styles.optionsGroupSmall}>
                                <TouchableOpacity
                                    style={[styles.smallOptionBtn, landingPage === 'today' && styles.optionButtonActive]}
                                    onPress={() => updateSetting('landingPage', 'today')}
                                >
                                    <Text style={[styles.optionText, landingPage === 'today' && styles.optionTextActive]}>Today</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.smallOptionBtn, landingPage === 'planner' && styles.optionButtonActive]}
                                    onPress={() => updateSetting('landingPage', 'planner')}
                                >
                                    <Text style={[styles.optionText, landingPage === 'planner' && styles.optionTextActive]}>Planner</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Autopilot Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>AUTOMATION</Text>

                    <View style={styles.card}>
                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Autopilot Mode</Text>
                                <Text style={styles.settingDescription}>
                                    Automatically mark untouched attendance cards
                                </Text>
                            </View>
                            <Switch
                                value={autopilotEnabled}
                                onValueChange={handleToggleAutopilot}
                                trackColor={{ false: COLORS.border, true: COLORS.success }}
                                thumbColor={COLORS.cardBackground}
                            />
                        </View>

                        {autopilotEnabled && (
                            <>
                                <View style={[styles.divider, { marginVertical: SPACING.md, marginLeft: 0 }]} />

                                <View style={styles.settingRow}>
                                    <View style={styles.settingInfo}>
                                        <Text style={styles.settingLabel}>Trigger Time</Text>
                                        <Text style={styles.settingDescription}>
                                            When should missing cards be auto-marked?
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.timeValueBox}
                                        onPress={() => {
                                            if (Platform.OS === 'web') {
                                                openWebTimePicker();
                                            } else {
                                                setShowTimePicker(true);
                                            }
                                        }}
                                    >
                                        <Text style={styles.timeValueText}>
                                            {formatTime(autopilotTime)}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {showTimePicker && (
                                    <View style={Platform.OS === 'ios' && styles.iosPickerContainer}>
                                        <DateTimePicker
                                            value={parseTimeToDate(autopilotTime)}
                                            mode="time"
                                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                            onChange={handleTimeChange}
                                        />
                                        {Platform.OS === 'ios' && (
                                            <TouchableOpacity
                                                style={styles.pickerDoneBtn}
                                                onPress={() => setShowTimePicker(false)}
                                            >
                                                <Text style={styles.pickerDoneText}>Done</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                )}

                                <View style={[styles.divider, { marginVertical: SPACING.md, marginLeft: 0 }]} />

                                <View style={styles.settingRow}>
                                    <View style={styles.settingInfo}>
                                        <Text style={styles.settingLabel}>Default Status</Text>
                                        <Text style={styles.settingDescription}>
                                            What should untouched cards be marked as?
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.radioGroup}>
                                    <TouchableOpacity
                                        style={[
                                            styles.radioOption,
                                            autopilotDefault === 'present' && styles.radioOptionSelectedPresent
                                        ]}
                                        onPress={() => handleDefaultChange('present')}
                                    >
                                        <Text style={[
                                            styles.radioText,
                                            autopilotDefault === 'present' && styles.radioTextSelectedPresent
                                        ]}>
                                            Present
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.radioOption,
                                            autopilotDefault === 'absent' && styles.radioOptionSelectedAbsent
                                        ]}
                                        onPress={() => handleDefaultChange('absent')}
                                    >
                                        <Text style={[
                                            styles.radioText,
                                            autopilotDefault === 'absent' && styles.radioTextSelectedAbsent
                                        ]}>
                                            Absent
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </View>
                </View>

                {/* Appearance Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>APPEARANCE</Text>
                    <View style={styles.card}>
                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.cardTitle}>Theme</Text>
                                <Text style={styles.cardDescription}>Experimental pastel dark mode</Text>
                            </View>
                            <View style={styles.optionsGroupSmall}>
                                <TouchableOpacity
                                    style={[styles.smallOptionBtn, theme === 'light' && styles.optionButtonActive]}
                                    onPress={() => updateSetting('theme', 'light')}
                                >
                                    <Text style={[styles.optionText, theme === 'light' && styles.optionTextActive]}>Light</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.smallOptionBtn, theme === 'dark' && styles.optionButtonActive]}
                                    onPress={() => updateSetting('theme', 'dark')}
                                >
                                    <Text style={[styles.optionText, theme === 'dark' && styles.optionTextActive]}>Dark</Text>
                                </TouchableOpacity>
                            </View>
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
                        <View style={styles.divider} />
                        <TouchableOpacity style={styles.groupItem} onPress={() => navigation.navigate('SyncFromPortal')}>
                            <Text style={styles.linkText}>Sync from Portal</Text>
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
                    <TouchableOpacity style={[styles.card, styles.dangerCard]} onPress={() => setResetModalVisible(true)}>
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

            {/* Reset Semester Modal */}
            <Modal visible={resetModalVisible} animationType="slide" transparent={true} onRequestClose={() => setResetModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.resetModalContent}>
                        <View style={styles.resetDragHandle} />
                        <Text style={styles.resetEmoji}>⚠️</Text>
                        <Text style={styles.resetTitle}>Reset Semester</Text>
                        <Text style={styles.resetDescription}>
                            This will permanently delete all your attendance data, subjects, timetable, and settings.
                        </Text>
                        <Text style={styles.resetWarning}>
                            This action cannot be undone.
                        </Text>
                        <View style={styles.resetActions}>
                            <TouchableOpacity
                                style={[styles.resetButton, styles.resetButtonCancel]}
                                onPress={() => setResetModalVisible(false)}
                            >
                                <Text style={styles.resetButtonCancelText}>Keep My Data</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.resetButton, styles.resetButtonConfirm]}
                                onPress={handleResetSemester}
                            >
                                <Text style={styles.resetButtonConfirmText}>Reset Everything</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Custom Web Time Picker */}
            <Modal visible={webTimePickerVisible} animationType="fade" transparent={true} onRequestClose={() => setWebTimePickerVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.timePickerModalContent}>
                        <Text style={styles.modalTitle}>Set Autopilot Time</Text>

                        <View style={styles.timeInputContainer}>
                            <TextInput
                                style={styles.customTimeInput}
                                keyboardType="number-pad"
                                maxLength={2}
                                value={webHour}
                                onChangeText={(val) => setWebHour(val.replace(/[^0-9]/g, ''))}
                                placeholder="12"
                                placeholderTextColor={COLORS.textMuted}
                            />
                            <Text style={styles.timeColon}>:</Text>
                            <TextInput
                                style={styles.customTimeInput}
                                keyboardType="number-pad"
                                maxLength={2}
                                value={webMinute}
                                onChangeText={(val) => setWebMinute(val.replace(/[^0-9]/g, ''))}
                                placeholder="00"
                                placeholderTextColor={COLORS.textMuted}
                            />

                            <View style={styles.amPmToggle}>
                                <TouchableOpacity
                                    style={[styles.amPmBtn, webAmPm === 'AM' && styles.amPmBtnActive]}
                                    onPress={() => setWebAmPm('AM')}
                                >
                                    <Text style={[styles.amPmText, webAmPm === 'AM' && styles.amPmTextActive]}>AM</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.amPmBtn, webAmPm === 'PM' && styles.amPmBtnActive]}
                                    onPress={() => setWebAmPm('PM')}
                                >
                                    <Text style={[styles.amPmText, webAmPm === 'PM' && styles.amPmTextActive]}>PM</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.modalButton, styles.modalButtonCancel]} onPress={() => setWebTimePickerVisible(false)}>
                                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalButton, styles.modalButtonConfirm]} onPress={handleSaveWebTime}>
                                <Text style={styles.modalButtonTextConfirm}>Set Time</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

        </SafeAreaView>
    );
};

const getStyles = () => StyleSheet.create({
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
    timePickerModalContent: { backgroundColor: COLORS.cardBackground, padding: SPACING.xl, borderRadius: BORDER_RADIUS.lg, width: '90%', maxWidth: 400, ...SHADOWS.large },
    timeInputContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: SPACING.xl },
    customTimeInput: { width: 60, height: 60, backgroundColor: COLORS.inputBackground, borderRadius: BORDER_RADIUS.md, fontSize: 32, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
    timeColon: { fontSize: 32, fontWeight: '700', color: COLORS.textPrimary, marginHorizontal: SPACING.sm },
    amPmToggle: { flexDirection: 'column', marginLeft: SPACING.lg, borderRadius: BORDER_RADIUS.sm, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
    amPmBtn: { paddingVertical: 8, paddingHorizontal: SPACING.md, backgroundColor: COLORS.cardBackground },
    amPmBtnActive: { backgroundColor: COLORS.primary },
    amPmText: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.textSecondary },
    amPmTextActive: { color: COLORS.textOnPrimary },
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
    customTargetsContainer: { marginTop: SPACING.md, backgroundColor: COLORS.background, borderRadius: BORDER_RADIUS.md, padding: SPACING.sm },
    customTargetsHeader: { fontSize: FONT_SIZES.xs, fontWeight: '600', color: COLORS.textMuted, marginBottom: 8, textTransform: 'uppercase' },
    customTargetRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
    customTargetName: { fontSize: FONT_SIZES.sm, color: COLORS.textPrimary, fontWeight: '500' },
    customTargetValue: { fontSize: FONT_SIZES.sm, color: COLORS.primary, fontWeight: '700' },
    optionsGroupSmall: { flexDirection: 'row', backgroundColor: COLORS.inputBackground, borderRadius: BORDER_RADIUS.md, padding: 4 },
    smallOptionBtn: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: BORDER_RADIUS.sm, alignItems: 'center' },
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

    // Autopilot specific styles
    timeValueBox: {
        backgroundColor: COLORS.inputBackground,
        paddingHorizontal: SPACING.md,
        paddingVertical: 8,
        borderRadius: BORDER_RADIUS.md,
    },
    timeValueText: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.primary,
    },
    iosPickerContainer: {
        backgroundColor: COLORS.background,
        padding: SPACING.md,
        alignItems: 'center',
    },
    pickerDoneBtn: {
        backgroundColor: COLORS.primaryLight,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.full,
        marginTop: SPACING.sm,
    },
    pickerDoneText: {
        color: COLORS.primary,
        fontWeight: '600',
    },
    radioGroup: {
        flexDirection: 'row',
        paddingHorizontal: SPACING.md,
        paddingBottom: SPACING.md,
        gap: SPACING.sm,
        marginTop: SPACING.sm,
    },
    radioOption: {
        flex: 1,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
    },
    radioOptionSelectedPresent: {
        borderColor: COLORS.success,
        backgroundColor: COLORS.successLight,
    },
    radioOptionSelectedAbsent: {
        borderColor: COLORS.danger,
        backgroundColor: COLORS.dangerLight,
    },
    radioText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
    radioTextSelectedPresent: {
        color: COLORS.successDark,
        fontWeight: '600',
    },
    radioTextSelectedAbsent: {
        color: COLORS.dangerDark,
        fontWeight: '600',
    },

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

    // Reset Modal Styles
    resetModalContent: { backgroundColor: COLORS.cardBackground, borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.xl, paddingBottom: Platform.OS === 'ios' ? 50 : SPACING.xxl, alignItems: 'center' },
    resetDragHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, marginBottom: SPACING.xl },
    resetEmoji: { fontSize: 56, marginBottom: SPACING.md },
    resetTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, marginBottom: SPACING.sm },
    resetDescription: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: SPACING.md, paddingHorizontal: SPACING.lg },
    resetWarning: { fontSize: FONT_SIZES.sm, color: COLORS.danger, fontWeight: '600', textAlign: 'center', marginBottom: SPACING.xl },
    resetActions: { flexDirection: 'column', gap: SPACING.sm, width: '100%' },
    resetButton: { paddingVertical: SPACING.md + 2, borderRadius: BORDER_RADIUS.md, alignItems: 'center', width: '100%' },
    resetButtonCancel: { backgroundColor: COLORS.successLight },
    resetButtonConfirm: { backgroundColor: COLORS.dangerLight },
    resetButtonCancelText: { fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.successDark },
    resetButtonConfirmText: { fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.danger },
});

export default SettingsScreen;
