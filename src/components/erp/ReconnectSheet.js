/**
 * ReconnectSheet — "Sign in again", on the student's terms.
 *
 * Opens only when the student taps the Sign-in card (Today) or the row in
 * Settings; never on its own. Two steps:
 *   1. "Send code"  → /api/erp-session requestOtp. A trusted device gets fresh
 *                     tokens straight back and the sheet closes. Otherwise the
 *                     college sends a code and step 2 appears.
 *   2. Enter code   → refresh → tokens saved → sync.
 * "Not now" closes the sheet; the card stays until they are back in.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
    Modal, View, Text, TextInput, TouchableOpacity, ActivityIndicator,
    StyleSheet, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useApp } from '../../context/AppContext';
import { erpRequestOtp, erpRefreshSession } from '../../services/erpService';
import { updateErpToken, clearErpToken, getErpPersistentToken } from '../../storage/erpTokenStorage';
import { COLORS, SPACING, FONT_SIZES, RADIUS, SHADOWS, TYPOGRAPHY } from '../../theme/theme';
import { logger } from '../../utils/logger';
import { friendlyError } from '../../utils/friendlyError';

export default function ReconnectSheet() {
    const { state, dispatch, triggerErpSync } = useApp();
    const visible = !!state.erpReconnectOpen;

    const [stage, setStage] = useState('intro');   // 'intro' | 'otp'
    const [ticket, setTicket] = useState('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!visible) { setStage('intro'); setTicket(''); setOtp(''); setError(''); setLoading(false); }
    }, [visible]);

    const close = useCallback(() => dispatch({ type: 'ERP_RECONNECT_CLOSE' }), [dispatch]);

    // The saved sign-in is gone for good: forget it and send them to Settings.
    const giveUpToSettings = useCallback(async () => {
        await clearErpToken();
        dispatch({ type: 'UPDATE_SETTINGS', payload: { erpConnected: false } });
        dispatch({ type: 'ERP_SESSION_RESTORED' });
    }, [dispatch]);

    const finish = useCallback(async (result) => {
        await updateErpToken(result.token, result.persistentToken || null);
        if (typeof result.isAdmin === 'boolean') {
            dispatch({ type: 'UPDATE_SETTINGS', payload: { isAdmin: result.isAdmin } });
        }
        dispatch({ type: 'ERP_SESSION_RESTORED' });
        setTimeout(() => triggerErpSync?.(true), 300);
        logger.info('✅', 'Signed in again');
    }, [dispatch, triggerErpSync]);

    const handleSendCode = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const persistentToken = await getErpPersistentToken();
            if (!persistentToken) { await giveUpToSettings(); return; }
            const result = await erpRequestOtp(persistentToken);
            if (result.trusted && result.token) { await finish(result); return; }
            setTicket(result.authUserId);
            setStage('otp');
        } catch (err) {
            if (err.data?.needsLogin) { await giveUpToSettings(); return; }
            setError(friendlyError(err, 'signin').message);
            logger.warn('⚠️ requestOtp failed:', err.message);
        } finally {
            setLoading(false);
        }
    }, [finish, giveUpToSettings]);

    const handleVerify = useCallback(async () => {
        const code = otp.trim();
        if (code.length < 4) { setError('Enter the whole code.'); return; }
        setLoading(true);
        setError('');
        try {
            const persistentToken = await getErpPersistentToken();
            if (!persistentToken) { await giveUpToSettings(); return; }
            const result = await erpRefreshSession(persistentToken, ticket, code);
            await finish(result);
        } catch (err) {
            if (err.data?.needsLogin) { await giveUpToSettings(); return; }
            setError(err.status === 401 ? (err.message || 'That code did not work.') : friendlyError(err, 'otp').message);
            logger.warn('⚠️ refresh failed:', err.message);
        } finally {
            setLoading(false);
        }
    }, [otp, ticket, finish, giveUpToSettings]);

    if (!visible) return null;

    const isOtp = stage === 'otp';
    const primaryDisabled = loading || (isOtp && otp.trim().length < 4);

    return (
        <Modal visible transparent animationType="fade" onRequestClose={close}>
            <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={styles.sheet}>
                    <View style={styles.grabber} />
                    <Text style={styles.title}>{isOtp ? 'Enter the code' : 'Sign in again'}</Text>
                    <Text style={styles.subtitle}>
                        {isOtp
                            ? 'Your college just sent a code to your registered number.'
                            : 'Your college signed this app out. Tap below and it will send you a code — the same as when you first set up.'}
                    </Text>

                    {isOtp && (
                        <View style={styles.inputWrapper}>
                            <TextInput
                                style={[styles.input, error ? styles.inputError : null]}
                                value={otp}
                                onChangeText={(t) => { setOtp(t.replace(/[^0-9]/g, '')); setError(''); }}
                                placeholder="• • • •"
                                placeholderTextColor={COLORS.textMuted}
                                keyboardType="number-pad"
                                textContentType="oneTimeCode"
                                autoComplete="sms-otp"
                                maxLength={6}
                                autoFocus
                                editable={!loading}
                                returnKeyType="done"
                                onSubmitEditing={handleVerify}
                                accessibilityLabel="Verification code"
                            />
                        </View>
                    )}

                    {!!error && <Text style={styles.errorText}>{error}</Text>}

                    <TouchableOpacity
                        style={[styles.primaryBtn, primaryDisabled && !loading && styles.primaryBtnDisabled]}
                        onPress={isOtp ? handleVerify : handleSendCode}
                        disabled={primaryDisabled}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel={isOtp ? 'Verify code' : 'Send code'}
                    >
                        {loading
                            ? <ActivityIndicator color={COLORS.textOnPrimary} size="small" />
                            : <Text style={[styles.primaryBtnText, primaryDisabled && styles.primaryBtnTextDisabled]}>
                                {isOtp ? 'Verify' : 'Send code'}
                            </Text>}
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.secondaryBtn} onPress={isOtp ? handleSendCode : close} disabled={loading}>
                        <Text style={styles.secondaryBtnText}>{isOtp ? 'Send a new code' : 'Not now'}</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: COLORS.cardBackground,
        borderTopLeftRadius: RADIUS.xxl,
        borderTopRightRadius: RADIUS.xxl,
        paddingHorizontal: SPACING.lg,
        paddingTop: SPACING.sm,
        paddingBottom: SPACING.xxl,
        alignItems: 'center',
        ...SHADOWS.large,
    },
    grabber: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.border, marginBottom: SPACING.lg },
    title: { ...TYPOGRAPHY.headingLarge, color: COLORS.textPrimary, marginBottom: SPACING.xs, textAlign: 'center' },
    subtitle: {
        ...TYPOGRAPHY.bodyMedium, color: COLORS.textSecondary, textAlign: 'center',
        marginBottom: SPACING.lg, paddingHorizontal: SPACING.sm,
    },
    inputWrapper: { width: '100%', marginBottom: SPACING.md },
    input: {
        backgroundColor: COLORS.inputBackground,
        borderRadius: RADIUS.md,
        paddingHorizontal: SPACING.md,
        paddingVertical: Platform.OS === 'ios' ? 14 : 12,
        fontWeight: '700',
        fontSize: FONT_SIZES.xxl,
        color: COLORS.textPrimary,
        textAlign: 'center',
        letterSpacing: 8,
        borderWidth: 1,
        borderColor: 'transparent',
        ...Platform.select({ web: { outlineStyle: 'none' } }),
    },
    inputError: { borderColor: COLORS.danger },
    errorText: { ...TYPOGRAPHY.captionMedium, color: COLORS.dangerText, marginBottom: SPACING.sm, textAlign: 'center' },
    primaryBtn: {
        width: '100%', backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
        minHeight: 52, alignItems: 'center', justifyContent: 'center', ...SHADOWS.medium,
    },
    primaryBtnDisabled: { backgroundColor: COLORS.inputBackground, borderWidth: 1, borderColor: COLORS.border, shadowOpacity: 0, elevation: 0 },
    primaryBtnText: { ...TYPOGRAPHY.labelLarge, color: COLORS.textOnPrimary },
    primaryBtnTextDisabled: { color: COLORS.textMuted },
    secondaryBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: SPACING.lg, marginTop: SPACING.xs },
    secondaryBtnText: { ...TYPOGRAPHY.labelMedium, color: COLORS.textMuted },
});
