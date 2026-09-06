import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import { formatRelativeTime } from '../../utils/dateHelpers';
import { useBannerSlot, BANNER_PRIORITY } from './BannerSlot';

/**
 * The quiet version of "session expired". Sits at the top of Today until the
 * student signs in again; nothing is sent until they tap it.
 */
export default function ReconnectCard() {
    const { state, dispatch } = useApp();
    const wants = !!state.erpSessionExpired && !!state.settings?.erpConnected;
    const mayRender = useBannerSlot(BANNER_PRIORITY.reconnect, wants);
    if (!mayRender) return null;

    const lastSync = state.erpSync?.lastGlobalSyncAt || state.settings?.lastErpSync;

    return (
        <TouchableOpacity
            style={styles.card}
            onPress={() => dispatch({ type: 'ERP_RECONNECT_OPEN' })}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Sign in again to keep syncing"
        >
            <View style={styles.text}>
                <Text style={styles.title}>Sign in again to keep syncing</Text>
                <Text style={styles.body}>
                    Your college signed this app out.
                    {lastSync ? ` Your numbers are from ${formatRelativeTime(lastSync)}.` : ''}
                </Text>
            </View>
            <View style={styles.button}>
                <Text style={styles.buttonText}>Sign in</Text>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
        backgroundColor: COLORS.primaryLight,
        borderWidth: 1,
        borderColor: COLORS.primary,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        marginHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.cardGap,
    },
    text: { flex: 1 },
    title: { ...TYPOGRAPHY.labelMedium, color: COLORS.textPrimary, marginBottom: 2 },
    body: { ...TYPOGRAPHY.captionMedium, color: COLORS.textSecondary },
    button: {
        backgroundColor: COLORS.primary,
        paddingVertical: 8,
        paddingHorizontal: SPACING.md,
        borderRadius: BORDER_RADIUS.sm,
    },
    buttonText: { ...TYPOGRAPHY.labelMedium, color: COLORS.textOnPrimary },
});
