import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../theme/theme';

/**
 * Skip? / Fix mode toggle with animated sliding indicator.
 * Props: activeMode ('skip'|'fix'), onModeChange (fn)
 */
export default function PlannerModeToggle({ activeMode, onModeChange }) {
    const slideAnim = useRef(new Animated.Value(activeMode === 'skip' ? 0 : 1)).current;

    useEffect(() => {
        Animated.spring(slideAnim, {
            toValue: activeMode === 'skip' ? 0 : 1,
            useNativeDriver: false,
            tension: 120,
            friction: 14,
        }).start();
    }, [activeMode]);

    return (
        <View style={styles.container}>
            {/* Animated sliding background */}
            <Animated.View
                style={[
                    styles.slider,
                    {
                        left: slideAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['1%', '50%'],
                        }),
                    },
                ]}
            />
            <TouchableOpacity
                style={styles.tab}
                onPress={() => onModeChange('skip')}
                activeOpacity={0.7}
            >
                <Text style={[styles.tabText, activeMode === 'skip' && styles.activeTabText]}>
                    Skip?
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.tab}
                onPress={() => onModeChange('fix')}
                activeOpacity={0.7}
            >
                <Text style={[styles.tabText, activeMode === 'fix' && styles.activeTabText]}>
                    Fix
                </Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.full,
        padding: 4,
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.lg,
        position: 'relative',
    },
    slider: {
        position: 'absolute',
        top: 4,
        bottom: 4,
        width: '48%',
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.full,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 3,
        elevation: 3,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: BORDER_RADIUS.full,
        zIndex: 1,
    },
    tabText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.textMuted,
    },
    activeTabText: {
        color: COLORS.primary,
    },
});
