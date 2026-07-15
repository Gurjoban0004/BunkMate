import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { COLORS } from '../../theme/theme';

// One SVG implementation for web and native (react-native-svg renders on both),
// so the ring is a pixel copy of the PWA on Android.
export default function ProgressRing({ percentage, size = 48, strokeWidth = 5, color, children }) {
    const fillColor = color || (percentage >= 75 ? COLORS.success : percentage >= 60 ? COLORS.warning : COLORS.danger);
    const clamped = Math.min(100, Math.max(0, percentage));

    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - clamped / 100);
    const center = size / 2;

    return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <Circle cx={center} cy={center} r={radius} fill="none" stroke={COLORS.inputBackground} strokeWidth={strokeWidth} />
                <Circle
                    cx={center} cy={center} r={radius} fill="none" stroke={fillColor} strokeWidth={strokeWidth}
                    strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
                    originX={center} originY={center} rotation={-90}
                />
            </Svg>
            <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                {children || <Text style={{ fontSize: size * 0.24, fontWeight: '800', color: COLORS.textPrimary }}>{Math.round(clamped)}%</Text>}
            </View>
        </View>
    );
}
