import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../theme/theme';
import { getResultMessage } from '../../utils/calculator';

const ResultCard = ({ maxBunks, recoveryNeeded, currentPercentage, targetPercentage, onRecoveryPress }) => {
    const styles = getStyles();
    const isBelowTarget = currentPercentage < targetPercentage;

    if (isBelowTarget) {
        return (
            <View style={[styles.container, styles.dangerContainer]}>
                <Text style={styles.emoji}>🚨</Text>
                <Text style={styles.title}>To maintain {targetPercentage}%:</Text>

                <View style={styles.resultBox}>
                    <Text style={styles.dangerLabel}>Cannot bunk any!</Text>
                    <Text style={styles.dangerSubtext}>
                        You're at {currentPercentage.toFixed(1)}% (below {targetPercentage}%)
                    </Text>
                </View>

                <View style={styles.recoveryInfo}>
                    <Text style={styles.recoveryText}>
                        Need to attend <Text style={styles.bold}>{recoveryNeeded}</Text> classes to reach {targetPercentage}%
                    </Text>
                </View>

                {onRecoveryPress && (
                    <TouchableOpacity style={styles.recoveryButton} onPress={onRecoveryPress} activeOpacity={0.7}>
                        <Text style={styles.recoveryButtonText}>🏥 See Recovery Plan →</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    }

    const message = getResultMessage(maxBunks, 'safe');

    return (
        <View style={[styles.container, styles.safeContainer]}>
            <Text style={styles.emoji}>✅</Text>
            <Text style={styles.title}>To maintain {targetPercentage}%:</Text>

            <View style={styles.resultBox}>
                <Text style={styles.safeLabel}>You can bunk</Text>
                <Text style={styles.bigNumber}>{maxBunks}</Text>
                <Text style={styles.bigNumberUnit}>classes</Text>
            </View>

            <Text style={styles.messageText}>
                {message}
            </Text>
        </View>
    );
};

const getStyles = () => StyleSheet.create({
    container: {
        backgroundColor: COLORS.cardBackground,
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.lg,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        alignItems: 'center',
        ...SHADOWS.medium,
    },
    dangerContainer: {
        backgroundColor: COLORS.dangerLight,
    },
    safeContainer: {
        backgroundColor: COLORS.successLight,
    },
    emoji: {
        fontSize: 32,
        marginBottom: SPACING.sm,
    },
    title: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: SPACING.md,
    },
    resultBox: {
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    dangerLabel: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '700',
        color: COLORS.danger,
        marginBottom: 4,
    },
    dangerSubtext: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.dangerDark,
    },
    safeLabel: {
        fontSize: FONT_SIZES.md,
        color: COLORS.textSecondary,
    },
    bigNumber: {
        fontSize: 56,
        fontWeight: '800',
        color: COLORS.successDark,
        lineHeight: 64,
    },
    bigNumberUnit: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '600',
        color: COLORS.successDark,
    },
    messageText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        textAlign: 'center',
        fontStyle: 'italic',
    },
    recoveryInfo: {
        backgroundColor: 'rgba(255,255,255,0.6)',
        borderRadius: BORDER_RADIUS.md,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        marginBottom: SPACING.md,
    },
    recoveryText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textPrimary,
        textAlign: 'center',
    },
    bold: {
        fontWeight: '700',
    },
    recoveryButton: {
        backgroundColor: COLORS.danger,
        borderRadius: BORDER_RADIUS.md,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm + 2,
    },
    recoveryButtonText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '700',
        color: COLORS.textOnPrimary,
    },
});

export default ResultCard;
