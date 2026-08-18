import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS, TYPOGRAPHY, MOTION } from '../../theme/theme';
import BrandMark from '../../components/common/BrandMark';

export default function WelcomeScreen({ navigation }) {
    const styles = getStyles();

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                {/* Hero Section */}
                <View style={styles.hero}>
                    <View style={styles.logoPill}>
                        <BrandMark size={80} />
                    </View>
                    <Text style={styles.appName}>Presence</Text>
                    <Text style={styles.tagline}>Attendance, solved.</Text>
                    <Text style={styles.valueProp}>
                        Know when you can skip, before you decide.
                    </Text>
                </View>

                {/* Spacer */}
                <View style={{ flex: 1 }} />

                {/* Actions */}
                <View style={styles.actions}>
                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={() => navigation.navigate('ERPSetup')}
                        activeOpacity={MOTION.pressOpacity}
                        accessibilityRole="button"
                        accessibilityLabel="Get started"
                    >
                        <Text style={styles.primaryButtonText}>Get started</Text>
                    </TouchableOpacity>
                    <Text style={styles.timeEstimate}>Takes about a minute</Text>

                    <TouchableOpacity
                        style={styles.tertiaryLink}
                        onPress={() => navigation.navigate('Login')}
                        accessibilityRole="button"
                        accessibilityLabel="I already have a login code"
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

const getStyles = () => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    content: {
        flex: 1,
        paddingHorizontal: SPACING.xl,
        paddingTop: SPACING.xxl,
        paddingBottom: SPACING.xl,
    },

    // Hero
    hero: {
        alignItems: 'center',
    },
    logoPill: {
        borderRadius: 24,
        overflow: 'hidden',
        marginBottom: SPACING.lg,
        ...SHADOWS.medium,
    },
    appName: {
        fontWeight: '700',
        fontSize: 36,
        lineHeight: 40,
        color: COLORS.textPrimary,
        letterSpacing: -0.5,
    },
    tagline: {
        ...TYPOGRAPHY.bodyLarge,
        color: COLORS.textSecondary,
        marginTop: 6,
    },
    valueProp: {
        ...TYPOGRAPHY.bodySmall,
        color: COLORS.textMuted,
        textAlign: 'center',
        marginTop: SPACING.md,
        paddingHorizontal: SPACING.lg,
        lineHeight: 20,
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
        ...TYPOGRAPHY.labelLarge,
        color: COLORS.textOnPrimary,
    },
    timeEstimate: {
        ...TYPOGRAPHY.captionMedium,
        color: COLORS.textMuted,
        textAlign: 'center',
        marginTop: SPACING.sm,
    },
    tertiaryLink: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
        paddingVertical: SPACING.md,
    },
    tertiaryText: {
        ...TYPOGRAPHY.bodySmall,
        color: COLORS.textSecondary,
        textAlign: 'center',
    },
    tertiaryHighlight: {
        ...TYPOGRAPHY.labelSmall,
        color: COLORS.primaryDark,
    },
});
