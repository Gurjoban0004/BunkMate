import React, { useState, useCallback, useEffect } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    Platform, KeyboardAvoidingView, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS, TYPOGRAPHY, PALETTES } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import { erpLogin, erpVerifyOtp, erpFetchAttendance, erpFetchCalendar, erpFetchTimetable } from '../../services/erpService';
import { saveErpToken } from '../../storage/erpTokenStorage';
import { mapErpToAppState, mapCalendarToRecords, buildErpNameMap, mapTimetableToState } from '../../utils/erpAttendanceMapper';
import { getUserId } from '../../utils/firebaseHelpers';
import { getTodayKey } from '../../utils/dateHelpers';
import { logger } from '../../utils/logger';

const STEP_LOGIN = 'login';
const STEP_OTP = 'otp';
const STEP_THEME = 'theme';
const STEP_IMPORTING = 'importing';

// Curated onboarding palettes — the final "pick a vibe" step before entering the app.
// The full picker (all palettes + light/dark) lives in Settings; this is intentionally short.
const ONBOARDING_PALETTES = ['chalkpad', 'catppuccin', 'forest', 'nordic'];

export default function ERPSetupScreen({ navigation }) {
    const { state, dispatch } = useApp();
    const styles = getStyles();

    // Flow state
    const [step, setStep] = useState(STEP_LOGIN);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [resendCooldown, setResendCooldown] = useState(0);

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

    // Resend-OTP cooldown countdown
    useEffect(() => {
        if (resendCooldown <= 0) return undefined;
        const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [resendCooldown]);

    // Re-request an OTP by re-running the login call (throttled to every 30s)
    const handleResendOtp = useCallback(async () => {
        if (resendCooldown > 0 || loading) return;
        setError('');
        try {
            const result = await erpLogin(username.trim(), password);
            setAuthUserId(result.authUserId);
            setResendCooldown(30);
        } catch (err) {
            setError(err.message || 'Could not resend OTP. Please try again.');
        }
    }, [username, password, resendCooldown, loading]);

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
            setStep(STEP_THEME);
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

            // Save roll number for admin detection
            if (username.trim()) {
                dispatch({ type: 'SET_ERP_ROLL_NUMBER', payload: username.trim() });
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
                        const step1NameMap = buildErpNameMap(mappingResult.matchedUpdates || [], mappingResult.newSubjects || []);
                        const result = mapCalendarToRecords(calData.calendar, calData.subjects, allSubjects, step1NameMap);
                        if (result.newSubjects.length > 0) {
                            const updatedSubjects = [...allSubjects, ...result.newSubjects];
                            dispatch({ type: 'SET_SUBJECTS', payload: updatedSubjects });
                        }
                        dispatch({
                            type: 'ERP_OVERWRITE_CALENDAR',
                            payload: {
                                records: result.records,
                                trackingStartDate: result.earliestDate,
                                latestErpDate: result.latestDate,
                                lastSubjectSyncDates: result.lastSubjectSyncDates,
                            },
                        });
                    }
                }
            } catch (calErr) {
                logger.warn('Calendar sync failed (non-critical):', calErr.message);
            }

            // Fetch the real timetable from the portal so Today shows actual classes
            // and times from day one — no reliance on the history-derived guess.
            try {
                const currentToken = tokenRef.current;
                if (currentToken) {
                    const ttData = await erpFetchTimetable(currentToken);
                    if (ttData?.success && ttData.source !== 'empty') {
                        const mapped = mapTimetableToState(ttData.timetable, ttData.timeSlots, allSubjects);
                        if (mapped.newSubjects.length > 0) {
                            dispatch({ type: 'SET_SUBJECTS', payload: [...allSubjects, ...mapped.newSubjects] });
                        }
                        dispatch({
                            type: 'ERP_SET_TIMETABLE',
                            payload: {
                                timetable: mapped.timetable,
                                timeSlots: mapped.timeSlots,
                                source: ttData.source,
                                fetchedAt: ttData.fetchedAt,
                                timesAreInferred: ttData.timesAreInferred || false,
                                periodDefinitions: ttData.timeSlots,
                            },
                        });
                    }
                }
            } catch (ttErr) {
                logger.warn('Timetable fetch failed (non-critical):', ttErr.message);
            }

            // Complete setup — go straight to the main app.
            dispatch({ type: 'COMPLETE_SETUP' });
        } catch (err) {
            logger.error('Setup import failed:', err);
            setError('Something went wrong during setup. Please try again.');
            setStep(STEP_THEME);
        }
    }, [mappingResult, studentName, state.userId, state.devDate, dispatch]); // CR-05 fix: removed `token` — tokenRef.current is used inside instead

    // ─── STEP INDICATOR ─────────────────────────────────────────────
    const stepIndex = [STEP_LOGIN, STEP_OTP, STEP_THEME].indexOf(step);
    const steps = ['Login', 'Verify', 'Theme'];

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
                <View style={styles.sectionMark}><View style={styles.sectionMarkDot} /></View>
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
                                {showPassword ? 'Hide' : 'Show'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            <View style={styles.securityBadge}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success, marginRight: SPACING.xs }} />
                <Text style={styles.securityText}>
                    Your login goes straight to your college portal. We store a secure token — never your raw password.
                </Text>
            </View>
        </View>
    );

    // ─── RENDER: OTP ────────────────────────────────────────────────
    const renderOtp = () => (
        <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
                <View style={styles.sectionMark}><View style={styles.sectionMarkDot} /></View>
                <Text style={styles.sectionTitle}>Enter OTP</Text>
                <Text style={styles.sectionSub}>
                    We've sent an OTP to the mobile number registered on your ERP.
                </Text>
            </View>

            <View style={styles.card}>
                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>OTP CODE</Text>
                    <TextInput
                        style={[styles.input, styles.otpInput]}
                        value={otp}
                        onChangeText={(t) => { setOtp(t.replace(/[^0-9]/g, '')); setError(''); }}
                        placeholder="• • • •"
                        placeholderTextColor={COLORS.textMuted}
                        keyboardType="number-pad"
                        maxLength={4}
                        autoFocus
                        editable={!loading}
                    />
                </View>
            </View>

            <View style={styles.otpActionsRow}>
                <TouchableOpacity
                    onPress={() => { setStep(STEP_LOGIN); setOtp(''); setError(''); }}
                >
                    <Text style={styles.backLinkText}>← Back to login</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={handleResendOtp}
                    disabled={resendCooldown > 0 || loading}
                >
                    <Text style={[styles.resendText, (resendCooldown > 0 || loading) && styles.resendTextDisabled]}>
                        {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                    </Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.otpHelp}>
                Didn't get it? Wait a moment, check your SMS, then resend.
            </Text>
        </View>
    );

    // ─── RENDER: THEME (final onboarding step, before entering the app) ──
    const renderTheme = () => {
        const activePalette = state?.settings?.uiPalette || 'chalkpad';
        return (
            <View style={styles.formSection}>
                <View style={styles.sectionHeader}>
                    <View style={styles.sectionMark}><View style={styles.sectionMarkDot} /></View>
                    <Text style={styles.sectionTitle}>Make it yours</Text>
                    <Text style={styles.sectionSub}>
                        {studentName ? `You're all set, ${studentName.split(' ')[0]}. ` : "You're all set. "}
                        Pick a theme to finish.
                    </Text>
                </View>

                <View style={styles.themeGrid}>
                    {ONBOARDING_PALETTES.map((id) => {
                        const palette = PALETTES[id];
                        if (!palette) return null;
                        const isActive = activePalette === id;
                        return (
                            <TouchableOpacity
                                key={id}
                                style={[styles.themeCard, isActive && styles.themeCardActive]}
                                onPress={() => dispatch({ type: 'UPDATE_SETTINGS', payload: { uiPalette: id } })}
                                activeOpacity={0.85}
                            >
                                <View style={styles.themeSwatches}>
                                    {palette.swatches.map((color, i) => (
                                        <View key={i} style={[styles.themeSwatch, { backgroundColor: color }]} />
                                    ))}
                                </View>
                                <Text style={[styles.themeName, isActive && styles.themeNameActive]} numberOfLines={1}>
                                    {palette.name}
                                </Text>
                                {isActive && (
                                    <View style={styles.themeCheck}>
                                        <Text style={styles.themeCheckText}>&#10003;</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <Text style={styles.themeHint}>You can change this anytime in Settings.</Text>
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
            case STEP_THEME:
                return {
                    text: `Enter Presence`,
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
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
                    {step === STEP_THEME && renderTheme()}
                    {step === STEP_IMPORTING && renderImporting()}

                    {/* Error */}
                    {error ? (
                        <View style={styles.errorBox}>
                            <Text style={styles.errorText}>{error}</Text>
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
const getStyles = () => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        paddingHorizontal: SPACING.lg,
        paddingBottom: 120, // clear the absolute-positioned bottom bar
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
    sectionMark: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.sm,
    },
    sectionMarkDot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: COLORS.primary,
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

    // Back link + resend
    otpActionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: SPACING.md,
        paddingHorizontal: SPACING.xs,
    },
    backLinkText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.primary,
        fontWeight: '600',
    },
    resendText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.primary,
        fontWeight: '600',
    },
    resendTextDisabled: {
        color: COLORS.textMuted,
    },
    otpHelp: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
        textAlign: 'center',
        marginTop: SPACING.md,
        lineHeight: 18,
    },

    // Theme grid (final onboarding step)
    themeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: SPACING.md,
    },
    themeCard: {
        width: '48.5%',
        backgroundColor: COLORS.cardBackground,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.sm + 2,
        ...SHADOWS.small,
    },
    themeCardActive: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.primaryLight,
    },
    themeSwatches: {
        flexDirection: 'row',
        height: 40,
        borderRadius: BORDER_RADIUS.sm,
        overflow: 'hidden',
        marginBottom: SPACING.sm,
    },
    themeSwatch: {
        flex: 1,
    },
    themeName: {
        ...TYPOGRAPHY.labelSmall,
        color: COLORS.textSecondary,
    },
    themeNameActive: {
        color: COLORS.primaryDark,
    },
    themeCheck: {
        position: 'absolute',
        top: SPACING.sm,
        right: SPACING.sm,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    themeCheckText: {
        color: COLORS.textOnPrimary || '#FFFFFF',
        fontSize: 11,
        fontWeight: '800',
    },
    themeHint: {
        ...TYPOGRAPHY.captionSmall,
        color: COLORS.textMuted,
        marginTop: SPACING.lg,
        textAlign: 'center',
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
