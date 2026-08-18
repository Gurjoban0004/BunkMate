import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../../theme/theme';

/**
 * Notice — a calm inline message.
 *
 * Deliberately NOT an alert box. Setup problems are usually a slow server or a
 * typo, and a full red panel makes a recoverable moment feel like a failure.
 * The surface stays neutral; a single small dot carries the tone.
 */
const TONE_DOT = {
    neutral: () => COLORS.textMuted,
    caution: () => COLORS.warning,
    info: () => COLORS.primary,
    success: () => COLORS.success,
};

export default function Notice({ tone = 'caution', title, message, actionLabel, onAction, detail, style }) {
    const styles = getStyles();
    const dotColor = (TONE_DOT[tone] || TONE_DOT.neutral)();

    return (
        <View style={[styles.container, style]} accessibilityLiveRegion="polite">
            <View style={[styles.dot, { backgroundColor: dotColor }]} />
            <View style={styles.body}>
                {title ? <Text style={styles.title}>{title}</Text> : null}
                {message ? <Text style={styles.message}>{message}</Text> : null}
                {detail && __DEV__ ? <Text style={styles.detail}>{detail}</Text> : null}
                {actionLabel && onAction ? (
                    <TouchableOpacity
                        onPress={onAction}
                        style={styles.action}
                        accessibilityRole="button"
                        accessibilityLabel={actionLabel}
                    >
                        <Text style={styles.actionText}>{actionLabel}</Text>
                    </TouchableOpacity>
                ) : null}
            </View>
        </View>
    );
}

const getStyles = () => StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: SPACING.sm + 2,
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.md,
    },
    dot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        marginTop: 6,
    },
    body: {
        flex: 1,
    },
    title: {
        ...TYPOGRAPHY.headingSmall,
        color: COLORS.textPrimary,
        marginBottom: 3,
    },
    message: {
        ...TYPOGRAPHY.bodySmall,
        color: COLORS.textSecondary,
        lineHeight: 18,
    },
    detail: {
        ...TYPOGRAPHY.captionSmall,
        color: COLORS.textMuted,
        marginTop: SPACING.xs,
    },
    action: {
        marginTop: SPACING.sm,
        alignSelf: 'flex-start',
        paddingVertical: 2,
    },
    actionText: {
        ...TYPOGRAPHY.labelSmall,
        color: COLORS.primaryDark,
    },
});
