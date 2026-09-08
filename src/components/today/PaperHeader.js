import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import PaperWash from '../common/PaperWash';
import { PAPER } from '../../theme/theme';

/**
 * The greeting, on a sheet of paper.
 *
 * The sheet itself is PaperWash — shared with onboarding, so setup and Today
 * are the same surface rather than two things that resemble each other.
 * Faithful to ui-lab/today-replica.html.
 */
export default function PaperHeader({ greeting, name, dateString, statusLine, initial, onAvatarPress }) {
    const styles = getStyles();

    return (
        <PaperWash style={styles.header}>
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
        </PaperWash>
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
