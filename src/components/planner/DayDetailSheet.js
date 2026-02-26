import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../theme/theme';
import { getDayRecommendation } from '../../utils/planner';

const DayDetailSheet = ({ visible, dayData, onClose }) => {
    if (!dayData || !visible) return null;

    const { dayName, dateNum, classes, status, safeCount, riskyCount } = dayData;
    const recommendation = getDayRecommendation(classes);

    const verdictConfig = {
        safe: { emoji: '🟢', text: 'Safe to skip entire day', color: COLORS.success },
        partial: { emoji: '🟡', text: `Skip ${safeCount} only`, color: COLORS.warning },
        risky: { emoji: '🔴', text: 'Attend all classes', color: COLORS.danger },
    };

    const verdict = verdictConfig[status] || verdictConfig.risky;

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.sheet}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>{dayName}, {dateNum}</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Text style={styles.closeText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.subtitle}>If you skip this day:</Text>

                    {/* Class Table */}
                    <View style={styles.table}>
                        {/* Table Header */}
                        <View style={styles.tableHeader}>
                            <Text style={[styles.tableHeaderText, { flex: 2 }]}>Subject</Text>
                            <Text style={styles.tableHeaderText}>Now</Text>
                            <Text style={styles.tableHeaderText}>After</Text>
                            <Text style={styles.tableHeaderText}>Status</Text>
                        </View>

                        {/* Table Rows */}
                        {classes.map((cls) => (
                            <View key={cls.subjectId} style={styles.tableRow}>
                                <View style={[styles.tableCell, { flex: 2 }]}>
                                    <View style={[styles.colorDot, { backgroundColor: cls.color }]} />
                                    <Text style={styles.subjectName} numberOfLines={1}>
                                        {cls.subjectName}
                                    </Text>
                                </View>
                                <Text style={styles.tableCell}>
                                    {cls.currentPercentage.toFixed(0)}%
                                </Text>
                                <Text style={[
                                    styles.tableCell,
                                    { color: cls.safe ? COLORS.success : COLORS.danger },
                                ]}>
                                    {cls.newPercentage.toFixed(0)}%
                                </Text>
                                <Text style={styles.tableCell}>
                                    {cls.safe ? '✅' : cls.newPercentage >= 73 ? '⚠️' : '🚨'}
                                </Text>
                            </View>
                        ))}
                    </View>

                    {/* Verdict */}
                    <View style={[styles.verdictBox, { borderColor: verdict.color }]}>
                        <Text style={styles.verdictEmoji}>{verdict.emoji}</Text>
                        <Text style={[styles.verdictText, { color: verdict.color }]}>
                            Verdict: {verdict.text}
                        </Text>
                    </View>

                    {/* Recommendation */}
                    {recommendation ? (
                        <View style={styles.recommendBox}>
                            <Text style={styles.recommendLabel}>💡 Recommendation:</Text>
                            <Text style={styles.recommendText}>{recommendation}</Text>
                        </View>
                    ) : null}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: COLORS.cardBackground,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: SPACING.lg,
        paddingBottom: SPACING.xxl,
        maxHeight: '75%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    title: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.inputBackground,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeText: {
        fontSize: 16,
        color: COLORS.textSecondary,
        fontWeight: '600',
    },
    subtitle: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        marginBottom: SPACING.md,
    },
    table: {
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.sm,
        marginBottom: SPACING.md,
    },
    tableHeader: {
        flexDirection: 'row',
        paddingBottom: SPACING.sm,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        marginBottom: SPACING.xs,
    },
    tableHeaderText: {
        flex: 1,
        fontSize: FONT_SIZES.xs,
        fontWeight: '600',
        color: COLORS.textMuted,
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.xs + 2,
    },
    tableCell: {
        flex: 1,
        fontSize: FONT_SIZES.sm,
        color: COLORS.textPrimary,
        flexDirection: 'row',
        alignItems: 'center',
    },
    colorDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    subjectName: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '500',
        color: COLORS.textPrimary,
    },
    verdictBox: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1.5,
        backgroundColor: COLORS.cardBackground,
        marginBottom: SPACING.md,
    },
    verdictEmoji: {
        fontSize: 20,
        marginRight: SPACING.sm,
    },
    verdictText: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
    },
    recommendBox: {
        padding: SPACING.md,
        backgroundColor: COLORS.primaryLight,
        borderRadius: BORDER_RADIUS.md,
    },
    recommendLabel: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: 4,
    },
    recommendText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
    },
});

export default DayDetailSheet;
