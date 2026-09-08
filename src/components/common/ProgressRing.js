import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { COLORS } from '../../theme/theme';
import { formatPct } from '../../utils/attendance';

// One SVG implementation for web and native (react-native-svg renders on both),
// so the ring is a pixel copy of the PWA on Android.
export default function ProgressRing({ percentage, size = 48, strokeWidth = 5, color, trackColor, children }) {
    const fillColor = color || (percentage >= 75 ? COLORS.success : percentage >= 60 ? COLORS.warning : COLORS.danger);
    const clamped = Math.min(100, Math.max(0, percentage));

    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - clamped / 100);
    const center = size / 2;

    return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {/* The unfilled track. `trackColor` lets a caller tie the ring to a
                    tinted card — at low opacity, so it never competes with the fill. */}
                <Circle
                    cx={center} cy={center} r={radius} fill="none"
                    stroke={trackColor || COLORS.inputBackground}
                    strokeOpacity={trackColor ? 0.28 : 1}
                    strokeWidth={strokeWidth}
                />
                <Circle
                    cx={center} cy={center} r={radius} fill="none" stroke={fillColor} strokeWidth={strokeWidth}
                    strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
                    originX={center} originY={center} rotation={-90}
                />
            </Svg>
            <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                {children || <Text style={{ fontSize: size * 0.24, fontWeight: '800', color: COLORS.textPrimary }}>{formatPct(clamped)}%</Text>}
            </View>
        </View>
    );
}
