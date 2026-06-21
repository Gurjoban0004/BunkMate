import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, BORDER_RADIUS, FONT_SIZES, SPACING } from '../../theme/theme';

const STATUS_COLORS = { danger: COLORS.danger, warning: COLORS.warning, safe: COLORS.success };

export default function SkipGauge({ skipsAvailable, maxSkips = 10, status = 'safe', compact }) {
    const fill = Math.min(1, Math.max(0, skipsAvailable / maxSkips));
    const color = STATUS_COLORS[status] || COLORS.success;
    const segments = Math.min(maxSkips, 8);

    if (compact) {
        return (
            <View style={styles.compactRow}>
                <View style={styles.compactTrack}>
                    <View style={[styles.compactFill, { width: `${fill * 100}%`, backgroundColor: color }]} />
                </View>
                <Text style={[styles.compactCount, { color }]}>{skipsAvailable}</Text>
            </View>
        );
    }

    return (
        <View style={styles.row}>
            <View style={styles.track}>
                <View style={[styles.fill, { width: `${fill * 100}%`, backgroundColor: color }]} />
                {Array.from({ length: segments - 1 }).map((_, i) => (
                    <View key={i} style={[styles.tick, { left: `${((i + 1) / segments) * 100}%` }]} />
                ))}
            </View>
            <Text style={[styles.count, { color }]}>{skipsAvailable}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    track: { flex: 1, height: 10, backgroundColor: COLORS.inputBackground, borderRadius: 5, overflow: 'hidden', position: 'relative' },
    fill: { height: '100%', borderRadius: 5 },
    tick: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: COLORS.cardBackground },
    count: { fontSize: FONT_SIZES.sm, fontWeight: '800', minWidth: 20, textAlign: 'right' },
    compactRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    compactTrack: { width: 32, height: 6, backgroundColor: COLORS.inputBackground, borderRadius: 3, overflow: 'hidden' },
    compactFill: { height: '100%', borderRadius: 3 },
    compactCount: { fontSize: 10, fontWeight: '800' },
});
