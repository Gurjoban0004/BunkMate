import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import PaperWash, { usePaperTopPadding } from '../common/PaperWash';
import { PAPER, SERIF_FONT } from '../../theme/theme';

/**
 * The greeting, on a sheet of paper.
 *
 * The sheet itself is PaperWash — shared with onboarding, so setup and Today
 * are the same surface rather than two things that resemble each other.
 *
 * Two things the replica gets for free that React Native does not:
 *
 *   1. The replica's 82px top padding sat under a *fixed* 54px status bar, so
 *      the real intent is "28px below the status bar". Hardcoding 82 leaves a
 *      gaping hole on Android (24dp bar) and is tight on a tall notch, so the
 *      inset is measured instead. TodayScreen's SafeAreaView deliberately
 *      skips the top edge and leaves it to this header.
 *   2. CSS lets a glyph overflow a short line box; RN clips to it. The
 *      replica's line-height:.96 therefore ate the descender of any name with
 *      a g/j/p/y in it. Line heights here always clear the font size, and the
 *      tight stacking comes from a negative margin instead.
 */
export default function PaperHeader({ greeting, name, dateString, statusLine, initial, onAvatarPress }) {
    const styles = getStyles();
    const topPad = usePaperTopPadding();

    return (
        <PaperWash style={[styles.header, { paddingTop: topPad }]}>
            <View style={styles.row}>
                <View style={styles.textCol}>
                    <Text style={styles.salutation} numberOfLines={1}>{greeting}</Text>
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
        </PaperWash>
    );
}

// Android pads every Text box by the font's own ascent/descent on top of
// lineHeight, which reopens the same gap this component just closed.
const SERIF = {
    fontFamily: SERIF_FONT,
    ...Platform.select({ android: { includeFontPadding: false }, default: {} }),
};

const getStyles = () => StyleSheet.create({
    header: {
        paddingHorizontal: 24,
        // 30 clears the 17px the schedule card lifts into this sheet.
        paddingBottom: 30,
    },
    row: { flexDirection: 'row', alignItems: 'flex-start' },
    textCol: { flex: 1, minWidth: 0 },
    salutation: {
        ...SERIF, fontSize: 34, fontWeight: '700', color: PAPER.paperInk,
        letterSpacing: -1.1, lineHeight: 40,
    },
    // Negative margin, not a short lineHeight: keeps the replica's tight
    // two-line stack without cropping descenders.
    name: {
        ...SERIF, fontSize: 37, fontWeight: '700', color: PAPER.paperInk,
        letterSpacing: -1.2, lineHeight: 44, marginTop: -6,
    },
    date: { ...SERIF, fontSize: 12, lineHeight: 16, color: PAPER.paperSubInk, marginTop: 8, letterSpacing: 0.1 },
    status: { ...SERIF, fontSize: 11, lineHeight: 15, color: PAPER.muted, marginTop: 3 },
    avatar: {
        width: 40, height: 40, borderRadius: 20, marginLeft: 12, marginTop: 2,
        alignItems: 'center', justifyContent: 'center', backgroundColor: '#e5e5f3',
    },
    avatarText: { fontSize: 13, fontWeight: '700', color: PAPER.primary },
});
