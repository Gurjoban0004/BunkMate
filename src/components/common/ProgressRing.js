import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { COLORS } from '../../theme/theme';

export default function ProgressRing({ percentage, size = 48, strokeWidth = 5, color, children }) {
    const fillColor = color || (percentage >= 75 ? COLORS.success : percentage >= 60 ? COLORS.warning : COLORS.danger);
    const clamped = Math.min(100, Math.max(0, percentage));

    if (Platform.OS === 'web') {
        const radius = (size - strokeWidth) / 2;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference * (1 - clamped / 100);
        return (
            <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={COLORS.inputBackground} strokeWidth={strokeWidth} />
                    <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={fillColor} strokeWidth={strokeWidth}
                        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
                        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
                </svg>
                <View style={StyleSheet.absoluteFill, { position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
                    {children || <Text style={{ fontSize: size * 0.24, fontWeight: '800', color: COLORS.textPrimary }}>{Math.round(clamped)}%</Text>}
                </View>
            </View>
        );
    }

    // Native: animated half-circle approach
    const animVal = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.timing(animVal, { toValue: clamped, duration: 600, useNativeDriver: false }).start();
    }, [clamped]);

    const half = size / 2;
    const rightRotation = animVal.interpolate({
        inputRange: [0, 50, 100],
        outputRange: ['0deg', '180deg', '180deg'],
        extrapolate: 'clamp',
    });
    const leftRotation = animVal.interpolate({
        inputRange: [0, 50, 100],
        outputRange: ['0deg', '0deg', '180deg'],
        extrapolate: 'clamp',
    });
    const leftOpacity = animVal.interpolate({
        inputRange: [0, 49.9, 50],
        outputRange: [0, 0, 1],
        extrapolate: 'clamp',
    });

    const baseCircle = {
        width: size, height: size, borderRadius: half,
        borderWidth: strokeWidth, borderColor: COLORS.inputBackground,
        alignItems: 'center', justifyContent: 'center',
    };
    const halfClip = {
        position: 'absolute', width: half, height: size, overflow: 'hidden',
    };
    const halfCircle = {
        width: size, height: size, borderRadius: half,
        borderWidth: strokeWidth, borderColor: fillColor,
    };

    return (
        <View style={baseCircle}>
            {/* Right half */}
            <View style={[halfClip, { right: 0 }]}>
                <Animated.View style={[halfCircle, { position: 'absolute', right: 0, transform: [{ rotate: rightRotation }], transformOrigin: `${half}px ${half}px` }]} />
            </View>
            {/* Left half */}
            <Animated.View style={[halfClip, { left: 0, opacity: leftOpacity }]}>
                <Animated.View style={[halfCircle, { position: 'absolute', left: 0, transform: [{ rotate: leftRotation }], transformOrigin: `${half}px ${half}px` }]} />
            </Animated.View>
            {children || <Text style={{ fontSize: size * 0.24, fontWeight: '800', color: COLORS.textPrimary }}>{Math.round(clamped)}%</Text>}
        </View>
    );
}
