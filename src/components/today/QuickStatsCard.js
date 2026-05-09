import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../../theme/theme';

const QuickStatsCard = ({ classCount, overallPercentage, portalStatus }) => {
    const styles = getStyles();

    return (
        <View style={styles.container}>
            <View style={styles.statsRow}>
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>{classCount}</Text>
                    <Text style={styles.statLabel}>classes</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.statItem}>
                    <Text style={styles.statValue}>{overallPercentage}%</Text>
                    <Text style={styles.statLabel}>overall</Text>
                </View>

                <View style={styles.divider} />

                <View style={[styles.statItem, styles.portalItem]}>
                    <Text style={styles.portalStatus} numberOfLines={1} adjustsFontSizeToFit>{portalStatus}</Text>
                </View>
            </View>
        </View>
    );
};

const getStyles = () => StyleSheet.create({
    container: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        marginHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.cardGap,
        ...SHADOWS.small,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statValue: {
        fontSize: 17,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    statLabel: {
        fontSize: 11,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    divider: {
        width: 1,
        height: 28,
        backgroundColor: COLORS.border,
    },
    portalItem: {
        alignItems: 'center',
    },
    portalStatus: {
        fontSize: 12,
        lineHeight: 15,
        color: COLORS.textSecondary,
        fontWeight: '700',
        textAlign: 'center',
    },
});

export default QuickStatsCard;
