import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../theme/theme';

const StatusSummary = ({ priorityList, threshold, onBunkModePress }) => {
    const criticalCount = priorityList.filter((s) => s.priority === 'critical').length;
    const warningCount = priorityList.filter((s) => s.priority === 'warning').length;
    const safeCount = priorityList.filter((s) => s.priority === 'safe').length;

    const allGood = criticalCount === 0 && warningCount === 0;

    if (allGood) {
        return (
            <View style={[styles.card, { backgroundColor: COLORS.successLight, borderColor: COLORS.success }]}>
                <Text style={styles.emoji}>✅</Text>
                <Text style={[styles.title, { color: COLORS.successDark }]}>
                    You're All Good!
                </Text>
                <Text style={styles.detail}>
                    All {safeCount} subjects above {threshold}%
                </Text>
                <Text style={styles.detail}>No recovery needed</Text>

                {onBunkModePress && (
                    <TouchableOpacity style={styles.linkButton} onPress={onBunkModePress}>
                        <Text style={[styles.linkText, { color: COLORS.primary }]}>
                            Switch to Bunk Mode to see how many classes you can skip! →
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    }

    return (
        <View style={[styles.card, { backgroundColor: COLORS.warningLight, borderColor: COLORS.warning }]}>
            <Text style={styles.emoji}>⚠️</Text>
            <Text style={[styles.title, { color: COLORS.warningDark }]}>
                Attention Needed
            </Text>
            <View style={styles.statsRow}>
                {criticalCount > 0 && (
                    <Text style={[styles.statBadge, { backgroundColor: COLORS.dangerLight, color: COLORS.dangerDark }]}>
                        🔴 {criticalCount} need recovery
                    </Text>
                )}
                {warningCount > 0 && (
                    <Text style={[styles.statBadge, { backgroundColor: COLORS.warningLight, color: COLORS.warningDark }]}>
                        🟡 {warningCount} on edge
                    </Text>
                )}
                <Text style={[styles.statBadge, { backgroundColor: COLORS.successLight, color: COLORS.successDark }]}>
                    ✅ {safeCount} safe
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        borderWidth: 1,
        alignItems: 'center',
    },
    emoji: {
        fontSize: 32,
        marginBottom: SPACING.sm,
    },
    title: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '700',
        marginBottom: SPACING.xs,
    },
    detail: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
    },
    statsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: SPACING.xs,
        marginTop: SPACING.sm,
    },
    statBadge: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '600',
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.full,
        overflow: 'hidden',
    },
    linkButton: {
        marginTop: SPACING.md,
    },
    linkText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
    },
});

export default StatusSummary;
