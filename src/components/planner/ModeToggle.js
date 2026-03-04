import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../theme/theme';

const MODES = [
    { key: 'bunk', label: '😴 Bunk' },
    { key: 'recovery', label: '🏥 Recovery' },
    { key: 'calculator', label: '🧮 Calculator' },
];

const ModeToggle = ({ activeMode, onModeChange }) => {
    const modeIndex = MODES.findIndex(m => m.key === activeMode);
    const slideAnim = useRef(new Animated.Value(modeIndex)).current;

    useEffect(() => {
        const idx = MODES.findIndex(m => m.key === activeMode);
        Animated.spring(slideAnim, {
            toValue: idx,
            useNativeDriver: false,
            friction: 8,
            tension: 80,
        }).start();
    }, [activeMode]);

    return (
        <View style={styles.container}>
            <View style={styles.track}>
                {/* Animated indicator — slides across 3 positions */}
                <Animated.View
                    style={[
                        styles.indicator,
                        {
                            left: slideAnim.interpolate({
                                inputRange: [0, 1, 2],
                                outputRange: ['0.5%', '33.5%', '66.5%'],
                            }),
                        },
                    ]}
                />
                {MODES.map((mode) => (
                    <TouchableOpacity
                        key={mode.key}
                        style={styles.button}
                        onPress={() => onModeChange(mode.key)}
                        activeOpacity={0.7}
                    >
                        <Text style={[
                            styles.buttonText,
                            activeMode === mode.key && styles.activeText,
                        ]}>
                            {mode.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: SPACING.lg,
        marginBottom: SPACING.md,
    },
    track: {
        flexDirection: 'row',
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: 3,
        position: 'relative',
        ...SHADOWS.small,
    },
    indicator: {
        position: 'absolute',
        top: 3,
        bottom: 3,
        width: '32%',
        backgroundColor: COLORS.primary,
        borderRadius: BORDER_RADIUS.sm,
        zIndex: 0,
    },
    button: {
        flex: 1,
        paddingVertical: SPACING.sm + 2,
        alignItems: 'center',
        zIndex: 1,
    },
    buttonText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    activeText: {
        color: COLORS.textOnPrimary,
        fontWeight: '700',
    },
});

export default ModeToggle;
