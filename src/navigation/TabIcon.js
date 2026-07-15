import React from 'react';
import { View } from 'react-native';
import Svg, { Rect, Line, Path } from 'react-native-svg';
import { COLORS } from '../theme/theme';

// Single source of truth for tab-bar icons, used by both the native (TabNavigator)
// and web (WebTabNavigator) shells. Built on react-native-svg, which renders
// identically on Android and web — so the APK is a pixel copy of the PWA.
export default function TabIcon({ label, focused }) {
    const color = focused ? COLORS.primary : COLORS.textSecondary;
    const strokeWidth = focused ? 2 : 1.5;

    const common = {
        width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none',
        stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round',
    };

    const icons = {
        Today: (
            <Svg {...common}>
                <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <Line x1="16" y1="2" x2="16" y2="6" />
                <Line x1="8" y1="2" x2="8" y2="6" />
                <Line x1="3" y1="10" x2="21" y2="10" />
            </Svg>
        ),
        Subjects: (
            <Svg {...common}>
                <Path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <Path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </Svg>
        ),
        Insights: (
            <Svg {...common}>
                <Line x1="18" y1="20" x2="18" y2="10" />
                <Line x1="12" y1="20" x2="12" y2="4" />
                <Line x1="6" y1="20" x2="6" y2="14" />
            </Svg>
        ),
        Admin: (
            <Svg {...common}>
                <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </Svg>
        ),
    };

    return (
        <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center', opacity: focused ? 1 : 0.7 }}>
            {icons[label]}
        </View>
    );
}
