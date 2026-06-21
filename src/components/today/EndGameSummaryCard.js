import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme/theme';
import RiskBadge from '../common/RiskBadge';
import { OVERALL_MESSAGES } from '../../utils/endgame';

export default function EndGameSummaryCard({ overallRisk, totalRemaining, totalMustAttend, totalCanSkip, daysLeft, onExpand }) {
    const [expanded, setExpanded] = useState(false);

    const toggle = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded(!expanded);
    };

    const verdict = OVERALL_MESSAGES[overallRisk] || '';

    return (
        <TouchableOpacity style={styles.card} onPress={onExpand || toggle} activeOpacity={0.7}>
            <View style={styles.row}>
                <RiskBadge level={overallRisk} />
                <Text style={styles.verdict} numberOfLines={expanded ? undefined : 1}>{verdict}</Text>
                <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
            </View>
            {expanded && (
                <View style={styles.statsRow}>
                    <Stat label="Remaining" value={totalRemaining} />
                    <Stat label="Must attend" value={totalMustAttend} color={COLORS.danger} />
                    <Stat label="Can skip" value={totalCanSkip} color={COLORS.success} />
                </View>
            )}
        </TouchableOpacity>
    );
}

function Stat({ label, value, color }) {
    return (
        <View style={styles.stat}>
            <Text style={[styles.statValue, color && { color }]}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.cardBackground, marginHorizontal: SPACING.screenPadding, marginBottom: SPACING.md,
        borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderSubtle, ...SHADOWS.small,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    verdict: { flex: 1, fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.textSecondary },
    chevron: { fontSize: 10, color: COLORS.textMuted },
    statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: SPACING.md, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.borderSubtle },
    stat: { alignItems: 'center' },
    statValue: { fontSize: FONT_SIZES.lg, fontWeight: '800', color: COLORS.textPrimary },
    statLabel: { fontSize: FONT_SIZES.xs, color: COLORS.textMuted, marginTop: 2 },
});
