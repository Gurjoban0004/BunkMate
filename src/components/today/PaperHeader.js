import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect, Ellipse } from 'react-native-svg';
import { PAPER } from '../../theme/theme';

/**
 * The greeting, on a sheet of paper.
 *
 * The wash is drawn, not photographed — no texture asset, no image to ship or
 * to load late. React Native has no radial-gradient, so the three soft pools
 * from the design come from react-native-svg (already a dependency) laid over
 * a warm linear base, and the ring bottom-right is a stroked ellipse.
 *
 * Faithful to ui-lab/today-replica.html: the same stops, the same positions,
 * the same -9° tilt on the ring.
 */
export default function PaperHeader({ greeting, name, dateString, statusLine, initial, onAvatarPress }) {
    const styles = getStyles();
    // The ring is positioned from the bottom-right corner, so it needs the
    // header's real size — percentages and absolute radii cannot be mixed in
    // one SVG shape without it drifting as the greeting wraps.
    const [size, setSize] = useState({ width: 0, height: 0 });

    return (
        <View
            style={styles.header}
            onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
            }}
        >
            {/* The wash fills the header; content sits on top of it. */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <Svg width="100%" height="100%" preserveAspectRatio="none">
                    <Defs>
                        <LinearGradient id="base" x1="0" y1="0" x2="0.82" y2="1">
                            <Stop offset="0" stopColor={PAPER.paperTopLeft} />
                            <Stop offset="1" stopColor={PAPER.paperBottomRight} />
                        </LinearGradient>
                        {/* ellipse 116% 70% at -9% 23% — the bright sheet edge */}
                        <RadialGradient id="wash1" cx="-0.09" cy="0.23" rx="1.16" ry="0.7">
                            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.98" />
                            <Stop offset="0.36" stopColor="#ffffff" stopOpacity="0.98" />
                            <Stop offset="0.69" stopColor="#ffffff" stopOpacity="0" />
                        </RadialGradient>
                        {/* ellipse 74% 55% at 94% 29% — the sage pool, top right */}
                        <RadialGradient id="wash2" cx="0.94" cy="0.29" rx="0.74" ry="0.55">
                            <Stop offset="0" stopColor="#dde4d9" stopOpacity="0.56" />
                            <Stop offset="0.26" stopColor="#dde4d9" stopOpacity="0.56" />
                            <Stop offset="0.71" stopColor="#dde4d9" stopOpacity="0" />
                        </RadialGradient>
                        {/* ellipse 64% 42% at 42% 116% — the lavender pool, below the fold */}
                        <RadialGradient id="wash3" cx="0.42" cy="1.16" rx="0.64" ry="0.42">
                            <Stop offset="0" stopColor="#e4e1f2" stopOpacity="0.5" />
                            <Stop offset="0.28" stopColor="#e4e1f2" stopOpacity="0.5" />
                            <Stop offset="0.75" stopColor="#e4e1f2" stopOpacity="0" />
                        </RadialGradient>
                    </Defs>

                    <Rect x="0" y="0" width="100%" height="100%" fill={PAPER.paperBase} />
                    <Rect x="0" y="0" width="100%" height="100%" fill="url(#base)" />
                    <Rect x="0" y="0" width="100%" height="100%" fill="url(#wash3)" />
                    <Rect x="0" y="0" width="100%" height="100%" fill="url(#wash2)" />
                    <Rect x="0" y="0" width="100%" height="100%" fill="url(#wash1)" />

                    {/* The ring running off the bottom-right corner: a 280×118
                        oval inset by its own 20px stroke, sitting 100px past the
                        right edge and 58px below the bottom, tilted -9°. */}
                    {size.width > 0 && (() => {
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

            <View style={styles.row}>
                <View style={styles.textCol}>
                    <Text style={styles.salutation}>{greeting}</Text>
                    <Text style={styles.name} numberOfLines={1}>{name}</Text>
                    <Text style={styles.date}>{dateString}</Text>
                    {!!statusLine && <Text style={styles.status}>{statusLine}</Text>}
                </View>

                <TouchableOpacity
                    style={styles.avatar}
                    onPress={onAvatarPress}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Open settings"
                >
                    <Text style={styles.avatarText}>{initial}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

// The replica's serif is Times; the app's SERIF_FONT resolves to the same face
// on iOS and web, so these read from the same stack the rest of Today uses.
const SERIF = { fontFamily: 'Times New Roman' };

const getStyles = () => StyleSheet.create({
    header: {
        minHeight: 250,
        paddingTop: 82,
        paddingHorizontal: 24,
        paddingBottom: 27,
        overflow: 'hidden',
        backgroundColor: PAPER.paperBase,
    },
    row: { flexDirection: 'row', alignItems: 'flex-start' },
    textCol: { flex: 1 },
    salutation: {
        ...SERIF, fontSize: 34, fontWeight: '700', color: PAPER.paperInk,
        letterSpacing: -1.1, lineHeight: 33,
    },
    name: {
        ...SERIF, fontSize: 37, fontWeight: '700', color: PAPER.paperInk,
        letterSpacing: -1.2, lineHeight: 36, marginTop: 3,
    },
    date: { ...SERIF, fontSize: 12, color: PAPER.paperSubInk, marginTop: 6, letterSpacing: 0.1 },
    status: { ...SERIF, fontSize: 11, color: PAPER.muted, marginTop: 4 },
    avatar: {
        width: 40, height: 40, borderRadius: 20, marginLeft: 12,
        alignItems: 'center', justifyContent: 'center', backgroundColor: '#e5e5f3',
    },
    avatarText: { fontSize: 13, fontWeight: '700', color: PAPER.primary },
});
