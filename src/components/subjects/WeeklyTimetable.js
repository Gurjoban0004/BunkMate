import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, TYPOGRAPHY, SHADOWS } from '../../theme/theme';
import { getClassesForDay } from '../../utils/attendance';
import { getTodayDayName, formatTimeRange } from '../../utils/dateHelpers';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * WeeklyTimetable — vertical agenda of the whole week, grouped by day.
 * Reads straight from the synced timetable via getClassesForDay (same source the
 * Today screen uses), so it stays in lockstep with portal syncs.
 */
export default function WeeklyTimetable({ state }) {
    const styles = getStyles();
    const todayName = getTodayDayName(state.devDate);

    const week = DAYS.map(day => ({ day, classes: getClassesForDay(state, day) }));
    const hasAny = week.some(d => d.classes.length > 0);

    if (!hasAny) {
        return (
            <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>No timetable yet</Text>
                <Text style={styles.emptyText}>
                    Connect your portal and sync — your weekly schedule will appear here automatically.
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.wrap}>
            {week.map(({ day, classes }) => {
                const isToday = day === todayName;
                return (
                    <View key={day} style={styles.dayBlock}>
                        {/* Day header */}
                        <View style={styles.dayHeader}>
                            <Text style={[styles.dayName, isToday && styles.dayNameToday]}>{day}</Text>
                            {isToday && (
                                <View style={styles.todayChip}>
                                    <Text style={styles.todayChipText}>TODAY</Text>
                                </View>
                            )}
                            <View style={styles.dayRule} />
                            <Text style={styles.dayCount}>
                                {classes.length === 0 ? 'Free' : `${classes.length} ${classes.length === 1 ? 'class' : 'classes'}`}
                            </Text>
                        </View>

                        {/* Classes */}
                        {classes.length === 0 ? (
                            <View style={[styles.card, styles.freeCard, isToday && styles.cardToday]}>
                                <Text style={styles.freeText}>No classes scheduled</Text>
                            </View>
                        ) : (
                            classes.map((c, i) => (
                                <View
                                    key={`${c.subjectId}-${i}`}
                                    style={[styles.card, isToday && styles.cardToday]}
                                >
                                    <View style={[styles.colorBar, { backgroundColor: c.color || COLORS.primary }]} />
                                    <View style={styles.cardBody}>
                                        <Text style={styles.subjectName} numberOfLines={1}>{c.subjectName}</Text>
                                        {!!c.teacher && (
                                            <Text style={styles.teacher} numberOfLines={1}>{c.teacher}</Text>
                                        )}
                                    </View>
                                    <View style={styles.timeCol}>
                                        <Text style={styles.time}>{formatTimeRange(c.startTime, c.endTime)}</Text>
                                        {c.units > 1 && (
                                            <View style={styles.unitBadge}>
                                                <Text style={styles.unitBadgeText}>{c.units} HR</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                );
            })}
        </View>
    );
}

const getStyles = () => StyleSheet.create({
    wrap: {
        paddingHorizontal: SPACING.screenPadding,
    },
    dayBlock: {
        marginBottom: SPACING.lg,
    },
    dayHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.sm,
        gap: SPACING.sm,
    },
    dayName: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '800',
        letterSpacing: 0.3,
        color: COLORS.textSecondary,
        textTransform: 'uppercase',
    },
    dayNameToday: {
        color: COLORS.primary,
    },
    todayChip: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: BORDER_RADIUS.sm,
    },
    todayChipText: {
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
        color: COLORS.textOnPrimary || '#FFFFFF',
    },
    dayRule: {
        flex: 1,
        height: 1,
        backgroundColor: COLORS.border,
    },
    dayCount: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '600',
        color: COLORS.textMuted,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: SPACING.sm,
        overflow: 'hidden',
        ...SHADOWS.small,
    },
    cardToday: {
        borderColor: COLORS.primary,
    },
    colorBar: {
        width: 4,
        alignSelf: 'stretch',
    },
    cardBody: {
        flex: 1,
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.md,
    },
    subjectName: {
        ...TYPOGRAPHY.headingSmall,
        color: COLORS.textPrimary,
    },
    teacher: {
        ...TYPOGRAPHY.bodySmall,
        color: COLORS.textMuted,
        marginTop: 2,
    },
    timeCol: {
        alignItems: 'flex-end',
        paddingRight: SPACING.md,
        paddingVertical: SPACING.md,
        gap: 4,
    },
    time: {
        ...TYPOGRAPHY.labelSmall,
        color: COLORS.textSecondary,
        fontWeight: '700',
    },
    unitBadge: {
        backgroundColor: COLORS.inputBackground,
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 3,
    },
    unitBadgeText: {
        ...TYPOGRAPHY.micro,
        color: COLORS.textSecondary,
    },
    freeCard: {
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.md,
        justifyContent: 'center',
    },
    freeText: {
        ...TYPOGRAPHY.bodySmall,
        color: COLORS.textMuted,
        fontStyle: 'italic',
    },
    emptyWrap: {
        marginHorizontal: SPACING.screenPadding,
        padding: SPACING.xl,
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
    },
    emptyTitle: {
        ...TYPOGRAPHY.headingSmall,
        color: COLORS.textPrimary,
        marginBottom: SPACING.xs,
    },
    emptyText: {
        ...TYPOGRAPHY.bodySmall,
        color: COLORS.textMuted,
        textAlign: 'center',
        lineHeight: 20,
    },
});
