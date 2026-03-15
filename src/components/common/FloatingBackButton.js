import React, { useRef, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, Platform, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS, BORDER_RADIUS } from '../../theme/theme';

function FloatingBackButtonNative({ onPress }) {
    const styles = getStyles();
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
    const styles = getStyles();
    return <FloatingBackButtonNative onPress={onPress} />;
}

const getStyles = () => StyleSheet.create({
    container: {
        position: 'absolute',
        left: SPACING.md,
        zIndex: 100,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        paddingHorizontal: SPACING.md,
        paddingVertical: 8,
        borderRadius: BORDER_RADIUS.full,
        ...SHADOWS.small,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    text: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.primary,
    },
});
