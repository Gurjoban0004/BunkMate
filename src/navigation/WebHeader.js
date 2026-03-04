import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS } from '../theme/theme';

export default function WebHeader({ title, canGoBack, onGoBack }) {
    if (Platform.OS !== 'web') return null;

    return (
        <View style={styles.header}>
            {canGoBack ? (
                <TouchableOpacity onPress={onGoBack} style={styles.backButton}>
                    <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>
            ) : (
                <View style={styles.placeholder} />
            )}
            <Text style={styles.title} numberOfLines={1}>
                {title || 'Presence'}
            </Text>
            <View style={styles.placeholder} />
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 60,
        backgroundColor: COLORS.cardBackground,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        paddingHorizontal: SPACING.md,
        ...SHADOWS.small,
        zIndex: 50,
    },
    backButton: {
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        backgroundColor: COLORS.background,
        borderRadius: 8,
        
        
    },
    backButtonText: {
        ...TYPOGRAPHY.bodySmall,
        color: COLORS.primary,
        fontWeight: '600',
    },
    title: {
        ...TYPOGRAPHY.headerSmall,
        color: COLORS.textPrimary,
        flex: 1,
        textAlign: 'center',
        marginHorizontal: SPACING.md,
    },
    placeholder: {
        width: 70, // Matches back button width approximately to keep title centered
    },
});
