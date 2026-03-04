import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS, BORDER_RADIUS } from '../theme/theme';

export default function WebHeader({ title, canGoBack, onGoBack }) {
    if (Platform.OS !== 'web' || !canGoBack) return null;

    return (
        <View style={styles.floatingHeader}>
            <TouchableOpacity onPress={onGoBack} style={styles.backButton}>
                <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    floatingHeader: {
        position: 'absolute',
        top: SPACING.lg,
        left: SPACING.lg,
        zIndex: 100,
    },
    backButton: {
        paddingVertical: 8,
        paddingHorizontal: SPACING.md,
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.full,
        ...SHADOWS.small,
    },
    backButtonText: {
        ...TYPOGRAPHY.bodySmall,
        color: COLORS.primary,
        fontWeight: '600',
    },
});
