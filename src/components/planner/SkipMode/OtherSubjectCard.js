import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../../theme/theme';
import StatusDot from '../shared/StatusDot';
import { determineStatus } from '../../../utils/planner/attendanceCalculations';
import { getNextClass, formatRelativeDate } from '../../../utils/planner/scheduleProcessor';

/**
 * Collapsed subject card for subjects not scheduled today.
 * Shows current %, "Next: Tomorrow" label, tap to detail.
 */
export default function OtherSubjectCard({ subjectData, onPress }) {
    const styles = getStyles();
    const { name, color, percentage, target } = subjectData;
    const status = determineStatus(percentage, target);
    const nextClass = getNextClass(subjectData);

    return (
        <TouchableOpacity
            style={styles.card}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={styles.row}>
                <View style={styles.left}>
                    <StatusDot status={status} size={8} />
                    <Text style={styles.name} numberOfLines={1}>{name}</Text>
                </View>
                <View style={styles.right}>
                    <Text style={[styles.percentage, {
                        color: status === 'danger' ? COLORS.danger :
                            status === 'warning' ? COLORS.warningDark : COLORS.successDark
                    }]}>
                        {percentage.toFixed(1)}%
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
        borderRadius: BORDER_RADIUS.md,
        paddingVertical: 14,
        paddingHorizontal: 20,
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.sm,
        ...SHADOWS.small,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    name: {
        fontSize: FONT_SIZES.md,
        fontWeight: '500',
        color: COLORS.textPrimary,
        flex: 1,
    },
    right: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    percentage: {
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
    },
    nextLabel: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
        minWidth: 55,
        textAlign: 'right',
    },
});
