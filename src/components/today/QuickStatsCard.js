import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../../theme/theme';

const QuickStatsCard = ({ classCount, streak, overallPercentage }) => {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Today's Stats</Text>

            <View style={styles.statsRow}>
                <View style={styles.statItem}>
                    <Text style={styles.statEmoji}>📚</Text>
                    <Text style={styles.statValue}>{classCount}</Text>
                    <Text style={styles.statLabel}>classes</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.statItem}>
                    <Text style={styles.statEmoji}>🔥</Text>
                    <Text style={styles.statValue}>{streak}</Text>
                    <Text style={styles.statLabel}>streak</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.statItem}>
                    <Text style={styles.statEmoji}>⚡</Text>
                    <Text style={styles.statValue}>{overallPercentage}%</Text>
                    <Text style={styles.statLabel}>overall</Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.md,
        ...SHADOWS.small,
    },
    title: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginBottom: SPACING.sm,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
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
    statEmoji: {
        fontSize: 20,
        marginBottom: 4,
    },
    statValue: {
        fontSize: 18,
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
        height: 40,
        backgroundColor: COLORS.border,
    },
});

export default QuickStatsCard;
