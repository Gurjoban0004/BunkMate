import React, { useState, useCallback, useEffect } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    Platform, KeyboardAvoidingView, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS, TYPOGRAPHY, PALETTES, MOTION } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import { erpLogin, erpVerifyOtp, erpFetchAttendance, erpFetchCalendar, erpFetchTimetable } from '../../services/erpService';
import { saveErpToken } from '../../storage/erpTokenStorage';
import { mapErpToAppState, mapCalendarToRecords, buildErpNameMap, mapTimetableToState } from '../../utils/erpAttendanceMapper';
import { getUserId } from '../../utils/firebaseHelpers';
import { getTodayKey } from '../../utils/dateHelpers';
import { logger } from '../../utils/logger';
import { friendlyError } from '../../utils/friendlyError';
import Notice from '../../components/common/Notice';
import LoadingDots from '../../components/common/LoadingDots';
import SetupProgress from '../../components/setup/SetupProgress';
import SetupIllustration from '../../components/setup/SetupIllustration';
import ImportProgress from '../../components/setup/ImportProgress';

const STEP_LOGIN = 'login';
const STEP_OTP = 'otp';
const STEP_THEME = 'theme';
const STEP_IMPORTING = 'importing';
const STEP_FAILED = 'failed';

const PROGRESS_STEPS = [STEP_LOGIN, STEP_OTP, STEP_THEME];

// Curated onboarding palettes — the final "pick a vibe" step before entering the app.
// The full picker (all palettes + light/dark) lives in Settings; this is intentionally short.
const ONBOARDING_PALETTES = ['chalkpad', 'nordic', 'forest', 'catppuccin'];

// Each row maps to one real request in handleImport, so the checklist can't
// claim progress that isn't happening.
const IMPORT_TASKS = [
    { id: 'subjects', label: 'Importing your subjects' },
    { id: 'calendar', label: 'Syncing attendance history' },
    { id: 'timetable', label: 'Building your timetable' },
];

// The subjects step is local state, so it completes instantly. A short settle
// lets the first row visibly tick over instead of strobing past.
const settle = (ms = 550) => new Promise((resolve) => setTimeout(resolve, ms));

export default function ERPSetupScreen({ navigation }) {
    const { state, dispatch } = useApp();
    const styles = getStyles();

    // Flow state
    const [step, setStep] = useState(STEP_LOGIN);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [importStep, setImportStep] = useState(0);

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

    // ─── STEP 1: SIGN IN ───────────────────────────────────────────
    const handleLogin = useCallback(async () => {
        if (!username.trim() || !password.trim()) {
            setError({ title: 'Two fields to go', message: 'Enter your university ID and password to continue.' });
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const result = await erpLogin(username.trim(), password);
            setAuthUserId(result.authUserId);
            setStep(STEP_OTP);
        } catch (err) {
            logger.warn('Sign-in failed:', err.message);
            setError(friendlyError(err, 'signin'));
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

    // Re-request a code by re-running the login call (throttled to every 30s)
    const handleResendOtp = useCallback(async () => {
        if (resendCooldown > 0 || loading) return;
        setError(null);
        try {
            const result = await erpLogin(username.trim(), password);
            setAuthUserId(result.authUserId);
            setResendCooldown(30);
        } catch (err) {
            logger.warn('Resend failed:', err.message);
            setError(friendlyError(err, 'signin'));
        }
    }, [username, password, resendCooldown, loading]);

    // ─── STEP 2: VERIFY ────────────────────────────────────────────
    const handleVerifyOtp = useCallback(async () => {
        if (!otp.trim() || otp.trim().length < 4) {
            setError({ title: 'Code looks short', message: 'Enter all four digits from the message.' });
            return;
        }
        setLoading(true);
        setError(null);
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
                setError({
                    title: 'No attendance yet',
                    message: attendanceResult.warning
                        || 'Your university has not published any attendance for this term. Try again once your first classes are marked.',
                });
                setLoading(false);
                return;
            }
            setErpSubjects(attendanceResult.subjects);
            const mapping = mapErpToAppState(attendanceResult.subjects, []);
            setMappingResult(mapping);
            setStep(STEP_THEME);
        } catch (err) {
            logger.warn('Verification failed:', err.message);
            setError(friendlyError(err, 'otp'));
        } finally {
            setLoading(false);
        }
    }, [otp, authUserId, username, password]);

    // ─── STEP 3: IMPORT & COMPLETE SETUP ────────────────────────────
    const handleImport = useCallback(async () => {
        if (!mappingResult) return;
        setError(null);
        setImportStep(0);
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

            await settle();
            setImportStep(1);

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

            setImportStep(2);

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

            setImportStep(IMPORT_TASKS.length);
            await settle(400);

            // Complete setup — go straight to the main app.
            dispatch({ type: 'COMPLETE_SETUP' });
        } catch (err) {
            logger.error('Setup import failed:', err);
            setError(friendlyError(err, 'import'));
            setStep(STEP_FAILED);
        }
    }, [mappingResult, studentName, username, state.userId, state.devDate, dispatch]); // CR-05 fix: removed `token` — tokenRef.current is used inside instead

    // ─── RENDER: SIGN IN ────────────────────────────────────────────
    const renderLogin = () => (
        <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
                <SetupIllustration name="signin" />
                <Text style={styles.sectionTitle}>Sign in</Text>
                <Text style={styles.sectionSub}>Use your university login.</Text>
            </View>

            <View style={styles.card}>
                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>USER ID</Text>
                    <TextInput
                        style={styles.input}
                        value={username}
                        onChangeText={(t) => { setUsername(t); setError(null); }}
                        placeholder="Your university ID"
                        placeholderTextColor={COLORS.textMuted}
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="username"
                        editable={!loading}
                        accessibilityLabel="University ID"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>PASSWORD</Text>
                    <View style={styles.passwordRow}>
                        <TextInput
                            style={[styles.input, { flex: 1 }]}
                            value={password}
                            onChangeText={(t) => { setPassword(t); setError(null); }}
                            placeholder="Your password"
                            placeholderTextColor={COLORS.textMuted}
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoComplete="password"
                            editable={!loading}
                            accessibilityLabel="Password"
                        />
                        <TouchableOpacity
                            style={styles.eyeButton}
                            onPress={() => setShowPassword(!showPassword)}
                            accessibilityRole="button"
                            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                        >
                            <Text style={styles.eyeIcon}>{showPassword ? 'Hide' : 'Show'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            <View style={styles.securityBadge}>
                <View style={styles.securityDot} />
                <Text style={styles.securityText}>
                    Your password is never stored.
                </Text>
            </View>
        </View>
    );

    // ─── RENDER: VERIFY ─────────────────────────────────────────────
    const renderOtp = () => (
        <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
                <SetupIllustration name="code" />
                <Text style={styles.sectionTitle}>Enter the code</Text>
                <Text style={styles.sectionSub}>Sent to your registered number.</Text>
            </View>

            <View style={styles.card}>
                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>OTP CODE</Text>
                    <TextInput
                        style={[styles.input, styles.otpInput]}
                        value={otp}
                        onChangeText={(t) => { setOtp(t.replace(/[^0-9]/g, '')); setError(null); }}
                        placeholder="• • • •"
                        placeholderTextColor={COLORS.textMuted}
                        keyboardType="number-pad"
                        textContentType="oneTimeCode"
                        autoComplete="sms-otp"
                        maxLength={4}
                        autoFocus
                        editable={!loading}
                        accessibilityLabel="Four digit verification code"
                    />
                </View>
            </View>

            <View style={styles.otpActionsRow}>
                <TouchableOpacity
                    onPress={() => { setStep(STEP_LOGIN); setOtp(''); setError(null); }}
                    accessibilityRole="button"
                    accessibilityLabel="Back to sign in"
                    style={styles.otpAction}
                >
                    <Text style={styles.backLinkText}>Back to sign in</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={handleResendOtp}
                    disabled={resendCooldown > 0 || loading}
                    accessibilityRole="button"
                    accessibilityLabel="Send a new code"
                    style={styles.otpAction}
                >
                    <Text style={[styles.resendText, (resendCooldown > 0 || loading) && styles.resendTextDisabled]}>
                        {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                    </Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.otpHelp}>Didn't get it? Check your SMS, then resend.</Text>
        </View>
    );

    // ─── RENDER: THEME (final onboarding step, before entering the app) ──
    const renderTheme = () => {
        const activePalette = state?.settings?.uiPalette || 'chalkpad';
        return (
            <View style={styles.formSection}>
                <View style={styles.sectionHeader}>
                    <SetupIllustration name="theme" />
                    <Text style={styles.sectionTitle}>Make it yours</Text>
                    <Text style={styles.sectionSub}>
                        {studentName ? `You're all set, ${studentName.split(' ')[0]}.` : "You're all set."}
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
                                activeOpacity={MOTION.pressOpacity}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: isActive }}
                                accessibilityLabel={palette.name}
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

    // ─── RENDER: SETUP COULD NOT FINISH ─────────────────────────────
    const renderFailed = () => (
        <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
                <SetupIllustration name="problem" />
                <Text style={styles.sectionTitle}>{error?.title || 'Setup did not finish'}</Text>
                <Text style={styles.sectionSub}>
                    {error?.message || 'Nothing was saved. You can pick up where you left off.'}
                </Text>
                {error?.detail && __DEV__ ? <Text style={styles.failedDetail}>{error.detail}</Text> : null}
            </View>
        </View>
    );

    // ─── BOTTOM BUTTON ──────────────────────────────────────────────
    const getButton = () => {
        switch (step) {
            case STEP_LOGIN:
                return {
                    text: 'Continue',
                    onPress: handleLogin,
                    disabled: loading || !username.trim() || !password.trim(),
                };
            case STEP_OTP:
                return {
                    text: 'Verify',
                    onPress: handleVerifyOtp,
                    disabled: loading || otp.trim().length < 4,
                };
            case STEP_THEME:
                return { text: 'Enter Presence', onPress: handleImport, disabled: false };
            case STEP_FAILED:
                return { text: 'Try again', onPress: handleImport, disabled: false };
            default:
                return null;
        }
    };

    const button = getButton();
    const progressIndex = PROGRESS_STEPS.indexOf(step);
    const showChrome = step !== STEP_IMPORTING;

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
                    {showChrome && (
                        <View style={styles.topBar}>
                            <TouchableOpacity
                                onPress={() => {
                                    if (step === STEP_OTP) { setStep(STEP_LOGIN); setOtp(''); setError(null); }
                                    else if (step === STEP_FAILED) { setStep(STEP_THEME); setError(null); }
                                    else navigation.goBack();
                                }}
                                style={styles.topBarBack}
                                accessibilityRole="button"
                                accessibilityLabel="Go back"
                            >
                                <Text style={styles.topBarBackText}>←</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {progressIndex >= 0 && (
                        <SetupProgress
                            steps={PROGRESS_STEPS.length}
                            current={progressIndex}
                            style={styles.progress}
                        />
                    )}

                    {step === STEP_LOGIN && renderLogin()}
                    {step === STEP_OTP && renderOtp()}
                    {step === STEP_THEME && renderTheme()}
                    {step === STEP_FAILED && renderFailed()}
                    {step === STEP_IMPORTING && (
                        <ImportProgress tasks={IMPORT_TASKS} current={importStep} name={studentName} />
                    )}

                    {error && step !== STEP_FAILED ? (
                        <Notice
                            tone="caution"
                            title={error.title}
                            message={error.message}
                            detail={error.detail}
                            style={styles.notice}
                        />
                    ) : null}

                    <View style={{ height: 120 }} />
                </ScrollView>
            </KeyboardAvoidingView>

            {button && (
                <View style={styles.bottomBar}>
                    <TouchableOpacity
                        // Stays primary while working — a greyed-out button reads
                        // as "off", not "busy", and the dots need the contrast.
                        style={[styles.actionButton, button.disabled && !loading && styles.actionButtonDisabled]}
                        onPress={button.onPress}
                        activeOpacity={MOTION.pressOpacity}
                        disabled={button.disabled}
                        accessibilityRole="button"
                        accessibilityLabel={button.text}
                        accessibilityState={{ disabled: button.disabled, busy: loading }}
                    >
                        {loading ? (
                            <LoadingDots color={COLORS.textOnPrimary} />
                        ) : (
                            <Text style={[styles.actionButtonText, button.disabled && styles.actionButtonTextDisabled]}>
                                {button.text}
                            </Text>
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

    // Top bar — back only. The step heading below says where you are, so a
    // title here would just repeat it.
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        marginLeft: -SPACING.sm,
    },
    topBarBack: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    topBarBackText: {
        fontSize: 24,
        color: COLORS.textPrimary,
        fontWeight: '500',
    },
    progress: {
        marginTop: SPACING.xs,
        marginBottom: SPACING.xl,
    },

    // Section
    formSection: {},
    sectionHeader: {
        alignItems: 'center',
        marginBottom: SPACING.lg,
    },
    sectionTitle: {
        ...TYPOGRAPHY.headingLarge,
        fontSize: FONT_SIZES.xl,
        color: COLORS.textPrimary,
        marginBottom: 4,
    },
    sectionSub: {
        ...TYPOGRAPHY.bodyMedium,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: SPACING.sm,
    },

    // Card
    card: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: SPACING.md,
    },
    inputGroup: {},
    inputLabel: {
        fontWeight: '700',
        fontSize: 10,
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 6,
    },
    input: {
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.sm,
        paddingHorizontal: SPACING.md,
        paddingVertical: Platform.OS === 'ios' ? 14 : 12,
        fontWeight: '500',
        fontSize: FONT_SIZES.md,
        color: COLORS.textPrimary,
        ...Platform.select({ web: { outlineStyle: 'none' } }),
    },
    otpInput: {
        textAlign: 'center',
        fontWeight: '700',
        fontSize: FONT_SIZES.xl,
        letterSpacing: 8,
    },
    passwordRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    eyeButton: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.sm,
        minHeight: 44,
        justifyContent: 'center',
    },
    eyeIcon: {
        ...TYPOGRAPHY.labelSmall,
        color: COLORS.primaryDark,
    },

    securityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: SPACING.md,
        gap: SPACING.xs,
    },
    securityDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.success,
    },
    securityText: {
        ...TYPOGRAPHY.bodySmall,
        color: COLORS.textMuted,
    },

    // Back link + resend
    otpActionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: SPACING.sm,
        paddingHorizontal: SPACING.xs,
    },
    otpHelp: {
        ...TYPOGRAPHY.bodySmall,
        color: COLORS.textMuted,
        textAlign: 'center',
        marginTop: SPACING.sm,
    },
    otpAction: {
        minHeight: 44,
        justifyContent: 'center',
    },
    backLinkText: {
        ...TYPOGRAPHY.labelMedium,
        color: COLORS.textSecondary,
    },
    resendText: {
        ...TYPOGRAPHY.labelMedium,
        color: COLORS.primaryDark,
    },
    resendTextDisabled: {
        color: COLORS.textMuted,
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
    },
    themeCardActive: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.primaryLight,
    },
    themeSwatches: {
        flexDirection: 'row',
        height: 44,
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
        color: COLORS.textOnPrimary,
        fontSize: 11,
        fontWeight: '700',
    },
    themeHint: {
        ...TYPOGRAPHY.captionMedium,
        color: COLORS.textMuted,
        marginTop: SPACING.lg,
        textAlign: 'center',
    },

    // Setup failed
    failedDetail: {
        ...TYPOGRAPHY.captionSmall,
        color: COLORS.textMuted,
        marginTop: SPACING.md,
    },

    notice: {
        marginTop: SPACING.lg,
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
        minHeight: 52,
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.medium,
    },
    actionButtonDisabled: {
        backgroundColor: COLORS.inputBackground,
        // Palette backgrounds sit close to inputBackground, so without a border
        // the disabled button dissolves into the page instead of reading as a
        // control that isn't ready yet.
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowOpacity: 0,
        elevation: 0,
    },
    actionButtonText: {
        ...TYPOGRAPHY.labelLarge,
        color: COLORS.textOnPrimary,
    },
    actionButtonTextDisabled: {
        color: COLORS.textMuted,
    },
});
