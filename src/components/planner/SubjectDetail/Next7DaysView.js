import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../../theme/theme';
import { getNext7DaysClasses } from '../../../utils/planner/scheduleProcessor';

/**
 * Next 7 days calendar view showing scheduled classes.
 */
export default function Next7DaysView({ subjectData }) {
    const classes = useMemo(() => getNext7DaysClasses(subjectData), [subjectData]);

    // Build 7-day array
    const days = useMemo(() => {
        const result = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < 7; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);

            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const hasClass = classes.some(c => {
                const cDate = new Date(c.date);
                return cDate.getDate() === d.getDate() &&
                    cDate.getMonth() === d.getMonth() &&
                    cDate.getFullYear() === d.getFullYear();
            });

            const classInfo = hasClass ? classes.find(c => {
                const cDate = new Date(c.date);
                return cDate.getDate() === d.getDate();
            }) : null;

            result.push({
                dayName: dayNames[d.getDay()],
                date: d.getDate(),
                isToday: i === 0,
                hasClass,
                time: classInfo?.time || null,
            });
        }

        return result;
    }, [classes]);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Next 7 Days</Text>
            <View style={styles.daysRow}>
                {days.map((day, idx) => (
                    <View
                        key={idx}
                        style={[
                            styles.dayCell,
                            day.isToday && styles.todayCell,
                            day.hasClass && styles.hasClassCell,
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
                            day.hasClass && styles.hasClassText,
                        ]}>
                            {day.date}
                        </Text>
                        {day.hasClass && (
                            <View style={styles.classDot} />
                        )}
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

const styles = StyleSheet.create({
    container: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        ...SHADOWS.small,
    },
    title: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: SPACING.md,
    },
    daysRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dayCell: {
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.xs,
        borderRadius: BORDER_RADIUS.sm,
        flex: 1,
    },
    todayCell: {
        backgroundColor: COLORS.primaryLight,
    },
    hasClassCell: {
        // No extra bg, just the dot
    },
    dayName: {
        fontSize: 10,
        color: COLORS.textMuted,
        fontWeight: '500',
        marginBottom: 2,
    },
    dateNum: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    todayText: {
        color: COLORS.primaryDark,
    },
    hasClassText: {
        fontWeight: '700',
    },
    classDot: {
        width: 5,
        height: 5,
        borderRadius: 3,
        backgroundColor: COLORS.primary,
        marginTop: 3,
    },
    timeText: {
        fontSize: 9,
        color: COLORS.textMuted,
        marginTop: 1,
    },
});
