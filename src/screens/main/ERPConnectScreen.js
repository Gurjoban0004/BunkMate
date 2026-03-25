import React, { useState, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TextInput,
    TouchableOpacity, Platform, KeyboardAvoidingView,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import FloatingBackButton from '../../components/common/FloatingBackButton';
import { showAlert } from '../../utils/alert';
import { erpLogin, erpVerifyOtp, erpFetchAttendance, erpFetchCalendar } from '../../services/erpService';
import { saveErpToken, clearErpToken } from '../../storage/erpTokenStorage';
import { mapErpToAppState, buildResyncPayload, mapCalendarToRecords } from '../../utils/erpAttendanceMapper';

// ─── STEP CONSTANTS ────────────────────────────────────────────────
const STEP_LOGIN = 'login';
const STEP_OTP = 'otp';
const STEP_PREVIEW = 'preview';
const STEP_SUCCESS = 'success';

/**
 * ERP Connect Screen — Multi-step flow:
 * 1. Login (UserID + Password)
 * 2. OTP Verification
 * 3. Attendance Preview + Import
 */
export default function ERPConnectScreen({ navigation }) {
    const styles = getStyles();
    const { state, dispatch } = useApp();

    // ─── FLOW STATE ────────────────────────────────────────────────
    const [step, setStep] = useState(STEP_LOGIN);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Login state
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // OTP state
    const [authUserId, setAuthUserId] = useState('');
    const [otp, setOtp] = useState('');

    // Preview state
    const [token, setToken] = useState('');
    const [studentName, setStudentName] = useState('');
    const [erpSubjects, setErpSubjects] = useState([]);
    const [mappingResult, setMappingResult] = useState(null);

    // Calendar sync state
    const [calendarSyncing, setCalendarSyncing] = useState(false);
    const [calendarResult, setCalendarResult] = useState(null);

    // ─── STEP 1: LOGIN ─────────────────────────────────────────────
    const handleLogin = useCallback(async () => {
        if (!username.trim() || !password.trim()) {
            setError('Please enter your User ID and Password');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const result = await erpLogin(username.trim(), password);
            setAuthUserId(result.authUserId);
            setStep(STEP_OTP);
        } catch (err) {
            setError(err.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    }, [username, password]);

    // ─── STEP 2: OTP ───────────────────────────────────────────────
    const handleVerifyOtp = useCallback(async () => {
        if (!otp.trim() || otp.trim().length < 4) {
            setError('Please enter a valid OTP');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Verify OTP → get encrypted token
            const otpResult = await erpVerifyOtp(authUserId, otp.trim());
            setToken(otpResult.token);
            setStudentName(otpResult.studentName || '');

            // Save token for future syncs
            await saveErpToken(otpResult.token, otpResult.expiresAt, otpResult.studentName);

            // Immediately fetch attendance
            const attendanceResult = await erpFetchAttendance(otpResult.token);

            if (!attendanceResult.subjects || attendanceResult.subjects.length === 0) {
                setError(attendanceResult.warning || 'No attendance data found. The portal format may have changed.');
                setLoading(false);
                return;
            }

            setErpSubjects(attendanceResult.subjects);

            // Map to app state
            const mapping = mapErpToAppState(attendanceResult.subjects, state.subjects);
            setMappingResult(mapping);
            setStep(STEP_PREVIEW);
        } catch (err) {
            setError(err.message || 'OTP verification failed. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [otp, authUserId, state.subjects]);

    // ─── STEP 3: IMPORT ─────────────────────────────────────────────
    const handleImport = useCallback(() => {
        if (!mappingResult) return;

        const { matchedUpdates, newSubjects } = mappingResult;

        // Add new subjects first
        if (newSubjects.length > 0) {
            const allSubjects = [...state.subjects, ...newSubjects];
            dispatch({ type: 'SET_SUBJECTS', payload: allSubjects });
        }

        // Resync matched subjects
        if (matchedUpdates.length > 0) {
            const payload = buildResyncPayload(matchedUpdates);
            dispatch({ type: 'RESYNC_ATTENDANCE', payload });
        }

        // Update ERP connection status
        dispatch({
            type: 'UPDATE_SETTINGS',
            payload: {
                erpConnected: true,
                lastErpSync: new Date().toISOString(),
            },
        });

        // Update username from ERP if available
        if (studentName && !state.userName) {
            dispatch({ type: 'SET_USER_NAME', payload: studentName });
        }

        setStep(STEP_SUCCESS);

        // After import, trigger calendar sync in background
        syncCalendar(newSubjects);
    }, [mappingResult, state.subjects, state.userName, studentName, dispatch]);

    // ─── CALENDAR SYNC (background after import) ────────────────────
    const syncCalendar = useCallback(async (justAddedSubjects = []) => {
        if (!token) return;

        setCalendarSyncing(true);
        try {
            const calData = await erpFetchCalendar(token);

            if (calData.calendar && Object.keys(calData.calendar).length > 0) {
                // Combine existing subjects with any just-added ones
                const allSubjects = [...state.subjects, ...justAddedSubjects];
                const result = mapCalendarToRecords(calData.calendar, calData.subjects, allSubjects);

                // Add any new subjects discovered from calendar
                if (result.newSubjects.length > 0) {
                    const updatedSubjects = [...allSubjects, ...result.newSubjects];
                    dispatch({ type: 'SET_SUBJECTS', payload: updatedSubjects });
                }

                // Load calendar records into state
                dispatch({
                    type: 'LOAD_CALENDAR_RECORDS',
                    payload: {
                        records: result.records,
                        trackingStartDate: result.earliestDate,
                    },
                });

                setCalendarResult({
                    totalDays: result.totalDays,
                    earliestDate: result.earliestDate,
                });
            }
        } catch (err) {
            console.warn('Calendar sync failed (non-critical):', err.message);
            // Calendar sync is non-critical — don't show error to user
        } finally {
            setCalendarSyncing(false);
        }
    }, [token, state.subjects, dispatch]);

    // ─── QUICK SYNC (for re-sync with existing token) ───────────────
    const handleQuickSync = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const result = await erpFetchAttendance(token);

            if (!result.subjects || result.subjects.length === 0) {
                setError('No attendance data found.');
                setLoading(false);
                return;
            }

            setErpSubjects(result.subjects);
            const mapping = mapErpToAppState(result.subjects, state.subjects);
            setMappingResult(mapping);
            setStep(STEP_PREVIEW);
        } catch (err) {
            setError(err.message || 'Sync failed. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [token, state.subjects]);

    // ─── RENDER: LOGIN STEP ─────────────────────────────────────────
    const renderLoginStep = () => (
        <View style={styles.stepContainer}>
            <View style={styles.header}>
                <Text style={styles.headerEmoji}>🔗</Text>
                <Text style={styles.headerTitle}>Connect to ERP</Text>
                <Text style={styles.headerSub}>
                    Enter your college ERP credentials to automatically fetch your attendance data.
                </Text>
            </View>

            <View style={styles.formCard}>
                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>USER ID</Text>
                    <TextInput
                        style={styles.input}
                        value={username}
                        onChangeText={(t) => { setUsername(t); setError(''); }}
                        placeholder="Enter your ERP User ID"
                        placeholderTextColor={COLORS.textMuted}
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!loading}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>PASSWORD</Text>
                    <View style={styles.passwordRow}>
                        <TextInput
                            style={[styles.input, { flex: 1 }]}
                            value={password}
                            onChangeText={(t) => { setPassword(t); setError(''); }}
                            placeholder="Enter your password"
                            placeholderTextColor={COLORS.textMuted}
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!loading}
                        />
                        <TouchableOpacity
                            style={styles.eyeButton}
                            onPress={() => setShowPassword(!showPassword)}
                        >
                            <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            <View style={styles.securityNote}>
                <Text style={styles.securityIcon}>🔒</Text>
                <Text style={styles.securityText}>
                    Your credentials are sent directly to the college portal. We never store your password.
                </Text>
            </View>
        </View>
    );

    // ─── RENDER: OTP STEP ───────────────────────────────────────────
    const renderOtpStep = () => (
        <View style={styles.stepContainer}>
            <View style={styles.header}>
                <Text style={styles.headerEmoji}>📱</Text>
                <Text style={styles.headerTitle}>Enter OTP</Text>
                <Text style={styles.headerSub}>
                    We've sent an OTP to your registered mobile number. Enter it below.
                </Text>
            </View>

            <View style={styles.formCard}>
                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>OTP CODE</Text>
                    <TextInput
                        style={[styles.input, styles.otpInput]}
                        value={otp}
                        onChangeText={(t) => { setOtp(t.replace(/[^0-9]/g, '')); setError(''); }}
                        placeholder="Enter OTP"
                        placeholderTextColor={COLORS.textMuted}
                        keyboardType="number-pad"
                        maxLength={6}
                        autoFocus
                        editable={!loading}
                    />
                </View>
            </View>

            <TouchableOpacity onPress={() => { setStep(STEP_LOGIN); setOtp(''); setError(''); }}>
                <Text style={styles.linkText}>← Back to login</Text>
            </TouchableOpacity>
        </View>
    );

    // ─── RENDER: PREVIEW STEP ───────────────────────────────────────
    const renderPreviewStep = () => {
        if (!mappingResult) return null;
        const { matchedUpdates, newSubjects } = mappingResult;
        const totalImports = matchedUpdates.length + newSubjects.length;

        return (
            <View style={styles.stepContainer}>
                <View style={styles.header}>
                    <Text style={styles.headerEmoji}>📊</Text>
                    <Text style={styles.headerTitle}>Attendance Preview</Text>
                    <Text style={styles.headerSub}>
                        Found {erpSubjects.length} subjects from ERP. Review before importing.
                    </Text>
                </View>

                {/* Matched subjects */}
                {matchedUpdates.length > 0 && (
                    <View style={styles.sectionBlock}>
                        <Text style={styles.sectionLabel}>
                            ✅ MATCHED ({matchedUpdates.length})
                        </Text>
                        {matchedUpdates.map((u, i) => (
                            <View key={i} style={styles.previewCard}>
                                <View style={styles.previewHeader}>
                                    <Text style={styles.previewName} numberOfLines={1}>
                                        {u.subjectName}
                                    </Text>
                                    <Text style={[styles.previewPercentage, {
                                        color: u.percentage >= 75 ? COLORS.successDark : COLORS.dangerDark,
                                    }]}>
                                        {u.percentage.toFixed(1)}%
                                    </Text>
                                </View>
                                <Text style={styles.previewDetail}>
                                    {u.newAttended}/{u.newTotal} lectures attended
                                </Text>
                                {u.erpName !== u.subjectName && (
                                    <Text style={styles.previewMatch}>
                                        ERP: {u.erpName}
                                    </Text>
                                )}
                            </View>
                        ))}
                    </View>
                )}

                {/* New subjects */}
                {newSubjects.length > 0 && (
                    <View style={styles.sectionBlock}>
                        <Text style={styles.sectionLabel}>
                            ➕ NEW SUBJECTS ({newSubjects.length})
                        </Text>
                        {newSubjects.map((sub, i) => (
                            <View key={i} style={styles.previewCard}>
                                <View style={styles.previewHeader}>
                                    <View style={[styles.colorDot, { backgroundColor: sub.color }]} />
                                    <Text style={styles.previewName} numberOfLines={1}>
                                        {sub.name}
                                    </Text>
                                </View>
                                <Text style={styles.previewDetail}>
                                    {sub.initialAttended}/{sub.initialTotal} lectures
                                    {sub.teacher ? ` • ${sub.teacher}` : ''}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}
            </View>
        );
    };

    // ─── RENDER: SUCCESS STEP ───────────────────────────────────────
    const renderSuccessStep = () => (
        <View style={styles.stepContainer}>
            <View style={[styles.header, { marginTop: SPACING.xxl }]}>
                <Text style={[styles.headerEmoji, { fontSize: 56 }]}>🎉</Text>
                <Text style={styles.headerTitle}>All Synced!</Text>
                <Text style={styles.headerSub}>
                    Your attendance has been imported from the ERP portal.
                    {studentName ? `\n\nWelcome, ${studentName}!` : ''}
                </Text>
            </View>

            <View style={styles.successStats}>
                {mappingResult && (
                    <>
                        {mappingResult.matchedUpdates.length > 0 && (
                            <View style={styles.statRow}>
                                <Text style={styles.statLabel}>Updated subjects</Text>
                                <Text style={styles.statValue}>{mappingResult.matchedUpdates.length}</Text>
                            </View>
                        )}
                        {mappingResult.newSubjects.length > 0 && (
                            <View style={styles.statRow}>
                                <Text style={styles.statLabel}>New subjects added</Text>
                                <Text style={styles.statValue}>{mappingResult.newSubjects.length}</Text>
                            </View>
                        )}
                    </>
                )}

                {/* Calendar sync status */}
                {calendarSyncing && (
                    <View style={styles.statRow}>
                        <Text style={styles.statLabel}>Syncing calendar...</Text>
                        <ActivityIndicator size="small" color={COLORS.primary} />
                    </View>
                )}
                {calendarResult && (
                    <View style={styles.statRow}>
                        <Text style={styles.statLabel}>Calendar days imported</Text>
                        <Text style={styles.statValue}>{calendarResult.totalDays} 📅</Text>
                    </View>
                )}
            </View>

            <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => navigation.goBack()}
                activeOpacity={0.8}
            >
                <Text style={styles.primaryButtonText}>Done</Text>
            </TouchableOpacity>
        </View>
    );

    // ─── BOTTOM BUTTON ──────────────────────────────────────────────
    const getBottomButton = () => {
        switch (step) {
            case STEP_LOGIN:
                return {
                    text: loading ? 'Connecting...' : 'Login',
                    onPress: handleLogin,
                    disabled: loading || !username.trim() || !password.trim(),
                };
            case STEP_OTP:
                return {
                    text: loading ? 'Verifying...' : 'Verify OTP',
                    onPress: handleVerifyOtp,
                    disabled: loading || otp.trim().length < 4,
                };
            case STEP_PREVIEW:
                return {
                    text: `Import ${(mappingResult?.matchedUpdates.length || 0) + (mappingResult?.newSubjects.length || 0)} Subjects`,
                    onPress: handleImport,
                    disabled: false,
                };
            default:
                return null;
        }
    };

    const bottomButton = getBottomButton();

    // ─── MAIN RENDER ────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <FloatingBackButton />
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Step indicator */}
                    {step !== STEP_SUCCESS && (
                        <View style={styles.stepIndicator}>
                            {[STEP_LOGIN, STEP_OTP, STEP_PREVIEW].map((s, i) => {
                                const currentIdx = [STEP_LOGIN, STEP_OTP, STEP_PREVIEW].indexOf(step);
                                const stepIdx = i;
                                const isActive = stepIdx <= currentIdx;
                                const isCompleted = stepIdx < currentIdx;
                                const labels = ['Login', 'Verify', 'Review'];
                                return (
                                    <View key={s} style={styles.stepDotRow}>
                                        <View style={styles.stepDotContainer}>
                                            <View style={[
                                                styles.stepDot,
                                                isActive && styles.stepDotActive,
                                                isCompleted && styles.stepDotCompleted,
                                            ]}>
                                                {isCompleted ? (
                                                    <Text style={styles.stepCheckmark}>✓</Text>
                                                ) : (
                                                    <Text style={[
                                                        styles.stepNumber,
                                                        isActive && styles.stepNumberActive,
                                                    ]}>{i + 1}</Text>
                                                )}
                                            </View>
                                            <Text style={[
                                                styles.stepLabel,
                                                isActive && styles.stepLabelActive,
                                            ]}>{labels[i]}</Text>
                                        </View>
                                        {i < 2 && <View style={[
                                            styles.stepLine,
                                            isCompleted && styles.stepLineActive,
                                        ]} />}
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {/* Render current step */}
                    {step === STEP_LOGIN && renderLoginStep()}
                    {step === STEP_OTP && renderOtpStep()}
                    {step === STEP_PREVIEW && renderPreviewStep()}
                    {step === STEP_SUCCESS && renderSuccessStep()}

                    {/* Error message */}
                    {error ? (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>⚠️ {error}</Text>
                        </View>
                    ) : null}

                    {/* Loading indicator */}
                    {loading && (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color={COLORS.primary} />
                            <Text style={styles.loadingText}>
                                {step === STEP_LOGIN ? 'Connecting to portal...' : 'Fetching attendance...'}
                            </Text>
                        </View>
                    )}

                    <View style={{ height: 120 }} />
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Bottom action button */}
            {bottomButton && (
                <View style={styles.bottomBar}>
                    <TouchableOpacity
                        style={[styles.primaryButton, bottomButton.disabled && styles.primaryButtonDisabled]}
                        onPress={bottomButton.onPress}
                        activeOpacity={0.8}
                        disabled={bottomButton.disabled}
                    >
                        <Text style={styles.primaryButtonText}>{bottomButton.text}</Text>
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    );
}

// ─── STYLES ─────────────────────────────────────────────────────────
const getStyles = () => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        paddingTop: 60,
        paddingHorizontal: SPACING.lg,
    },

    // Step indicator
    stepIndicator: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'flex-start',
        marginBottom: SPACING.xl,
        paddingHorizontal: SPACING.md,
    },
    stepDotRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stepDotContainer: {
        alignItems: 'center',
        gap: 6,
    },
    stepDot: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.inputBackground,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: COLORS.border,
    },
    stepDotActive: {
        backgroundColor: COLORS.primaryLight,
        borderColor: COLORS.primary,
    },
    stepDotCompleted: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    stepNumber: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.textMuted,
    },
    stepNumberActive: {
        color: COLORS.primary,
    },
    stepCheckmark: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
    },
    stepLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.textMuted,
        letterSpacing: 0.3,
    },
    stepLabelActive: {
        color: COLORS.primary,
    },
    stepLine: {
        width: 44,
        height: 2,
        backgroundColor: COLORS.border,
        marginHorizontal: 8,
        marginBottom: 20,
    },
    stepLineActive: {
        backgroundColor: COLORS.primary,
    },

    // Header
    stepContainer: {},
    header: {
        alignItems: 'center',
        marginBottom: SPACING.xl,
    },
    headerEmoji: {
        fontSize: 40,
        marginBottom: SPACING.sm,
    },
    headerTitle: {
        fontSize: FONT_SIZES.xl,
        fontWeight: '800',
        color: COLORS.textPrimary,
        marginBottom: SPACING.xs,
    },
    headerSub: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: SPACING.md,
    },

    // Form card
    formCard: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.small,
        gap: SPACING.md,
    },
    inputGroup: {},
    inputLabel: {
        fontSize: 10,
        color: COLORS.textMuted,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 6,
    },
    input: {
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.sm,
        paddingHorizontal: SPACING.md,
        paddingVertical: Platform.OS === 'ios' ? 14 : 12,
        fontSize: FONT_SIZES.md,
        fontWeight: '500',
        color: COLORS.textPrimary,
        ...Platform.select({ web: { outlineStyle: 'none' } }),
    },
    otpInput: {
        textAlign: 'center',
        fontSize: FONT_SIZES.xl,
        fontWeight: '700',
        letterSpacing: 8,
    },
    passwordRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    eyeButton: {
        padding: SPACING.sm,
    },
    eyeIcon: {
        fontSize: 20,
    },

    // Security note
    securityNote: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: SPACING.md,
        paddingHorizontal: SPACING.sm,
        gap: SPACING.sm,
    },
    securityIcon: {
        fontSize: 14,
        marginTop: 1,
    },
    securityText: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
        flex: 1,
        lineHeight: 18,
    },

    // Link
    linkText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.primary,
        fontWeight: '600',
        textAlign: 'center',
        marginTop: SPACING.md,
    },

    // Preview
    sectionBlock: {
        marginBottom: SPACING.lg,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.textMuted,
        letterSpacing: 0.5,
        marginBottom: SPACING.sm,
    },
    previewCard: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.sm,
        padding: SPACING.md,
        marginBottom: SPACING.xs,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    previewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    previewName: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.textPrimary,
        flex: 1,
    },
    previewPercentage: {
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
    },
    previewDetail: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
    },
    previewMatch: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
        fontStyle: 'italic',
        marginTop: 2,
    },
    colorDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: SPACING.sm,
    },

    // Success
    successStats: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.lg,
        ...SHADOWS.small,
        marginBottom: SPACING.xl,
    },
    statRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: SPACING.sm,
    },
    statLabel: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
    },
    statValue: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },

    // Error
    errorContainer: {
        backgroundColor: COLORS.dangerLight,
        borderRadius: BORDER_RADIUS.sm,
        padding: SPACING.md,
        marginTop: SPACING.md,
    },
    errorText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.dangerDark,
        textAlign: 'center',
    },

    // Loading
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: SPACING.md,
        gap: SPACING.sm,
    },
    loadingText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textMuted,
    },

    // Bottom bar
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: SPACING.lg,
        backgroundColor: COLORS.background,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    primaryButton: {
        backgroundColor: COLORS.primary,
        borderRadius: BORDER_RADIUS.md,
        paddingVertical: SPACING.md + 2,
        alignItems: 'center',
        ...SHADOWS.medium,
    },
    primaryButtonDisabled: {
        backgroundColor: COLORS.inputBackground,
    },
    primaryButtonText: {
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
