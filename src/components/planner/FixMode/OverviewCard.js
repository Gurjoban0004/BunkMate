import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../../theme/theme';

/**
 * Overview card showing how many subjects need work vs are on track.
 * Props: needsWorkCount, onTrackCount, target
 */
export default function OverviewCard({ needsWorkCount, onTrackCount, target }) {
    const total = needsWorkCount + onTrackCount;
    const allGood = needsWorkCount === 0;

    return (
        <View style={[styles.container, allGood && styles.containerGood]}>
            {allGood ? (
                <>
                    <Text style={styles.emoji}>🎉</Text>
                    <Text style={styles.allGoodText}>All subjects above {target}%!</Text>
                    <Text style={styles.allGoodSub}>You're in great shape</Text>
                </>
            ) : (
                <View style={styles.row}>
                    <View style={styles.stat}>
                        <Text style={[styles.statNumber, { color: COLORS.danger }]}>{needsWorkCount}</Text>
                        <Text style={styles.statLabel}>Need{needsWorkCount !== 1 ? '' : 's'} Work</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.stat}>
                        <Text style={[styles.statNumber, { color: COLORS.success }]}>{onTrackCount}</Text>
                        <Text style={styles.statLabel}>On Track</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.stat}>
                        <Text style={[styles.statNumber, { color: COLORS.textPrimary }]}>{target}%</Text>
                        <Text style={styles.statLabel}>Target</Text>
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.md,
        paddingVertical: 22,
        paddingHorizontal: 20,
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.md,
        ...SHADOWS.medium,
    },
    containerGood: {
        backgroundColor: COLORS.successLight,
        alignItems: 'center',
        paddingVertical: 24,
    },
    emoji: {
        fontSize: 36,
        marginBottom: SPACING.sm,
    },
    allGoodText: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.successDark,
    },
    allGoodSub: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.successDark,
        marginTop: SPACING.xs,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    stat: {
        alignItems: 'center',
        flex: 1,
    },
    statNumber: {
        fontSize: FONT_SIZES.xxl,
        fontWeight: '700',
    },
    statLabel: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
        marginTop: 4,
    },
    divider: {
        width: 1,
        height: 36,
        backgroundColor: COLORS.border,
    },
});
