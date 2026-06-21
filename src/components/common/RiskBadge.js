import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, BORDER_RADIUS, FONT_SIZES } from '../../theme/theme';

const LEVEL_CONFIG = {
    impossible: { bg: COLORS.dangerLight, text: COLORS.danger, label: 'Cannot pass' },
    critical: { bg: COLORS.dangerLight, text: COLORS.danger, label: 'Zero margin' },
    tight: { bg: COLORS.warningLight, text: COLORS.warningDark, label: 'Tight' },
    moderate: { bg: COLORS.primaryLight, text: COLORS.primaryDark, label: 'Manageable' },
    comfortable: { bg: COLORS.successLight, text: COLORS.successDark, label: 'Comfortable' },
};

export default function RiskBadge({ level, compact }) {
    const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG.moderate;
    return (
        <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
            {compact && <View style={[styles.dot, { backgroundColor: cfg.text }]} />}
            <Text style={[styles.text, { color: cfg.text, fontSize: compact ? FONT_SIZES.xs : FONT_SIZES.sm }]}>{cfg.label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: BORDER_RADIUS.full, alignSelf: 'flex-start', gap: 6 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    text: { fontWeight: '700' },
});
