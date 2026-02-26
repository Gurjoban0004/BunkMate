import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Switch,
    TextInput,
} from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import { clearAppState } from '../../storage/storage';
import { showAlert } from '../../utils/alert';

const THRESHOLD_OPTIONS = [70, 75, 80, 85, 90];

const SettingsScreen = ({ navigation }) => {
    const { state, dispatch } = useApp();
    const [editingName, setEditingName] = useState(false);
    const [tempName, setTempName] = useState(state.userName || '');

    // Settings values
    const {
        dangerThreshold = 75,
        weeklyGoal = 80,
        notificationEnabled = true,
        smartAlertsEnabled = true,
        weeklySummaryEnabled = true,
    } = state.settings || {};

    // Handlers
    const updateSetting = (key, value) => {
        dispatch({
            type: 'UPDATE_SETTINGS',
            payload: { [key]: value },
        });
    };

    const handleSaveName = () => {
        if (tempName.trim()) {
            dispatch({ type: 'SET_USER_NAME', payload: tempName.trim() });
        }
        setEditingName(false);
    };

    const handleResetSemester = () => {
        showAlert(
            '🗑️ Reset Semester',
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
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Settings</Text>
                    <Text style={styles.headerEmoji}>⚙️</Text>
                </View>

                {/* Profile Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📱 PROFILE</Text>

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
                                <TouchableOpacity
                                    style={styles.nameDisplay}
                                    onPress={() => {
                                        setTempName(state.userName || '');
                                        setEditingName(true);
                                    }}
                                >
                                    <Text style={styles.nameText}>{state.userName || 'Not set'}</Text>
                                    <Text style={styles.editIcon}>✏️</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>

                {/* Attendance Goal Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🎯 ATTENDANCE GOAL</Text>

                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Danger Threshold</Text>
                        <Text style={styles.cardDescription}>
                            Subjects below this percentage are flagged as needing attention
                        </Text>

                        <View style={styles.optionsRow}>
                            {THRESHOLD_OPTIONS.map((option) => (
                                <TouchableOpacity
                                    key={option}
                                    style={[
                                        styles.optionButton,
                                        dangerThreshold === option && styles.optionButtonActive,
                                    ]}
                                    onPress={() => updateSetting('dangerThreshold', option)}
                                >
                                    <Text
                                        style={[
                                            styles.optionText,
                                            dangerThreshold === option && styles.optionTextActive,
                                        ]}
                                    >
                                        {option}%
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Weekly Goal</Text>
                        <Text style={styles.cardDescription}>
                            Aim for this attendance percentage each week
                        </Text>

                        <View style={styles.sliderContainer}>
                            <Text style={styles.sliderValue}>{weeklyGoal}%</Text>
                            <View style={styles.sliderTrack}>
                                <View
                                    style={[
                                        styles.sliderFill,
                                        { width: `${((weeklyGoal - 50) / 50) * 100}%` },
                                    ]}
                                />
                            </View>
                            <View style={styles.sliderLabels}>
                                <Text style={styles.sliderLabel}>50%</Text>
                                <Text style={styles.sliderLabel}>100%</Text>
                            </View>
                        </View>

                        <View style={styles.goalButtonsRow}>
                            {[75, 80, 85, 90, 95].map((goal) => (
                                <TouchableOpacity
                                    key={goal}
                                    style={[
                                        styles.goalButton,
                                        weeklyGoal === goal && styles.goalButtonActive,
                                    ]}
                                    onPress={() => updateSetting('weeklyGoal', goal)}
                                >
                                    <Text
                                        style={[
                                            styles.goalButtonText,
                                            weeklyGoal === goal && styles.goalButtonTextActive,
                                        ]}
                                    >
                                        {goal}%
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </View>

                {/* Notifications Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🔔 NOTIFICATIONS</Text>

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

                {/* Timetable Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📚 DATA & TIMETABLE</Text>

                    <TouchableOpacity
                        style={styles.card}
                        onPress={() => navigation.navigate('PastAttendance')}
                    >
                        <View style={styles.linkRow}>
                            <Text style={styles.linkText}>Log Past Attendance</Text>
                            <Text style={styles.chevron}>›</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.card}
                        onPress={() => navigation.navigate('EditTimetable')}
                    >
                        <View style={styles.linkRow}>
                            <Text style={styles.linkText}>Edit Timetable</Text>
                            <Text style={styles.chevron}>›</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.card}
                        onPress={() => navigation.navigate('EditSubjects')}
                    >
                        <View style={styles.linkRow}>
                            <Text style={styles.linkText}>Edit Subjects</Text>
                            <Text style={styles.chevron}>›</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Danger Zone */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, styles.dangerTitle]}>⚠️ DANGER ZONE</Text>

                    <TouchableOpacity
                        style={[styles.card, styles.dangerCard]}
                        onPress={handleResetSemester}
                    >
                        <View style={styles.linkRow}>
                            <View>
                                <Text style={styles.dangerText}>🗑️ Reset Semester</Text>
                                <Text style={styles.dangerDescription}>
                                    Clear all attendance data
                                </Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* About Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>ℹ️ ABOUT</Text>

                    <View style={styles.aboutCard}>
                        <Text style={styles.appName}>BunkMate</Text>
                        <Text style={styles.version}>Version 1.0.0</Text>
                        <Text style={styles.madeWith}>Made with ❤️ for students</Text>
                    </View>
                </View>

                {/* Bottom Padding */}
                <View style={styles.bottomPadding} />
            </ScrollView>
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
        paddingTop: SPACING.lg,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        marginBottom: SPACING.lg,
    },
    headerTitle: {
        fontSize: FONT_SIZES.xl,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    headerEmoji: {
        fontSize: 28,
    },
    section: {
        marginBottom: SPACING.lg,
    },
    sectionTitle: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '700',
        color: COLORS.textSecondary,
        letterSpacing: 0.5,
        paddingHorizontal: SPACING.lg,
        marginBottom: SPACING.sm,
    },
    card: {
        backgroundColor: COLORS.cardBackground,
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.sm,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    cardTitle: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: 4,
    },
    cardDescription: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
        marginBottom: SPACING.md,
    },
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    settingInfo: {
        flex: 1,
        marginRight: SPACING.md,
    },
    settingLabel: {
        fontSize: FONT_SIZES.md,
        fontWeight: '500',
        color: COLORS.textPrimary,
    },
    settingDescription: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    nameEditContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    nameInput: {
        backgroundColor: COLORS.inputBackground,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 6,
        borderRadius: BORDER_RADIUS.sm,
        fontSize: FONT_SIZES.md,
        color: COLORS.textPrimary,
        minWidth: 120,
        marginRight: SPACING.sm,
    },
    saveButton: {
        color: COLORS.primary,
        fontWeight: '600',
        fontSize: FONT_SIZES.sm,
    },
    nameDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    nameText: {
        fontSize: FONT_SIZES.md,
        color: COLORS.textPrimary,
        marginRight: SPACING.sm,
    },
    editIcon: {
        fontSize: 14,
    },
    optionsRow: {
        flexDirection: 'row',
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: 4,
    },
    optionButton: {
        flex: 1,
        paddingVertical: SPACING.sm,
        alignItems: 'center',
        borderRadius: BORDER_RADIUS.sm,
    },
    optionButtonActive: {
        backgroundColor: COLORS.primary,
    },
    optionText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '500',
        color: COLORS.textSecondary,
    },
    optionTextActive: {
        color: COLORS.textOnPrimary,
        fontWeight: '600',
    },
    sliderContainer: {
        marginBottom: SPACING.md,
    },
    sliderValue: {
        fontSize: 24,
        fontWeight: '700',
        color: COLORS.primary,
        textAlign: 'center',
        marginBottom: SPACING.sm,
    },
    sliderTrack: {
        height: 8,
        backgroundColor: COLORS.progressBackground,
        borderRadius: 4,
        overflow: 'hidden',
    },
    sliderFill: {
        height: '100%',
        backgroundColor: COLORS.primary,
        borderRadius: 4,
    },
    sliderLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    sliderLabel: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
    },
    goalButtonsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    goalButton: {
        paddingVertical: 6,
        paddingHorizontal: SPACING.sm,
        borderRadius: BORDER_RADIUS.sm,
        backgroundColor: COLORS.inputBackground,
    },
    goalButtonActive: {
        backgroundColor: COLORS.primaryLight,
    },
    goalButtonText: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '500',
        color: COLORS.textSecondary,
    },
    goalButtonTextActive: {
        color: COLORS.primary,
        fontWeight: '600',
    },
    timePickerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: SPACING.md,
        paddingTop: SPACING.md,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    timePickerLabel: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
    },
    timeBadge: {
        backgroundColor: COLORS.primaryLight,
        paddingHorizontal: SPACING.md,
        paddingVertical: 6,
        borderRadius: BORDER_RADIUS.sm,
    },
    timeText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.primary,
    },
    linkRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    linkText: {
        fontSize: FONT_SIZES.md,
        fontWeight: '500',
        color: COLORS.textPrimary,
    },
    chevron: {
        fontSize: 24,
        color: COLORS.textMuted,
    },
    dangerTitle: {
        color: COLORS.danger,
    },
    dangerCard: {
        backgroundColor: COLORS.dangerLight,
        borderColor: COLORS.danger,
    },
    dangerText: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.danger,
    },
    dangerDescription: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.dangerDark,
        marginTop: 2,
    },
    aboutCard: {
        backgroundColor: COLORS.cardBackground,
        marginHorizontal: SPACING.lg,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    appName: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    version: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        marginTop: 4,
    },
    madeWith: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textMuted,
        marginTop: SPACING.sm,
    },
    bottomPadding: {
        height: 100,
    },
});

export default SettingsScreen;
