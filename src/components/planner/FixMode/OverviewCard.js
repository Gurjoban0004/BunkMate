import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../../theme/theme';

/**
 * Overview card showing how many subjects need work vs are on track.
 * Props: needsWorkCount, onTrackCount, target
 */
export default function OverviewCard({ needsWorkCount, onTrackCount, target }) {
    const styles = getStyles();
    const total = needsWorkCount + onTrackCount;
    const allGood = needsWorkCount === 0;

    return (
        <View style={[styles.container, allGood && styles.containerGood]}>
            {allGood ? (
                <>
                    <Text style={styles.kicker}>Recovery status</Text>
                    <Text style={styles.allGoodText}>All subjects are above {target}%</Text>
                    <Text style={styles.allGoodSub}>Keep the current rhythm.</Text>
                </>
            ) : (
                <>
                    <Text style={styles.kicker}>Recovery status</Text>
                    <Text style={styles.answer}>
                        {needsWorkCount} subject{needsWorkCount !== 1 ? 's' : ''} need{needsWorkCount === 1 ? 's' : ''} attention
                    </Text>
                    <View style={styles.row}>
                        <View style={styles.stat}>
                            <Text style={[styles.statNumber, { color: COLORS.dangerText }]}>{needsWorkCount}</Text>
                            <Text style={styles.statLabel}>Below / close</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.stat}>
                            <Text style={[styles.statNumber, { color: COLORS.successDark }]}>{onTrackCount}</Text>
                            <Text style={styles.statLabel}>On track</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.stat}>
                            <Text style={[styles.statNumber, { color: COLORS.primaryDark }]}>{target}%</Text>
                            <Text style={styles.statLabel}>Target</Text>
                        </View>
                    </View>
                </>
            )}
        </View>
    );
}

const getStyles = () => StyleSheet.create({
    container: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.md,
        marginHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.cardGap,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
        ...SHADOWS.small,
    },
    containerGood: {
        borderColor: COLORS.success,
    },
    kicker: {
        fontWeight: '700',
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        marginBottom: SPACING.xs,
    },
    answer: {
        fontWeight: '700',
        fontSize: FONT_SIZES.lg,
        color: COLORS.textPrimary,
        marginBottom: SPACING.md,
    },
    allGoodText: {
        fontWeight: '700',
        fontSize: FONT_SIZES.lg,
        color: COLORS.textPrimary,
    },
    allGoodSub: {
        fontWeight: '400',
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
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
        fontWeight: '700',
        fontSize: FONT_SIZES.xl,
    },
    statLabel: {
        fontWeight: '400',
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
