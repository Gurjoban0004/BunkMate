import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../../theme/theme';
import { determineStatus } from '../../../utils/planner/attendanceCalculations';
import { getNextClass, formatRelativeDate } from '../../../utils/planner/scheduleProcessor';

/**
 * Compact subject card for subjects not scheduled today.
 * Prototype style: colored left border, percentage badge, next class.
 */
export default function OtherSubjectCard({ subjectData, onPress }) {
    const styles = getStyles();
    const { name, color, percentage, target } = subjectData;
    const status = determineStatus(percentage, target);
    const nextClass = getNextClass(subjectData);

    const borderColor = status === 'danger' ? COLORS.danger
        : status === 'warning' ? COLORS.warning
        : COLORS.success;

    const percentColor = status === 'danger' ? COLORS.danger
        : status === 'warning' ? COLORS.warningDark
        : COLORS.successDark;

    return (
        <TouchableOpacity
            style={[styles.card, { borderLeftColor: borderColor }]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={styles.row}>
                <View style={[styles.colorDot, { backgroundColor: color || borderColor }]} />
                <Text style={styles.name} numberOfLines={1}>{name}</Text>
                <View style={styles.right}>
                    <Text style={[styles.percentage, { color: percentColor }]}>
                        {percentage.toFixed(0)}%
                    </Text>
                    {nextClass && (
                        <Text style={styles.nextLabel}>
                            {nextClass.isToday ? 'Today' :
                                nextClass.isTomorrow ? 'Tomorrow' :
                                    nextClass.day}
                        </Text>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
}

const getStyles = () => StyleSheet.create({
    card: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        paddingVertical: 12,
        paddingHorizontal: SPACING.md,
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.xs + 2,
        borderLeftWidth: 3,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
        ...SHADOWS.small,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    colorDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        flexShrink: 0,
    },
    name: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '700',
        color: COLORS.textPrimary,
        flex: 1,
    },
    right: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    percentage: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '800',
    },
    nextLabel: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
        minWidth: 55,
        textAlign: 'right',
    },
});
