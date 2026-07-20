import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS, TYPOGRAPHY, PALETTES } from '../../theme/theme';
import { useApp } from '../../context/AppContext';

// Curated onboarding palettes — shown as a 2×2 bento so users can pick a
// vibe upfront without leaving the welcome screen.
const ONBOARDING_PALETTES = ['chalkpad', 'catppuccin', 'forest', 'nordic'];

export default function WelcomeScreen({ navigation }) {
    const styles = getStyles();
    const { state, dispatch } = useApp();
    const activePalette = state?.settings?.uiPalette || 'chalkpad';

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                {/* Hero Section */}
                <View style={styles.hero}>
                    <View style={styles.logoPill}>
                        <View style={styles.logoOuterRing}>
                            <View style={styles.logoInnerRing}>
                                <View style={styles.logoCoreDot} />
                            </View>
                        </View>
                    </View>
                    <Text style={styles.appName}>Presence</Text>
                    <Text style={styles.tagline}>Attendance, solved.</Text>
                    <Text style={styles.valueProp}>
                        Import your ERP attendance and know when you can skip.
                    </Text>
                </View>

                {/* Theme bento — pick a vibe upfront */}
                <View style={styles.themeSection}>
                    <Text style={styles.themeLabel}>Pick your theme</Text>
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
                                    activeOpacity={0.85}
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
                    <Text style={styles.timeEstimate}>Takes about a minute</Text>

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
        width: 80,
        height: 80,
        borderRadius: 24,
        backgroundColor: COLORS.cardBackground,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.lg,
        ...SHADOWS.medium,
    },
    logoOuterRing: {
        width: 52,
        height: 52,
        borderRadius: 26,
        borderWidth: 2,
        borderColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoInnerRing: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: COLORS.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoCoreDot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: COLORS.primary,
    },
    appName: {
        ...TYPOGRAPHY.displayLarge,
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

    // Theme bento
    themeSection: {
        marginTop: SPACING.xl,
    },
    themeLabel: {
        ...TYPOGRAPHY.labelSmall,
        color: COLORS.textMuted,
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: SPACING.md,
    },
    themeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: SPACING.sm,
    },
    themeCard: {
        width: '48.5%',
        backgroundColor: COLORS.cardBackground,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.sm + 2,
        ...SHADOWS.small,
    },
    themeCardActive: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.primaryLight,
    },
    themeSwatches: {
        flexDirection: 'row',
        height: 32,
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
        fontWeight: '800',
    },

    // Actions
    actions: {
        gap: SPACING.sm,
    },
    timeEstimate: {
        ...TYPOGRAPHY.captionMedium,
        color: COLORS.textMuted,
        textAlign: 'center',
        marginTop: SPACING.sm,
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
        ...TYPOGRAPHY.labelLarge,
    },

    tertiaryLink: {
        alignItems: 'center',
        paddingVertical: SPACING.md,
    },
    tertiaryText: {
        ...TYPOGRAPHY.bodySmall,
        color: COLORS.textSecondary,
        textAlign: 'center',
    },
    tertiaryHighlight: {
        color: COLORS.primary,
        ...TYPOGRAPHY.labelSmall,
    },
});
