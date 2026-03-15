import React, { useRef, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated, View, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS, BORDER_RADIUS } from '../../theme/theme';

/**
 * Inline back button — sits in normal document flow (NOT absolute positioned).
 * Used by screens that do not have a ScreenHeader (e.g. Planner).
 */
export default function FloatingBackButton({ onPress }) {
    const styles = getStyles();
    const navigation = useNavigation();
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
        }).start();
    }, []);

    if (Platform.OS !== 'web' || !navigation.canGoBack()) return null;

    return (
        <Animated.View style={[styles.wrapper, { opacity: fadeAnim }]}>
            <TouchableOpacity
                style={styles.container}
                onPress={onPress || (() => navigation.goBack())}
                activeOpacity={0.7}
            >
                <Text style={styles.text}>← Back</Text>
            </TouchableOpacity>
        </Animated.View>
    );
}

const getStyles = () => StyleSheet.create({
    wrapper: {
        paddingHorizontal: SPACING.screenPadding,
        paddingTop: SPACING.md,
        paddingBottom: SPACING.xs,
    },
    container: {
        alignSelf: 'flex-start',
        backgroundColor: COLORS.cardBackground,
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
