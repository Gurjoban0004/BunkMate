import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    Platform, KeyboardAvoidingView, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import { erpLogin, erpVerifyOtp, erpFetchAttendance, erpFetchCalendar } from '../../services/erpService';
import { saveErpToken } from '../../storage/erpTokenStorage';
import { mapErpToAppState, mapCalendarToRecords } from '../../utils/erpAttendanceMapper';
import { getUserId } from '../../utils/firebaseHelpers';
import { getTodayKey } from '../../utils/dateHelpers';
import { logger } from '../../utils/logger';

const STEP_LOGIN = 'login';
const STEP_OTP = 'otp';
const STEP_PREVIEW = 'preview';
const STEP_IMPORTING = 'importing';

export default function ERPSetupScreen({ navigation }) {
    const { state, dispatch } = useApp();

    // Flow state
    const [step, setStep] = useState(STEP_LOGIN);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Login
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // OTP
    const [authUserId, setAuthUserId] = useState('');
    const [otp, setOtp] = useState('');

    // Data
    const [token, setToken] = useState('');
    const tokenRef = React.useRef(''); // BUG-06 fix: ref avoids stale closure
    const [studentName, setStudentName] = useState('');
    const [erpSubjects, setErpSubjects] = useState([]);
    const [mappingResult, setMappingResult] = useState(null);

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
            // Pass username + password so server builds the persistent token
            const otpResult = await erpVerifyOtp(authUserId, otp.trim(), username.trim(), password);
            setToken(otpResult.token);
            tokenRef.current = otpResult.token;
            setStudentName(otpResult.studentName || '');
            // Save session token + persistent token (no expiry — refreshed on failure)
            await saveErpToken(otpResult.token, otpResult.studentName || '', otpResult.persistentToken);

            // Fetch attendance preview
            const attendanceResult = await erpFetchAttendance(otpResult.token);
            if (!attendanceResult.subjects || attendanceResult.subjects.length === 0) {
                setError(attendanceResult.warning || 'No attendance data found.');
                setLoading(false);
                return;
            }
            setErpSubjects(attendanceResult.subjects);
            const mapping = mapErpToAppState(attendanceResult.subjects, []);
            setMappingResult(mapping);
            setStep(STEP_PREVIEW);
        } catch (err) {
            setError(err.message || 'OTP verification failed.');
        } finally {
            setLoading(false);
        }
    }, [otp, authUserId, username, password]);

    // ─── STEP 3: IMPORT & COMPLETE SETUP ────────────────────────────
    const handleImport = useCallback(async () => {
        if (!mappingResult) return;
        setStep(STEP_IMPORTING);

        try {
            // Generate userId
            let userId = state.userId;
            if (!userId) {
                userId = await getUserId();
                dispatch({ type: 'SET_USER_ID', payload: userId });
            }
            dispatch({ type: 'SET_AUTHENTICATED', payload: true });

            // Set subjects from ERP
            const allSubjects = [...mappingResult.newSubjects];
            dispatch({ type: 'SET_SUBJECTS', payload: allSubjects });

            // Set initial attendance
            const updates = allSubjects.map(sub => ({
                id: sub.id,
                initialTotal: sub.initialTotal,
                initialAttended: sub.initialAttended,
            }));
            dispatch({ type: 'SET_INITIAL_ATTENDANCE', payload: updates });

            // Set student name
            if (studentName) {
                dispatch({ type: 'SET_USER_NAME', payload: studentName });
            }

            // Set ERP connected
            dispatch({
                type: 'UPDATE_SETTINGS',
                payload: {
                    erpConnected: true,
                    lastErpSync: new Date().toISOString(),
                },
            });

            // Set tracking config
            const todayStr = getTodayKey(state.devDate);
            dispatch({
                type: 'SET_TRACKING_CONFIG',
                payload: {
                    setupDate: todayStr,
                    trackingStartDate: todayStr,
                    todayIncludedInSetup: false,
                },
            });

            // Try calendar sync in background
            try {
                const currentToken = tokenRef.current; // BUG-06 fix: use ref
                if (currentToken) {
                    const calData = await erpFetchCalendar(currentToken);
                    if (calData.calendar && Object.keys(calData.calendar).length > 0) {
                        const result = mapCalendarToRecords(calData.calendar, calData.subjects, allSubjects);
                        if (result.newSubjects.length > 0) {
                            const updatedSubjects = [...allSubjects, ...result.newSubjects];
                            dispatch({ type: 'SET_SUBJECTS', payload: updatedSubjects });
                        }
                        dispatch({
                            type: 'LOAD_CALENDAR_RECORDS',
                            payload: {
                                records: result.records,
                                trackingStartDate: result.earliestDate,
                            },
                        });
                    }
                }
            } catch (calErr) {
                logger.warn('Calendar sync failed (non-critical):', calErr.message);
            }
            // Route to timetable setup instead of finishing immediately
            navigation.replace('TimeSlots');
        } catch (err) {
            logger.error('Setup import failed:', err);
            setError('Something went wrong during setup. Please try again.');
            setStep(STEP_PREVIEW);
        }
    }, [mappingResult, studentName, state.userId, state.devDate, dispatch]); // CR-05 fix: removed `token` — tokenRef.current is used inside instead

    // ─── STEP INDICATOR ─────────────────────────────────────────────
    const stepIndex = [STEP_LOGIN, STEP_OTP, STEP_PREVIEW].indexOf(step);
    const steps = ['Login', 'Verify', 'Review'];

    const renderStepIndicator = () => (
        <View style={styles.stepIndicator}>
            {steps.map((label, i) => (
                <View key={label} style={styles.stepDotRow}>
                    <View style={styles.stepDotContainer}>
                        <View style={[
                            styles.stepDot,
                            i <= stepIndex && styles.stepDotActive,
                            i < stepIndex && styles.stepDotCompleted,
                        ]}>
                            {i < stepIndex ? (
                                <Text style={styles.stepCheckmark}>✓</Text>
                            ) : (
                                <Text style={[
                                    styles.stepNumber,
                                    i <= stepIndex && styles.stepNumberActive,
                                ]}>{i + 1}</Text>
                            )}
                        </View>
                        <Text style={[
                            styles.stepLabel,
                            i <= stepIndex && styles.stepLabelActive,
                        ]}>{label}</Text>
                    </View>
                    {i < 2 && (
                        <View style={[
                            styles.stepLine,
                            i < stepIndex && styles.stepLineActive,
                        ]} />
                    )}
                </View>
            ))}
        </View>
    );

    // ─── RENDER: LOGIN ──────────────────────────────────────────────
    const renderLogin = () => (
        <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionEmoji}>🔐</Text>
                <Text style={styles.sectionTitle}>College ERP Login</Text>
                <Text style={styles.sectionSub}>
                    Enter your ERP credentials to import your attendance automatically.
                </Text>
            </View>

            <View style={styles.card}>
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
                            <Text style={styles.eyeIcon}>
                                {showPassword ? '🙈' : '👁️'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            <View style={styles.securityBadge}>
                <Text style={styles.securityIcon}>🔒</Text>
                <Text style={styles.securityText}>
                    Your credentials are encrypted and stored securely. You won't need to login again.
                </Text>
            </View>
        </View>
    );

    // ─── RENDER: OTP ────────────────────────────────────────────────
    const renderOtp = () => (
        <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionEmoji}>📱</Text>
                <Text style={styles.sectionTitle}>Enter OTP</Text>
                <Text style={styles.sectionSub}>
                    We've sent an OTP to your registered mobile number.
                </Text>
            </View>

            <View style={styles.card}>
                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>OTP CODE</Text>
                    <TextInput
                        style={[styles.input, styles.otpInput]}
                        value={otp}
                        onChangeText={(t) => { setOtp(t.replace(/[^0-9]/g, '')); setError(''); }}
                        placeholder="• • • • • •"
                        placeholderTextColor={COLORS.textMuted}
                        keyboardType="number-pad"
                        maxLength={6}
                        autoFocus
                        editable={!loading}
                    />
                </View>
            </View>

            <TouchableOpacity
                style={styles.backLink}
                onPress={() => { setStep(STEP_LOGIN); setOtp(''); setError(''); }}
            >
                <Text style={styles.backLinkText}>← Back to login</Text>
            </TouchableOpacity>
        </View>
    );

    // ─── RENDER: PREVIEW ────────────────────────────────────────────
    const renderPreview = () => {
        if (!mappingResult) return null;
        const { newSubjects } = mappingResult;

        return (
            <View style={styles.formSection}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionEmoji}>📊</Text>
                    <Text style={styles.sectionTitle}>Your Attendance</Text>
                    <Text style={styles.sectionSub}>
                        Found {erpSubjects.length} subjects from ERP.
                        {studentName ? ` Welcome, ${studentName}!` : ''}
                    </Text>
                </View>

                {newSubjects.map((sub, i) => {
                    const pct = sub.initialTotal > 0
                        ? ((sub.initialAttended / sub.initialTotal) * 100).toFixed(1)
                        : '—';
                    const isLow = sub.initialTotal > 0 && (sub.initialAttended / sub.initialTotal) < 0.75;

                    return (
                        <View key={sub.id} style={styles.previewCard}>
                            <View style={styles.previewRow}>
                                <View style={[styles.colorDot, { backgroundColor: sub.color }]} />
                                <Text style={styles.previewName} numberOfLines={1}>
                                    {sub.name}
                                </Text>
                                <Text style={[
                                    styles.previewPct,
                                    isLow ? { color: COLORS.danger } : { color: COLORS.success },
                                ]}>
                                    {pct}%
                                </Text>
                            </View>
                            <Text style={styles.previewDetail}>
                                {sub.initialAttended}/{sub.initialTotal} lectures
                                {sub.teacher ? ` · ${sub.teacher}` : ''}
                            </Text>
                        </View>
                    );
                })}
            </View>
        );
    };

    // ─── RENDER: IMPORTING ──────────────────────────────────────────
    const renderImporting = () => (
        <View style={styles.importingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.importingTitle}>Setting up your account...</Text>
            <Text style={styles.importingSub}>
                Importing subjects and syncing calendar data.
            </Text>
        </View>
    );

    // ─── BOTTOM BUTTON ──────────────────────────────────────────────
    const getButton = () => {
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
                    text: `Import & Get Started`,
                    onPress: handleImport,
                    disabled: false,
                };
            default:
                return null;
        }
    };

    const button = getButton();

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Header */}
                    <View style={styles.topBar}>
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={styles.topBarBack}
                        >
                            <Text style={styles.topBarBackText}>←</Text>
                        </TouchableOpacity>
                        <Text style={styles.topBarTitle}>Login</Text>
                        <View style={styles.topBarBack} />
                    </View>

                    {step !== STEP_IMPORTING && renderStepIndicator()}

                    {step === STEP_LOGIN && renderLogin()}
                    {step === STEP_OTP && renderOtp()}
                    {step === STEP_PREVIEW && renderPreview()}
                    {step === STEP_IMPORTING && renderImporting()}

                    {/* Error */}
                    {error ? (
                        <View style={styles.errorBox}>
                            <Text style={styles.errorText}>⚠️ {error}</Text>
                        </View>
                    ) : null}

                    {loading && step !== STEP_IMPORTING && (
                        <View style={styles.loadingRow}>
                            <ActivityIndicator size="small" color={COLORS.primary} />
                            <Text style={styles.loadingText}>
                                {step === STEP_LOGIN ? 'Connecting to portal...' : 'Fetching data...'}
                            </Text>
                        </View>
                    )}

                    <View style={{ height: 120 }} />
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Bottom action */}
            {button && (
                <View style={styles.bottomBar}>
                    <TouchableOpacity
                        style={[styles.actionButton, button.disabled && styles.actionButtonDisabled]}
                        onPress={button.onPress}
                        activeOpacity={0.8}
                        disabled={button.disabled}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <Text style={styles.actionButtonText}>{button.text}</Text>
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    );
}

// ─── STYLES ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        paddingHorizontal: SPACING.lg,
    },

    // Top bar
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: SPACING.md,
        marginBottom: SPACING.sm,
    },
    topBarBack: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    topBarBackText: {
        fontSize: 22,
        color: COLORS.textPrimary,
        fontWeight: '600',
    },
    topBarTitle: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '700',
        color: COLORS.textPrimary,
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

    // Section
    formSection: {},
    sectionHeader: {
        alignItems: 'center',
        marginBottom: SPACING.lg,
    },
    sectionEmoji: {
        fontSize: 36,
        marginBottom: SPACING.xs,
    },
    sectionTitle: {
        fontSize: FONT_SIZES.xl,
        fontWeight: '800',
        color: COLORS.textPrimary,
        marginBottom: 4,
    },
    sectionSub: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: SPACING.sm,
    },

    // Card
    card: {
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

    // Security
    securityBadge: {
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

    // Back link
    backLink: {
        marginTop: SPACING.md,
        alignItems: 'center',
    },
    backLinkText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.primary,
        fontWeight: '600',
    },

    // Preview
    previewCard: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.sm,
        padding: SPACING.md,
        marginBottom: SPACING.xs,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    previewRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    colorDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: SPACING.sm,
    },
    previewName: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.textPrimary,
        flex: 1,
    },
    previewPct: {
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
    },
    previewDetail: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
        marginLeft: 18,
    },

    // Importing
    importingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.xxl * 2,
        gap: SPACING.md,
    },
    importingTitle: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    importingSub: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        textAlign: 'center',
    },

    // Error
    errorBox: {
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
    loadingRow: {
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
    actionButton: {
        backgroundColor: COLORS.primary,
        borderRadius: BORDER_RADIUS.md,
        paddingVertical: SPACING.md + 2,
        alignItems: 'center',
        ...SHADOWS.medium,
    },
    actionButtonDisabled: {
        backgroundColor: COLORS.inputBackground,
    },
    actionButtonText: {
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
