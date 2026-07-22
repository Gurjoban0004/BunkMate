import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

/**
 * BrandMark — the Presence logo: a sage serif "P" on warm paper.
 *
 * Single source of truth for the in-app mark, so the app, the launcher icon and
 * the website can never drift apart again. Drawn as type (not an image) so it
 * stays crisp at any size and needs no asset loading on first paint.
 *
 * Brand colours are intentionally FIXED, not theme-derived — a logo shouldn't
 * reskin per palette.
 */
export const BRAND_PAPER = '#F9F8F4';
export const BRAND_SAGE = '#688E7F';

// The app renders in a serif (see SERIF_FONT in theme.js) — match the icon artwork.
const SERIF = Platform.select({ ios: 'Times New Roman', android: 'serif', default: 'Times New Roman' });

export default function BrandMark({ size = 80, tile = true, color = BRAND_SAGE }) {
    // Glyph is ~50% of the tile in the icon artwork; match that ratio here.
    const glyph = Math.round(size * 0.62);

    const letter = (
        <Text
            allowFontScaling={false}
            style={[
                styles.letter,
                {
                    fontSize: glyph,
                    lineHeight: Math.round(glyph * 1.12),
                    color,
                },
            ]}
        >
            P
        </Text>
    );

    if (!tile) return letter;

    return (
        <View
            style={[
                styles.tile,
                {
                    width: size,
                    height: size,
                    borderRadius: Math.round(size * 0.3),
                },
            ]}
        >
            {letter}
        </View>
    );
}

const styles = StyleSheet.create({
    tile: {
        backgroundColor: BRAND_PAPER,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    letter: {
        fontFamily: SERIF,
        fontWeight: '400',
        textAlign: 'center',
        includeFontPadding: false,
    },
});
