import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import PaperWash, { usePaperTopPadding } from './PaperWash';
import { PAPER, SERIF_FONT } from '../../theme/theme';

/**
 * Every screen that is not Today, on the same sheet of paper.
 *
 * Today had the paper wash and the serif; Subjects, Insights and Settings had a
 * flat grey band and a sans title, so moving between tabs read as moving
 * between two apps. This is the same surface and the same type ramp, one step
 * quieter than the greeting — a section title, not a hello.
 *
 * `ring={false}`: the wash's ring is drawn for a 250px sheet and would cut
 * straight through a header this shallow.
 */
export default function PaperScreenHeader({ title, subtitle, onBack, right, children }) {
    const styles = getStyles();
    const topPad = usePaperTopPadding(20);

    return (
        <PaperWash ring={false} style={[styles.header, { paddingTop: topPad }]}>
            {!!onBack && (
                <TouchableOpacity
                    style={styles.back}
                    onPress={onBack}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                >
                    <Text style={styles.backGlyph}>←</Text>
                </TouchableOpacity>
            )}

            <View style={styles.row}>
                <View style={styles.textCol}>
                    <Text style={styles.title} numberOfLines={1}>{title}</Text>
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
    header: { paddingHorizontal: 20, paddingBottom: 18 },
    back: {
        width: 34, height: 34, borderRadius: 17, marginBottom: 10,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.72)',
        borderWidth: 1, borderColor: PAPER.line,
    },
    backGlyph: { fontSize: 17, fontWeight: '600', color: PAPER.primary, lineHeight: 22 },
    row: { flexDirection: 'row', alignItems: 'flex-end' },
    textCol: { flex: 1, minWidth: 0 },
    // lineHeight clears fontSize — see PaperHeader for why that is not optional.
    title: {
        ...SERIF, fontSize: 29, fontWeight: '700', color: PAPER.paperInk,
        letterSpacing: -0.9, lineHeight: 35,
    },
    subtitle: { ...SERIF, fontSize: 12, lineHeight: 16, color: PAPER.paperSubInk, marginTop: 4 },
});
