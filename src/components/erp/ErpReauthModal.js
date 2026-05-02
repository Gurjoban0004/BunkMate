/**
 * ErpReauthModal
 *
 * Shown automatically when the ERP session expires mid-sync.
 * The sync hook dispatches ERP_SESSION_EXPIRED with { authUserId, studentName, persistentToken }.
 * This modal watches state.erpSessionExpired and presents an OTP input.
 *
 * On success:
 *   1. Calls erpRefreshSession (server verifies OTP, returns new tokens)
 *   2. Saves new tokens to storage
 *   3. Dispatches ERP_SESSION_RESTORED to clear the modal
 *   4. Triggers a fresh sync
 */

import React, { useState, useCallback } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    Platform,
    KeyboardAvoidingView,
} from 'react-native';
import { useApp } from '../../context/AppContext';
import { erpRefreshSession } from '../../services/erpService';
import { updateErpToken } from '../../storage/erpTokenStorage';
import { COLORS, SPACING, FONT_SIZES, RADIUS, SHADOWS } from '../../theme/theme';
import { logger } from '../../utils/logger';

export default function ErpReauthModal() {
    const { state, dispatch, triggerErpSync } = useApp();
    const expired = state.erpSessionExpired; // { authUserId, studentName, persistentToken } | null

    const [otp, setOtp]         = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState('');

    const isVisible = !!expired;

    const handleDismiss = useCallback(() => {
        // User chose to skip — clear the pending state so the modal goes away.
        // The next sync attempt will re-trigger it if the session is still dead.
        dispatch({ type: 'ERP_SESSION_RESTORED' });
        setOtp('');
        setError('');
    }, [dispatch]);

    const handleVerify = useCallback(async () => {
        if (!otp.trim() || otp.trim().length < 4) {
            setError('Please enter a valid OTP');
            return;
        }
        if (!expired?.persistentToken || !expired?.authUserId) {
            setError('Session data missing. Please reconnect ERP from Settings.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const result = await erpRefreshSession(
                expired.persistentToken,
                expired.authUserId,
                otp.trim(),
            );

            // Save the refreshed tokens
            await updateErpToken(result.token, result.persistentToken || null);

            // Clear the modal
            dispatch({ type: 'ERP_SESSION_RESTORED' });
            setOtp('');

            // Kick off a fresh sync now that the session is live
            if (triggerErpSync) {
                setTimeout(() => triggerErpSync(true), 300);
            }

            logger.info('✅', 'ERP session refreshed via re-auth modal');
        } catch (err) {
            if (err.status === 401) {
                setError('Incorrect OTP. Please try again.');
            } else {
                setError(err.message || 'Verification failed. Please try again.');
            }
            logger.warn('⚠️ ERP re-auth failed:', err.message);
        } finally {
            setLoading(false);
        }
    }, [otp, expired, dispatch, triggerErpSync]);

    // Nothing to show
    if (!isVisible) return null;

    const studentLabel = expired?.studentName ? `for ${expired.studentName}` : '';

    return (
        <Modal
            visible={isVisible}
            transparent
            animationType="fade"
            onRequestClose={handleDismiss}
        >
            <KeyboardAvoidingView
                style={styles.overlay}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.sheet}>
                    {/* Header */}
                    <Text style={styles.emoji}>🔑</Text>
                    <Text style={styles.title}>Session Expired</Text>
                    <Text style={styles.subtitle}>
                        Your ERP session has expired{studentLabel ? ` ${studentLabel}` : ''}.{'\n'}
                        Enter the OTP sent to your registered number to continue syncing.
                    </Text>

                    {/* OTP input */}
                    <View style={styles.inputWrapper}>
                        <Text style={styles.inputLabel}>OTP CODE</Text>
                        <TextInput
                            style={[styles.input, error ? styles.inputError : null]}
                            value={otp}
                            onChangeText={(t) => { setOtp(t.replace(/[^0-9]/g, '')); setError(''); }}
                            placeholder="• • • • • •"
                            placeholderTextColor={COLORS.textMuted}
                            keyboardType="number-pad"
                            maxLength={6}
                            autoFocus
                            editable={!loading}
                            returnKeyType="done"
                            onSubmitEditing={handleVerify}
                        />
                        {!!error && <Text style={styles.errorText}>{error}</Text>}
                    </View>

                    {/* Actions */}
                    <TouchableOpacity
                        style={[styles.primaryBtn, (loading || otp.trim().length < 4) && styles.primaryBtnDisabled]}
                        onPress={handleVerify}
                        disabled={loading || otp.trim().length < 4}
                        activeOpacity={0.8}
                    >
                        {loading
                            ? <ActivityIndicator color="#fff" size="small" />
                            : <Text style={styles.primaryBtnText}>Verify & Resume Sync</Text>
                        }
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.skipBtn}
                        onPress={handleDismiss}
                        disabled={loading}
                    >
                        <Text style={styles.skipBtnText}>Skip for now</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: COLORS.overlay,
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: COLORS.cardBackground,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: SPACING.lg,
        paddingTop: SPACING.xl,
        paddingBottom: SPACING.xxl,
        alignItems: 'center',
        ...SHADOWS.large,
    },
    emoji: {
        fontSize: 40,
        marginBottom: SPACING.sm,
    },
    title: {
        fontSize: FONT_SIZES.xl,
        fontWeight: '800',
        color: COLORS.textPrimary,
        marginBottom: SPACING.xs,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: SPACING.xl,
        paddingHorizontal: SPACING.sm,
    },
    inputWrapper: {
        width: '100%',
        marginBottom: SPACING.lg,
    },
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
        borderRadius: RADIUS.md,
        paddingHorizontal: SPACING.md,
        paddingVertical: Platform.OS === 'ios' ? 14 : 12,
        fontSize: FONT_SIZES.xl,
        fontWeight: '700',
        color: COLORS.textPrimary,
        textAlign: 'center',
        letterSpacing: 8,
        borderWidth: 1,
        borderColor: 'transparent',
        ...Platform.select({ web: { outlineStyle: 'none' } }),
    },
    inputError: {
        borderColor: COLORS.danger,
    },
    errorText: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.danger,
        marginTop: SPACING.xs,
        textAlign: 'center',
    },
    primaryBtn: {
        width: '100%',
        backgroundColor: COLORS.primary,
        borderRadius: RADIUS.md,
        paddingVertical: SPACING.md + 2,
        alignItems: 'center',
        marginBottom: SPACING.sm,
        ...SHADOWS.medium,
    },
    primaryBtnDisabled: {
        backgroundColor: COLORS.inputBackground,
    },
    primaryBtnText: {
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    skipBtn: {
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.lg,
    },
    skipBtnText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textMuted,
        fontWeight: '600',
    },
});
