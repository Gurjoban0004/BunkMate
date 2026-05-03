import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../../theme/theme';
import { getNext7DaysClasses } from '../../../utils/planner/scheduleProcessor';

/**
 * Next 7 days view — redesigned to show weekday class counts (Mon–Fri only).
 * Shows how many classes this subject has each day, with a weekly total.
 */
export default function Next7DaysView({ subjectData }) {
    const styles = getStyles();
    const classes = useMemo(() => getNext7DaysClasses(subjectData), [subjectData]);

    // Build weekdays-only array (Mon-Fri), with class count per day
    const weekdays = useMemo(() => {
        const result = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < 7; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);

            const dayOfWeek = d.getDay(); // 0=Sun, 6=Sat
            // Skip Saturday and Sunday
            if (dayOfWeek === 0 || dayOfWeek === 6) continue;

            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const dayClasses = classes.filter(c => {
                const cDate = new Date(c.date);
                return cDate.getDate() === d.getDate() &&
                    cDate.getMonth() === d.getMonth() &&
                    cDate.getFullYear() === d.getFullYear();
            });

            result.push({
                dayName: dayNames[dayOfWeek],
                date: d.getDate(),
                isToday: i === 0,
                classCount: dayClasses.length,
                time: dayClasses.length > 0 ? dayClasses[0].time : null,
            });
        }

        return result;
    }, [classes]);

    const totalClasses = weekdays.reduce((sum, d) => sum + d.classCount, 0);

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={styles.title}>This Week</Text>
                <View style={styles.totalBadge}>
                    <Text style={styles.totalText}>{totalClasses} class{totalClasses !== 1 ? 'es' : ''}</Text>
                </View>
            </View>

            <View style={styles.daysRow}>
                {weekdays.map((day, idx) => (
                    <View
                        key={idx}
                        style={[
                            styles.dayCell,
                            day.isToday && styles.todayCell,
                        ]}
                    >
                        <Text style={[
                            styles.dayName,
                            day.isToday && styles.todayText,
                        ]}>
                            {day.dayName}
                        </Text>
                        <Text style={[
                            styles.dateNum,
                            day.isToday && styles.todayText,
                        ]}>
                            {day.date}
                        </Text>

                        {/* Class count badge */}
                        <View style={[
                            styles.countBadge,
                            day.classCount > 0 ? styles.countBadgeActive : styles.countBadgeEmpty,
                        ]}>
                            <Text style={[
                                styles.countText,
                                day.classCount > 0 ? styles.countTextActive : styles.countTextEmpty,
                            ]}>
                                {day.classCount > 0 ? day.classCount : '—'}
                            </Text>
                        </View>

                        {day.time && (
                            <Text style={styles.timeText}>{formatTimeTo12h(day.time)}</Text>
                        )}
                    </View>
                ))}
            </View>
        </View>
    );
}

function formatTimeTo12h(time) {
    if (!time) return '';
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}${ampm}`;
}

const getStyles = () => StyleSheet.create({
    container: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
        ...SHADOWS.small,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    title: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    totalBadge: {
        backgroundColor: COLORS.primaryLight,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 3,
        borderRadius: BORDER_RADIUS.full,
    },
    totalText: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '600',
        color: COLORS.primaryDark,
    },
    daysRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dayCell: {
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.xs,
        borderRadius: BORDER_RADIUS.md,
        flex: 1,
    },
    todayCell: {
        backgroundColor: COLORS.primaryLight,
    },
    dayName: {
        fontSize: 11,
        color: COLORS.textMuted,
        fontWeight: '500',
        marginBottom: 2,
    },
    dateNum: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: SPACING.xs,
    },
    todayText: {
        color: COLORS.primaryDark,
        fontWeight: '700',
    },
    countBadge: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
    },
    countBadgeActive: {
        backgroundColor: COLORS.primary,
    },
    countBadgeEmpty: {
        backgroundColor: COLORS.inputBackground,
    },
    countText: {
        fontSize: 12,
        fontWeight: '700',
    },
    countTextActive: {
        color: COLORS.textOnPrimary,
    },
    countTextEmpty: {
        color: COLORS.textMuted,
    },
    timeText: {
        fontSize: 9,
        color: COLORS.textMuted,
        marginTop: 3,
    },
});
