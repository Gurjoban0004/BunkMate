import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect, Ellipse } from 'react-native-svg';
import { PAPER } from '../../theme/theme';

/**
 * The sheet of paper itself: the wash behind the Today greeting, and now behind
 * the onboarding header too — the same drawing, so the first screen a student
 * sees and the one they see every day after are literally the same surface.
 *
 * It is drawn, not photographed — no texture asset, no image to ship or to load
 * late. React Native has no radial-gradient, so the three soft pools from the
 * design come from react-native-svg (already a dependency) laid over a warm
 * linear base, and the ring bottom-right is a stroked ellipse.
 *
 * Faithful to ui-lab/today-replica.html: the same stops, the same positions,
 * the same -9° tilt on the ring. `ring={false}` drops the ring for a shallow
 * header, where it would only clip through the content.
 *
 * Ids are suffixed per instance: two washes on one screen would otherwise share
 * gradient ids, and SVG resolves those document-wide — the second would win.
 */
let instanceCount = 0;

export default function PaperWash({ ring = true, style, pointerEvents, children }) {
    const [uid] = useState(() => `pw${++instanceCount}`);
    // The ring is positioned from the bottom-right corner, so it needs the
    // surface's real size — percentages and absolute radii cannot be mixed in
    // one SVG shape without it drifting as the content wraps.
    const [size, setSize] = useState({ width: 0, height: 0 });

    return (
        <View
            style={[styles.surface, style]}
            pointerEvents={pointerEvents}
            onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
            }}
        >
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <Svg width="100%" height="100%" preserveAspectRatio="none">
                    <Defs>
                        <LinearGradient id={`${uid}base`} x1="0" y1="0" x2="0.82" y2="1">
                            <Stop offset="0" stopColor={PAPER.paperTopLeft} />
                            <Stop offset="1" stopColor={PAPER.paperBottomRight} />
                        </LinearGradient>
                        {/* ellipse 116% 70% at -9% 23% — the bright sheet edge */}
                        <RadialGradient id={`${uid}w1`} cx="-0.09" cy="0.23" rx="1.16" ry="0.7">
                            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.98" />
                            <Stop offset="0.36" stopColor="#ffffff" stopOpacity="0.98" />
                            <Stop offset="0.69" stopColor="#ffffff" stopOpacity="0" />
                        </RadialGradient>
                        {/* ellipse 74% 55% at 94% 29% — the sage pool, top right */}
                        <RadialGradient id={`${uid}w2`} cx="0.94" cy="0.29" rx="0.74" ry="0.55">
                            <Stop offset="0" stopColor="#dde4d9" stopOpacity="0.56" />
                            <Stop offset="0.26" stopColor="#dde4d9" stopOpacity="0.56" />
                            <Stop offset="0.71" stopColor="#dde4d9" stopOpacity="0" />
                        </RadialGradient>
                        {/* ellipse 64% 42% at 42% 116% — the lavender pool, below the fold */}
                        <RadialGradient id={`${uid}w3`} cx="0.42" cy="1.16" rx="0.64" ry="0.42">
                            <Stop offset="0" stopColor="#e4e1f2" stopOpacity="0.5" />
                            <Stop offset="0.28" stopColor="#e4e1f2" stopOpacity="0.5" />
                            <Stop offset="0.75" stopColor="#e4e1f2" stopOpacity="0" />
                        </RadialGradient>
                    </Defs>

                    <Rect x="0" y="0" width="100%" height="100%" fill={PAPER.paperBase} />
                    <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${uid}base)`} />
                    <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${uid}w3)`} />
                    <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${uid}w2)`} />
                    <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${uid}w1)`} />

                    {/* The ring running off the bottom-right corner: a 280×118
                        oval inset by its own 20px stroke, sitting 100px past the
                        right edge and 58px below the bottom, tilted -9°. */}
                    {ring && size.width > 0 && (() => {
                        const cx = size.width + 100 - 140;
                        const cy = size.height + 58 - 59;
                        return (
                            <Ellipse
                                cx={cx} cy={cy} rx={130} ry={49}
                                fill="none" stroke="rgba(255,255,255,0.36)" strokeWidth={20}
                                transform={`rotate(-9, ${cx}, ${cy})`}
                            />
                        );
                    })()}
                </Svg>
            </View>

            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    surface: { overflow: 'hidden', backgroundColor: PAPER.paperBase },
});
