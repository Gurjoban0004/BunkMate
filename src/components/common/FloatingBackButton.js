import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS, BORDER_RADIUS } from '../../theme/theme';

function FloatingBackButtonNative({ onPress }) {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();

    if (!navigation.canGoBack()) return null;

    return (
        <TouchableOpacity
            style={[styles.container, { top: Math.max(insets.top, SPACING.md) + SPACING.sm }]}
            onPress={onPress || (() => navigation.goBack())}
            activeOpacity={0.7}
        >
            <Text style={styles.text}>← Back</Text>
        </TouchableOpacity>
    );
}

export default function FloatingBackButton({ onPress }) {
    // On web, our custom WebHeader will handle the back button.
    // We cannot call useNavigation() on web because NavigationContainer doesn't exist.
    if (Platform.OS === 'web') return null;
    return <FloatingBackButtonNative onPress={onPress} />;
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: SPACING.lg,
        zIndex: 100,
        backgroundColor: COLORS.cardBackground,
        paddingHorizontal: SPACING.md,
        paddingVertical: 8,
        borderRadius: BORDER_RADIUS.full,
        ...SHADOWS.small,
    },
    text: {
        ...TYPOGRAPHY.bodySmall,
        fontWeight: '600',
        color: COLORS.primary,
    },
});
