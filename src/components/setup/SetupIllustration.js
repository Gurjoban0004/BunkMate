import React from 'react';
import { View } from 'react-native';
import Svg, { Rect, Line, Circle, Path, Polyline } from 'react-native-svg';
import { COLORS } from '../../theme/theme';

/**
 * SetupIllustration — the mark at the top of each setup step.
 *
 * Replaces the ring-and-dot, which was the same abstract shape on every screen
 * and said nothing about the step under it. Each of these draws the actual
 * thing you're being asked for.
 *
 * Same drawing language as the tab-bar icons (24 grid, round caps, no fill), so
 * they read as one family rather than borrowed clip-art. Drawn as SVG for the
 * same reason TabIcon is: identical output on Android, iOS and web, no asset load.
 */
// The art is drawn on a 24 grid but rendered at ~60px, so raw stroke widths are
// scaled up 2.5x on screen. These keep the drawn weight in line with the 1.5/24
// of the tab icons instead of turning into thick marker lines.
const SW = { primary: 1, muted: 0.8 };

export default function SetupIllustration({ name, size = 60 }) {
    const primary = COLORS.primary;
    const muted = COLORS.textMuted;

    const common = {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
    };

    const art = {
        // Sign in — a student ID card
        signin: (
            <Svg {...common}>
                <Rect x="2" y="5" width="20" height="14" rx="2" stroke={primary} strokeWidth={SW.primary} />
                <Rect x="5" y="8.5" width="5" height="5" rx="1" stroke={muted} strokeWidth={SW.muted} />
                <Line x1="13" y1="9.5" x2="19" y2="9.5" stroke={muted} strokeWidth={SW.muted} />
                <Line x1="13" y1="12.5" x2="17" y2="12.5" stroke={muted} strokeWidth={SW.muted} />
                <Line x1="5" y1="16" x2="19" y2="16" stroke={muted} strokeWidth={SW.muted} />
            </Svg>
        ),

        // Verify — a code arriving on your phone
        code: (
            <Svg {...common}>
                <Rect x="7" y="2" width="10" height="20" rx="2" stroke={primary} strokeWidth={SW.primary} />
                <Line x1="10.5" y1="5" x2="13.5" y2="5" stroke={muted} strokeWidth={SW.muted} />
                <Circle cx="9.6" cy="12" r="0.9" fill={primary} />
                <Circle cx="12" cy="12" r="0.9" fill={primary} />
                <Circle cx="14.4" cy="12" r="0.9" fill={primary} />
                <Line x1="10.5" y1="18.5" x2="13.5" y2="18.5" stroke={muted} strokeWidth={SW.muted} />
            </Svg>
        ),

        // Make it yours — a stack of swatches. Each is filled with the page
        // colour so the front one genuinely occludes the one behind it.
        theme: (
            <Svg {...common}>
                <Rect x="2.5" y="11" width="9" height="9" rx="2" fill={COLORS.background} stroke={muted} strokeWidth={SW.muted} />
                <Rect x="7.5" y="7.5" width="9" height="9" rx="2" fill={COLORS.background} stroke={muted} strokeWidth={SW.muted} />
                <Rect x="12.5" y="4" width="9" height="9" rx="2" fill={COLORS.background} stroke={primary} strokeWidth={SW.primary} />
            </Svg>
        ),

        // Welcome back — carrying your data to this device
        restore: (
            <Svg {...common}>
                <Rect x="2" y="5" width="7" height="14" rx="1.5" stroke={muted} strokeWidth={SW.muted} />
                <Rect x="15" y="5" width="7" height="14" rx="1.5" stroke={primary} strokeWidth={SW.primary} />
                <Line x1="10" y1="12" x2="13.6" y2="12" stroke={primary} strokeWidth={SW.primary} />
                <Polyline points="12,10.2 13.8,12 12,13.8" stroke={primary} strokeWidth={SW.primary} />
            </Svg>
        ),

        // Something didn't reach us
        problem: (
            <Svg {...common}>
                <Path d="M7 18a4 4 0 0 1 .5-8 6 6 0 0 1 11.3 2A3.5 3.5 0 0 1 18 18H7z" stroke={primary} strokeWidth={SW.primary} />
                <Line x1="4.5" y1="20" x2="19.5" y2="4.5" stroke={muted} strokeWidth={SW.muted} />
            </Svg>
        ),
    };

    return (
        <View style={{ height: size, justifyContent: 'center' }} accessible={false}>
            {art[name] || art.signin}
        </View>
    );
}
