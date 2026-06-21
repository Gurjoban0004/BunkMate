import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, BORDER_RADIUS, FONT_SIZES, SPACING } from '../../theme/theme';

const SEVERITY_BG = {
    danger: COLORS.dangerLight,
    warning: COLORS.warningLight,
    success: COLORS.successLight,
    info: COLORS.primaryLight,
};

export default function CompactInsightChip({ icon, label, severity = 'info', onPress }) {
    return (
        <TouchableOpacity
            style={[styles.chip, { backgroundColor: SEVERITY_BG[severity] || SEVERITY_BG.info }]}
            onPress={onPress}
            activeOpacity={onPress ? 0.7 : 1}
            disabled={!onPress}
        >
            <Text style={styles.text}>{icon} {label}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    chip: { paddingHorizontal: SPACING.sm, paddingVertical: 6, borderRadius: BORDER_RADIUS.full, marginRight: SPACING.xs, marginBottom: SPACING.xs },
    text: { fontSize: FONT_SIZES.xs, fontWeight: '600', color: COLORS.textPrimary },
});
