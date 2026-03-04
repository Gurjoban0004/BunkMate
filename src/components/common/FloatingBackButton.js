import React, { useRef, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, Platform, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS, BORDER_RADIUS } from '../../theme/theme';

function FloatingBackButtonNative({ onPress }) {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
        }).start();
    }, []);

    if (!navigation.canGoBack()) return null;

    return (
        <Animated.View style={{ opacity: fadeAnim }}>
            <TouchableOpacity
                style={[styles.container, { top: Math.max(insets.top, SPACING.md) + SPACING.sm }]}
                onPress={onPress || (() => navigation.goBack())}
                activeOpacity={0.7}
            >
                <Text style={styles.text}>← Back</Text>
            </TouchableOpacity>
        </Animated.View>
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
        paddingHorizontal: SPACING.lg,
        paddingVertical: 12,
        borderRadius: BORDER_RADIUS.full,
        ...SHADOWS.medium,
    },
    text: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.primary,
    },
});
