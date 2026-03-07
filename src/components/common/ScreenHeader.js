import React, { useRef, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, Platform, Animated, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS, BORDER_RADIUS } from '../../theme/theme';
import { HeadingSmall, BodySmall } from './Typography';

function ScreenHeaderNative({ title, onPress, showBack = true }) {
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

    const canGoBack = showBack && navigation.canGoBack();

    return (
        <Animated.View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.content}>
                {canGoBack && (
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={onPress || (() => navigation.goBack())}
                        activeOpacity={0.7}
                    >
                        <BodySmall style={styles.backButtonText}>←</BodySmall>
                    </TouchableOpacity>
                )}
                {title && (
                    <HeadingSmall style={[styles.title, { marginLeft: canGoBack ? SPACING.sm : 0 }]}>
                        {title}
                    </HeadingSmall>
                )}
            </View>
        </Animated.View>
    );
}

export default function ScreenHeader({ title, onPress, showBack = true }) {
    // On web, our custom WebHeader will handle the back button.
    // We cannot call useNavigation() on web because NavigationContainer doesn't exist.
    if (Platform.OS === 'web') return null;
    return <ScreenHeaderNative title={title} onPress={onPress} showBack={showBack} />;
}

const getStyles = () => StyleSheet.create({
    container: {
        backgroundColor: COLORS.background,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        zIndex: 100,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.screenPadding,
        paddingVertical: SPACING.md,
        minHeight: 56, // Consistent header height
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: BORDER_RADIUS.full,
        backgroundColor: COLORS.cardBackground,
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.small,
    },
    backButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.primary,
        textAlign: 'center',
    },
    title: {
        ...TYPOGRAPHY.headerSmall,
        color: COLORS.textPrimary,
        flex: 1,
    },
});
