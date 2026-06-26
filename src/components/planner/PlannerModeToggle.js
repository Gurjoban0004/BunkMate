import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../theme/theme';

export default function PlannerModeToggle({ activeMode, onModeChange }) {
    const styles = getStyles();
    const slideAnim = useRef(new Animated.Value(activeMode === 'skip' ? 0 : 1)).current;

    useEffect(() => {
        Animated.timing(slideAnim, {
            toValue: activeMode === 'skip' ? 0 : 1,
            duration: 200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start();
    }, [activeMode]);

    const skipColor = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [COLORS.textPrimary, COLORS.textSecondary],
    });
    const fixColor = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [COLORS.textSecondary, COLORS.textPrimary],
    });

    return (
        <View style={styles.container}>
            <Animated.View
                style={[
                    styles.slider,
                    {
                        left: slideAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['2%', '51%'],
                        }),
                    },
                ]}
            />
            <TouchableOpacity
                style={styles.tab}
                onPress={() => onModeChange('skip')}
                activeOpacity={0.9}
            >
                <Animated.Text style={[
                    styles.tabText,
                    { color: skipColor },
                    activeMode === 'skip' && styles.activeTabWeight,
                ]}>
                    Can I miss?
                </Animated.Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.tab}
                onPress={() => onModeChange('fix')}
                activeOpacity={0.9}
            >
                <Animated.Text style={[
                    styles.tabText,
                    { color: fixColor },
                    activeMode === 'fix' && styles.activeTabWeight,
                ]}>
                    Recover
                </Animated.Text>
            </TouchableOpacity>
        </View>
    );
}

const getStyles = () => StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: 4,
        marginHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.cardGap,
        position: 'relative',
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
    },
    slider: {
        position: 'absolute',
        top: 4,
        bottom: 4,
        width: '47%',
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    tab: {
        flex: 1,
        paddingVertical: 9,
        alignItems: 'center',
        borderRadius: BORDER_RADIUS.sm,
        zIndex: 1,
    },
    tabText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
    },
    activeTabWeight: {
        fontWeight: '800',
    },
});
