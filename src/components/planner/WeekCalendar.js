import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../theme/theme';

const STATUS_COLORS = {
    safe: '#4CAF50',
    partial: '#FF9800',
    risky: '#EF5350',
    noclass: '#9CA3AF',
};

const STATUS_EMOJI = {
    safe: '🟢',
    partial: '🟡',
    risky: '🔴',
    noclass: '⚪',
};

const WeekCalendar = ({ weekPlan, selectedDay, onDayPress }) => {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>This Week</Text>
            <View style={styles.calendarRow}>
                {weekPlan.map((day) => {
                    const isSelected = selectedDay === day.dayName;
                    return (
                        <TouchableOpacity
                            key={day.dayName}
                            style={[
                                styles.dayCell,
                                isSelected && styles.dayCellSelected,
                                day.isToday && styles.dayCellToday,
                            ]}
                            onPress={() => onDayPress(day.dayName)}
                            activeOpacity={0.7}
                        >
                            <Text style={[
                                styles.dayLabel,
                                isSelected && styles.dayLabelSelected,
                            ]}>
                                {day.shortName}
                            </Text>
                            <Text style={styles.statusDot}>
                                {STATUS_EMOJI[day.status]}
                            </Text>
                            <Text style={[
                                styles.dateNum,
                                isSelected && styles.dateNumSelected,
                            ]}>
                                {day.dateNum}
                            </Text>
                            {day.isToday && (
                                <View style={styles.todayDot} />
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
            <View style={styles.legend}>
                <LegendItem emoji="🟢" label="Safe" />
                <LegendItem emoji="🟡" label="Partial" />
                <LegendItem emoji="🔴" label="Risky" />
                <LegendItem emoji="⚪" label="Off" />
            </View>
        </View>
    );
};

const LegendItem = ({ emoji, label }) => (
    <View style={styles.legendItem}>
        <Text style={styles.legendEmoji}>{emoji}</Text>
        <Text style={styles.legendText}>{label}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: {
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.md,
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.small,
    },
    title: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginBottom: SPACING.md,
    },
    calendarRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dayCell: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        marginHorizontal: 2,
        borderRadius: BORDER_RADIUS.sm,
    },
    dayCellSelected: {
        backgroundColor: COLORS.primaryLight,
    },
    dayCellToday: {
        borderWidth: 1.5,
        borderColor: COLORS.primary,
    },
    dayLabel: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '500',
        color: COLORS.textMuted,
        marginBottom: 4,
    },
    dayLabelSelected: {
        color: COLORS.primary,
        fontWeight: '700',
    },
    statusDot: {
        fontSize: 18,
        marginVertical: 4,
    },
    dateNum: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '500',
        color: COLORS.textSecondary,
    },
    dateNumSelected: {
        color: COLORS.primary,
        fontWeight: '700',
    },
    todayDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: COLORS.primary,
        marginTop: 3,
    },
    legend: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: SPACING.md,
        paddingTop: SPACING.sm,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: SPACING.sm,
    },
    legendEmoji: {
        fontSize: 12,
        marginRight: 3,
    },
    legendText: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
    },
});

export default WeekCalendar;
