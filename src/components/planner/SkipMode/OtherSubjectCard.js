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

    const badgeBg = status === 'danger' ? COLORS.dangerLight
        : status === 'warning' ? COLORS.warningLight
        : COLORS.successLight;

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
                    <View style={[styles.badge, { backgroundColor: badgeBg }]}>
                        <Text style={[styles.percentage, { color: percentColor }]}>
                            {percentage.toFixed(0)}%
                        </Text>
                    </View>
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
        borderRadius: BORDER_RADIUS.md,
        paddingVertical: 12,
        paddingHorizontal: SPACING.md,
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.xs + 2,
        borderLeftWidth: 3,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.small,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    colorDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        flexShrink: 0,
    },
    name: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.textPrimary,
        flex: 1,
    },
    right: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: BORDER_RADIUS.full,
    },
    percentage: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '700',
    },
    nextLabel: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
        minWidth: 55,
        textAlign: 'right',
    },
});
