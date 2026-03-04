import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../theme/theme';

const QuickActions = ({ nextClass, onRecoveryPress, onViewStatsPress, showRecovery }) => {
    return (
        <View style={styles.container}>
            <Text style={styles.sectionTitle}>⚡ Quick Actions</Text>

            {/* Next Class Info */}
            {nextClass && (
                <View style={styles.nextClassCard}>
                    <Text style={styles.nextClassLabel}>Next class</Text>
                    <Text style={styles.nextClassDay}>{nextClass.day}</Text>
                    <Text style={styles.nextClassTime}>{nextClass.startTime} – {nextClass.endTime}</Text>
                </View>
            )}

            {/* Action Buttons */}
            <View style={styles.buttonsRow}>
                {showRecovery && (
                    <TouchableOpacity
                        style={[styles.actionButton, styles.recoveryBtn]}
                        onPress={onRecoveryPress}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.actionBtnText}>🏥 Recovery Plan</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    style={[styles.actionButton, styles.statsBtn]}
                    onPress={onViewStatsPress}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.actionBtnText, styles.statsBtnText]}>Full Stats</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.md,
    },
    sectionTitle: {
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: SPACING.sm,
    },
    nextClassCard: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        marginBottom: SPACING.md,
        ...SHADOWS.small,
    },
    nextClassLabel: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
        fontWeight: '600',
        marginBottom: 4,
    },
    nextClassDay: {
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    nextClassTime: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    buttonsRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    actionButton: {
        flex: 1,
        borderRadius: BORDER_RADIUS.md,
        paddingVertical: SPACING.sm + 4,
        alignItems: 'center',
    },
    recoveryBtn: {
        backgroundColor: COLORS.danger,
    },
    statsBtn: {
        backgroundColor: COLORS.primaryLight,
        
        
    },
    actionBtnText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '700',
        color: COLORS.textOnPrimary,
    },
    statsBtnText: {
        color: COLORS.primary,
    },
});

export default QuickActions;
