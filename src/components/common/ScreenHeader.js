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
    const isWeb = Platform.OS === 'web';

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
        }).start();
    }, []);

    const canGoBack = showBack && navigation.canGoBack();

    return (
        <Animated.View style={[
            styles.container,
            { paddingTop: isWeb ? 0 : insets.top },
            isWeb && styles.containerWeb,
        ]}>
            <View style={[styles.content, isWeb && styles.contentWeb]}>
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
                    <HeadingSmall style={[
                        styles.title,
                        { marginLeft: canGoBack ? SPACING.sm : 0 },
                    ]}>
                        {title}
                    </HeadingSmall>
                )}
            </View>
        </Animated.View>
    );
}

export default function ScreenHeader({ title, onPress, showBack = true }) {
    return <ScreenHeaderNative title={title} onPress={onPress} showBack={showBack} />;
}

const getStyles = () => StyleSheet.create({
    container: {
        backgroundColor: COLORS.background,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        zIndex: 100,
    },
    containerWeb: {
        borderBottomWidth: 0,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.screenPadding,
        paddingVertical: SPACING.md,
        minHeight: 56,
    },
    contentWeb: {
        justifyContent: 'center',
        paddingVertical: 4,
        minHeight: 36,
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

