import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../theme/theme';

const QuickWins = ({ quickWins }) => {
    if (!quickWins || quickWins.length === 0) return null;

    return (
        <View style={styles.container}>
            <Text style={styles.sectionTitle}>💡 Quick Wins</Text>

            {quickWins.map((win, index) => {
                if (win.type === 'quick_recovery') {
                    return (
                        <View key={`qr-${index}`} style={styles.card}>
                            <Text style={styles.cardTitle}>
                                {win.emoji} Attend {win.classesNeeded} more {win.subject} classes
                            </Text>
                            <Text style={styles.cardDetail}>This will:</Text>
                            <Text style={styles.cardBullet}>
                                • Bring {win.subject} from {win.currentPercent.toFixed(0)}% → {win.targetPercent.toFixed(0)}%
                            </Text>
                            <Text style={styles.cardBullet}>
                                • Unlock safe bunk slots
                            </Text>
                        </View>
                    );
                }

                if (win.type === 'perfect_week') {
                    return (
                        <View key={`pw-${index}`} style={[styles.card, styles.challengeCard]}>
                            <Text style={styles.cardTitle}>
                                {win.emoji} {win.title}
                            </Text>
                            <Text style={styles.cardDetail}>{win.description}</Text>
                            <Text style={[styles.cardDetail, { marginTop: SPACING.sm, fontWeight: '600' }]}>
                                Reward:
                            </Text>
                            {win.improvements.map((imp, i) => (
                                <Text key={i} style={styles.cardBullet}>
                                    • {imp.name}: {imp.current.toFixed(0)}% → {imp.after.toFixed(0)}%
                                </Text>
                            ))}
                        </View>
                    );
                }

                return null;
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: SPACING.lg,
        marginBottom: SPACING.md,
    },
    sectionTitle: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginBottom: SPACING.md,
    },
    card: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.small,
    },
    challengeCard: {
        backgroundColor: COLORS.primaryLight,
        borderColor: COLORS.primary,
    },
    cardTitle: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: SPACING.xs,
    },
    cardDetail: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
    },
    cardBullet: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        marginLeft: SPACING.sm,
        marginTop: 2,
    },
});

export default QuickWins;
