import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import PaperWash, { usePaperTopPadding } from './PaperWash';
import { PAPER, SERIF_FONT } from '../../theme/theme';

/**
 * Every screen that is not Today, on the same sheet of paper.
 *
 * Two shapes, and `onBack` picks between them:
 *
 *   TAB ROOT (no back) — the editorial block. Subjects / Insights are the top
 *   of their world and get a full-size title with room to breathe.
 *
 *   PUSHED SCREEN (back) — a compact bar: the arrow sits BESIDE the title, not
 *   above it, and the title drops to 22px. Stacked, a subject name was a ~130px
 *   slab of paper that dominated the screen it was only labelling.
 *
 * It is meant to be rendered INSIDE the ScrollView, as its first child, so it
 * scrolls away with the page. Pinned above the scroll it stayed put while the
 * content slid under it, which read as two pages sharing one window.
 *
 * `bleed` cancels the scroll container's own padding so the sheet still reaches
 * both edges — cheaper than restructuring every screen's padding onto an inner
 * wrapper, and it keeps the header a drop-in for callers.
 *
 * `ring={false}`: the wash's ring is drawn for a 250px sheet and would cut
 * straight through a header this shallow.
 */
export default function PaperScreenHeader({ title, subtitle, onBack, right, children, bleed }) {
    const styles = getStyles();
    const compact = !!onBack;
    const topPad = usePaperTopPadding(compact ? 12 : 20);

    // Long titles step down rather than ellipsing into meaninglessness
    // ("Numerical Aptitude & Logi…").
    const t = String(title || '');
    const titleSize = compact
        ? (t.length > 30 ? styles.titleXs : null)
        : (t.length > 34 ? styles.titleXs : t.length > 20 ? styles.titleSm : null);

    const bleedStyle = bleed
        ? { marginHorizontal: -(bleed.horizontal || 0), marginTop: -(bleed.top || 0) }
        : null;

    return (
        <PaperWash
            ring={false}
            style={[styles.header, compact && styles.headerCompact, bleedStyle, { paddingTop: topPad }]}
        >
            <View style={styles.row}>
                {compact && (
                    <TouchableOpacity
                        style={styles.back}
                        onPress={onBack}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                        // The tap target stays 44pt even though the circle is 34.
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Text style={styles.backGlyph}>←</Text>
                    </TouchableOpacity>
                )}

                <View style={styles.textCol}>
                    <Text
                        style={[styles.title, compact && styles.titleCompact, titleSize]}
                        numberOfLines={2}
                    >
                        {title}
                    </Text>
                    {!!subtitle && <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>}
                </View>
                {right}
            </View>

            {children}
        </PaperWash>
    );
}

const SERIF = {
    fontFamily: SERIF_FONT,
    ...Platform.select({ android: { includeFontPadding: false }, default: {} }),
};

const getStyles = () => StyleSheet.create({
    // The hairline is not decoration: it is what makes the page passing beneath
    // read as "under a header" rather than "behind the title".
    header: {
        paddingHorizontal: 20,
        paddingBottom: 18,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: PAPER.line,
    },
    headerCompact: { paddingBottom: 12 },
    back: {
        width: 34, height: 34, borderRadius: 17, marginRight: 12,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: PAPER.surface,
        borderWidth: 1, borderColor: PAPER.line,
    },
    backGlyph: { fontSize: 17, fontWeight: '600', color: PAPER.primary, lineHeight: 22 },
    row: { flexDirection: 'row', alignItems: 'center' },
    textCol: { flex: 1, minWidth: 0 },
    // lineHeight clears fontSize — see PaperHeader for why that is not optional.
    title: {
        ...SERIF, fontSize: 29, fontWeight: '700', color: PAPER.paperInk,
        letterSpacing: -0.9, lineHeight: 35,
    },
    titleCompact: { fontSize: 22, lineHeight: 27, letterSpacing: -0.5 },
    titleSm: { fontSize: 24, lineHeight: 29, letterSpacing: -0.6 },
    titleXs: { fontSize: 18, lineHeight: 23, letterSpacing: -0.3 },
    subtitle: { ...SERIF, fontSize: 12, lineHeight: 16, color: PAPER.paperSubInk, marginTop: 4 },
});
