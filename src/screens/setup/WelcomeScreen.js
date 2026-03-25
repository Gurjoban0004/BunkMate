import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme/theme';

export default function WelcomeScreen({ navigation }) {
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                {/* Hero Section */}
                <View style={styles.hero}>
                    <View style={styles.logoPill}>
                        <Text style={styles.logoEmoji}>📋</Text>
                    </View>
                    <Text style={styles.appName}>Presence</Text>
                    <Text style={styles.tagline}>Attendance, solved.</Text>
                </View>

                {/* Spacer */}
                <View style={{ flex: 1 }} />

                {/* Actions */}
                <View style={styles.actions}>
                    {/* Primary CTA — Login (ERP) */}
                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={() => navigation.navigate('ERPSetup')}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.primaryButtonText}>Login</Text>
                    </TouchableOpacity>

                    {/* Secondary — Manual setup */}
                    <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => navigation.navigate('TimeSlots')}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.secondaryButtonText}>Set Up Manually</Text>
                    </TouchableOpacity>

                    {/* Tertiary — Already have a code */}
                    <TouchableOpacity
                        style={styles.tertiaryLink}
                        onPress={() => navigation.navigate('Login')}
                    >
                        <Text style={styles.tertiaryText}>
                            Already have a login code?{' '}
                            <Text style={styles.tertiaryHighlight}>Tap here</Text>
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    content: {
        flex: 1,
        paddingHorizontal: SPACING.xl,
        paddingTop: SPACING.xxl * 2,
        paddingBottom: SPACING.xl,
    },

    // Hero
    hero: {
        alignItems: 'center',
    },
    logoPill: {
        width: 72,
        height: 72,
        borderRadius: 22,
        backgroundColor: COLORS.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.lg,
        ...SHADOWS.medium,
    },
    logoEmoji: {
        fontSize: 36,
    },
    appName: {
        fontSize: 36,
        fontWeight: '800',
        color: COLORS.textPrimary,
        letterSpacing: -0.5,
    },
    tagline: {
        fontSize: FONT_SIZES.md,
        color: COLORS.textSecondary,
        marginTop: 4,
        fontWeight: '500',
    },

    // Actions
    actions: {
        gap: SPACING.sm,
    },
    primaryButton: {
        backgroundColor: COLORS.primary,
        paddingVertical: 16,
        borderRadius: BORDER_RADIUS.md,
        alignItems: 'center',
        ...SHADOWS.medium,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
    },
    secondaryButton: {
        backgroundColor: COLORS.cardBackground,
        paddingVertical: 16,
        borderRadius: BORDER_RADIUS.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    secondaryButtonText: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
    },
    tertiaryLink: {
        alignItems: 'center',
        paddingVertical: SPACING.md,
    },
    tertiaryText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        textAlign: 'center',
    },
    tertiaryHighlight: {
        color: COLORS.primary,
        fontWeight: '600',
    },
});
