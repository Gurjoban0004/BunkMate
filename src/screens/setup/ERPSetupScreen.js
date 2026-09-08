import React, { useState, useCallback, useEffect } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    Platform, KeyboardAvoidingView, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS, TYPOGRAPHY, PALETTES, MOTION, PAPER } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import { erpLogin, erpVerifyOtp, erpFetchAttendance, erpFetchCalendar, erpFetchTimetable } from '../../services/erpService';
import { saveErpToken } from '../../storage/erpTokenStorage';
import { mapErpToAppState, mapCalendarToRecords, buildErpNameMap, mapTimetableToState } from '../../utils/erpAttendanceMapper';
import { registerUser } from '../../utils/firebaseHelpers';
import { getTodayKey } from '../../utils/dateHelpers';
import { logger } from '../../utils/logger';
import { friendlyError } from '../../utils/friendlyError';
import Notice from '../../components/common/Notice';
import LoadingDots from '../../components/common/LoadingDots';
import SetupProgress from '../../components/setup/SetupProgress';
import SetupIllustration from '../../components/setup/SetupIllustration';
import OtpField from '../../components/setup/OtpField';
import ImportProgress from '../../components/setup/ImportProgress';
import BrandMark from '../../components/common/BrandMark';
import PaperWash from '../../components/common/PaperWash';
import LegalSheet from '../../components/common/LegalSheet';

const STEP_LOGIN = 'login';
const STEP_OTP = 'otp';
const STEP_THEME = 'theme';
const STEP_IMPORTING = 'importing';
const STEP_FAILED = 'failed';

const PROGRESS_STEPS = [STEP_LOGIN, STEP_OTP, STEP_THEME];

// The final "pick a vibe" step. This used to be a hand-picked subset, which is
// how Chalkpad Classic ended up in Settings but not here — two lists, one of
// them always stale. It is now every palette there is, in one order.
const ONBOARDING_PALETTES = Object.keys(PALETTES);

// One row per thing handleImport actually applies. The requests behind rows 2
// and 3 now finish during the theme step, so these tick over work that is
// already in hand — the checklist still never claims progress that isn't real.
const IMPORT_TASKS = [
    { id: 'subjects', label: 'Importing our subjects' },
    { id: 'calendar', label: 'Syncing attendance history' },
    { id: 'timetable', label: 'Building our timetable' },
];

// Every import step is local state or an already-resolved prefetch, so the
// checklist would strobe past unread. One short beat per row, and no more —
// this used to be 950ms of pure theatre on top of three live network calls.
const settle = (ms = 160) => new Promise((resolve) => setTimeout(resolve, ms));

export default function ERPSetupScreen({ navigation }) {
    const { state, dispatch } = useApp();
    const styles = getStyles();

    // Flow state
    const [step, setStep] = useState(STEP_LOGIN);
    // Which legal document the student has opened, if any.
    const [legalDoc, setLegalDoc] = useState(null);
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
    // The college's own masked destination ("email address gur****@…"). Shown
    // verbatim: this ERP mails the code — it never texts it — and "check your
    // SMS" sent people hunting through the wrong inbox until they gave up.
    const [otpHint, setOtpHint] = useState('');

    // Data
    const [token, setToken] = useState('');
    const tokenRef = React.useRef(''); // BUG-06 fix: ref avoids stale closure
    const persistentRef = React.useRef(null);
    const [studentName, setStudentName] = useState('');
    const [mappingResult, setMappingResult] = useState(null);
    // Filled in the moment the session lands, so the theme step is the only wait.
    const calendarRef = React.useRef(null);   // register calendar, from the attendance answer
    const timetableRef = React.useRef(null);  // in-flight timetable request

    // ─── STEP 1: SIGN IN ───────────────────────────────────────────
    // Shared tail of both the trusted-login and OTP-verify paths: persist the
    // token, pull the attendance preview, and advance to the theme step.
    const finishWithSession = useCallback(async (sessionResult) => {
        setToken(sessionResult.token);
        tokenRef.current = sessionResult.token;
        persistentRef.current = sessionResult.persistentToken || null;
        setStudentName(sessionResult.studentName || '');
        // The server decided whether this roll is an admin; the app just remembers it.
        dispatch({ type: 'UPDATE_SETTINGS', payload: { isAdmin: !!sessionResult.isAdmin } });
        await saveErpToken(sessionResult.token, sessionResult.studentName || '', sessionResult.persistentToken);

        // The timetable is a different portal page and needs nothing from the
        // register, so it goes out now and lands while the student picks a theme.
        // Rejections are folded to null here rather than left for handleImport:
        // nothing awaits this for several seconds, and a missing timetable has
        // never been worth failing setup over.
        timetableRef.current = erpFetchTimetable(sessionResult.token, sessionResult.persistentToken)
            .then((data) => data, () => null);

        const attendanceResult = await erpFetchAttendance(sessionResult.token, sessionResult.persistentToken);
        if (!attendanceResult.subjects || attendanceResult.subjects.length === 0) {
            setError({
                title: 'No attendance yet',
                message: attendanceResult.warning
                    || 'Our college has not recorded any attendance for this term yet. Try again once your first classes are marked.',
            });
            return;
        }
        // The register the totals came from IS the calendar. Keeping it here is what
        // removes the /api/erp-calendar round trip from onboarding entirely.
        calendarRef.current = attendanceResult.calendar
            ? {
                calendar: attendanceResult.calendar,
                subjects: attendanceResult.registerSubjects,
                latestDate: attendanceResult.latestDate,
            }
            : null;
        const mapping = mapErpToAppState(attendanceResult.subjects, []);
        setMappingResult(mapping);
        setStep(STEP_THEME);
    }, [dispatch]);

    const handleLogin = useCallback(async () => {
        if (!username.trim() || !password.trim()) {
            setError({ title: 'Two fields to go', message: 'Enter your ID and password to continue.' });
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const result = await erpLogin(username.trim(), password);
            // Trusted device: the ERP returned a full session and sent NO OTP.
            // Skip the OTP screen and finish with the token directly.
            if (result.trusted && result.token) {
                await finishWithSession(result);
                return;
            }
            setAuthUserId(result.authUserId);
            setOtpHint(result.otpHint || '');
            setStep(STEP_OTP);
        } catch (err) {
            logger.warn('Sign-in failed:', err.message);
            setError(friendlyError(err, 'signin'));
        } finally {
            setLoading(false);
        }
    }, [username, password, finishWithSession]);

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
            setOtpHint(result.otpHint || '');
            setResendCooldown(30);
        } catch (err) {
            logger.warn('Resend failed:', err.message);
            setError(friendlyError(err, 'signin'));
        }
    }, [username, password, resendCooldown, loading]);

    // ─── STEP 2: VERIFY ────────────────────────────────────────────
    const handleVerifyOtp = useCallback(async () => {
        if (!otp.trim() || otp.trim().length < 4) {
            setError({ title: 'Code looks short', message: 'Enter the whole code from the message.' });
            return;
        }
        setLoading(true);
        setError(null);
        try {
            // The ticket already carries username, password and device id.
            const otpResult = await erpVerifyOtp(authUserId, otp.trim());
            await finishWithSession(otpResult);
        } catch (err) {
            logger.warn('Verification failed:', err.message);
            setError(friendlyError(err, 'otp'));
        } finally {
            setLoading(false);
        }
    }, [otp, authUserId, finishWithSession]);

    // ─── STEP 3: IMPORT & COMPLETE SETUP ────────────────────────────
    const handleImport = useCallback(async () => {
        if (!mappingResult) return;
        setError(null);
        setImportStep(0);
        setStep(STEP_IMPORTING);

        try {
            // The roll number the student just signed in with IS the account id.
            const userId = await registerUser(username.trim()) || state.userId;
            if (userId && userId !== state.userId) {
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
                payload: { setupDate: todayStr, trackingStartDate: todayStr },
            });

            await settle();
            setImportStep(1);

            // The calendar normally arrived with the attendance answer; only the
            // summary-card fallback still needs a request of its own.
            try {
                const currentToken = tokenRef.current; // BUG-06 fix: use ref
                if (calendarRef.current || currentToken) {
                    const calData = calendarRef.current
                        || await erpFetchCalendar(currentToken, persistentRef.current);
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
                // Started when the session landed, so this is normally an await on
                // a promise that resolved while the theme step was on screen.
                const ttData = await timetableRef.current;
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
                <View style={styles.brandPill}><BrandMark size={56} /></View>
                <Text style={styles.brandName}>Presence</Text>
                <Text style={styles.sectionSub}>
                    Use the same roll number and password you use for Chalkpad — our college's portal.
                </Text>
            </View>

            <View style={styles.card}>
                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>ROLL NUMBER</Text>
                    <TextInput
                        style={styles.input}
                        value={username}
                        onChangeText={(t) => { setUsername(t); setError(null); }}
                        placeholder="e.g. 2410990296"
                        placeholderTextColor={COLORS.textMuted}
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="username"
                        editable={!loading}
                        accessibilityLabel="Roll number"
                    />
                    <Text style={styles.inputHint}>Not our email — the number our college knows us by.</Text>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>CHALKPAD PASSWORD</Text>
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
                <Text style={styles.sectionSub}>
                    {otpHint ? `Our college emailed it to your ${otpHint}.` : 'Our college emailed it to the address on your college account.'}
                </Text>
            </View>

            <View style={styles.card}>
                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>VERIFICATION CODE</Text>
                    <OtpField value={otp} onChange={(t) => { setOtp(t); setError(null); }} editable={!loading} />
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

            <Text style={styles.otpHelp}>Didn't get it? Check spam, then resend.</Text>
        </View>
    );

    // ─── RENDER: THEME (final onboarding step, before entering the app) ──
    const renderTheme = () => {
        const activePalette = state?.settings?.uiPalette || 'paper';
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

    // The back control is rendered only where it actually goes somewhere. Sign-in
    // is the entry screen now, and once a session exists there is nothing behind
    // the theme step either — an arrow that does nothing reads as a frozen app.
    const backAction = step === STEP_OTP
        ? () => { setStep(STEP_LOGIN); setOtp(''); setError(null); }
        : step === STEP_FAILED
            ? () => { setStep(STEP_THEME); setError(null); }
            : step === STEP_LOGIN && navigation.canGoBack?.()
                ? () => navigation.goBack()
                : null;

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            {/* Setup happens on the same sheet of paper as Today — literally the
                same drawing (components/common/PaperWash), so the first screen a
                student sees is not a different app from the one they keep. The
                ring is off: it belongs to a header band, not a full page. */}
            <PaperWash style={StyleSheet.absoluteFill} ring={false} pointerEvents="none" />
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {backAction && (
                        <View style={styles.topBar}>
                            <TouchableOpacity
                                onPress={backAction}
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
                    {/* The acceptance sits on the button that performs the act,
                        so "by tapping Enter Presence" is literally true. */}
                    {step === STEP_THEME && (
                        <Text style={styles.legalLine}>
                            By tapping Enter Presence you agree to our{' '}
                            <Text style={styles.legalLink} onPress={() => setLegalDoc('terms')} accessibilityRole="link">
                                Terms of Use
                            </Text>
                            {' and '}
                            <Text style={styles.legalLink} onPress={() => setLegalDoc('privacy')} accessibilityRole="link">
                                Privacy Policy
                            </Text>
                            .
                        </Text>
                    )}
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

            <LegalSheet doc={legalDoc} onClose={() => setLegalDoc(null)} />
        </SafeAreaView>
    );
}

// ─── STYLES ─────────────────────────────────────────────────────────
const getStyles = () => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: PAPER.paperBase,   // the wash paints over this
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
    brandPill: {
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: SPACING.md,
        ...SHADOWS.medium,
    },
    brandName: {
        fontWeight: '700',
        fontSize: 30,
        lineHeight: 34,
        letterSpacing: -0.5,
        color: COLORS.textPrimary,
        marginBottom: 6,
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
    inputHint: {
        ...TYPOGRAPHY.captionMedium,
        color: COLORS.textMuted,
        marginTop: 6,
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
    legalLine: {
        ...TYPOGRAPHY.captionMedium,
        color: COLORS.textMuted,
        textAlign: 'center',
        lineHeight: 16,
        marginBottom: SPACING.sm,
    },
    legalLink: { color: COLORS.primary, textDecorationLine: 'underline' },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: SPACING.lg,
        // Sits on the wash, so it takes the schedule card's near-white rather
        // than an opaque theme background that would read as a seam.
        backgroundColor: COLORS.cardBackground,
        borderTopWidth: 1,
        borderTopColor: PAPER.line,
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
