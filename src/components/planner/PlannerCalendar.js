import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../../theme/theme';

const CELL_SIZE = 34;
const DAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

function toKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Selectable month calendar for the subject planner.
 *
 * Past days render their recorded attendance faintly for context; upcoming
 * plannable class days are tappable to mark a planned skip/attend. Selection
 * colour follows the active mode (skip → danger, attend → success).
 *
 * @param {object}   props.state            full AppContext state
 * @param {string}   props.subjectId        subject being planned
 * @param {'skip'|'attend'} props.mode       active simulator mode
 * @param {object}   props.classesByDateKey dateKey → array of plannable class objects
 * @param {object}   props.selectedKeys     { [classKey]: true }
 * @param {Function} props.onToggleDay      (dateKey) => void
 */
export default function PlannerCalendar({ state, subjectId, mode, classesByDateKey, selectedKeys, onToggleDay }) {
    const styles = getStyles();
    const isSkip = mode === 'skip';

    const todayKey = toKey(new Date());

    // Plannable range bounds — used to gate month navigation.
    const plannableKeys = useMemo(() => Object.keys(classesByDateKey).sort(), [classesByDateKey]);
    const lastPlannableKey = plannableKeys[plannableKeys.length - 1];

    // Start on the current month.
    const [monthCursor, setMonthCursor] = useState(() => {
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() };
    });

    const { cells, monthLabel } = useMemo(() => {
        const { year, month } = monthCursor;
        const daysCount = new Date(year, month + 1, 0).getDate();
        const firstWeekday = new Date(year, month, 1).getDay();

        const grid = [];
        for (let i = 0; i < firstWeekday; i++) grid.push({ type: 'pad', key: `pad-${i}` });

        for (let d = 1; d <= daysCount; d++) {
            const date = new Date(year, month, d);
            const dateKey = toKey(date);
            const dayRecord = state.attendanceRecords?.[dateKey];
            const isHoliday = dayRecord?._holiday || (state.holidays || []).includes(dateKey);
            const record = dayRecord?.[subjectId];

            const dayClasses = classesByDateKey[dateKey] || [];
            const isPlannable = dayClasses.length > 0;
            const isPast = dateKey < todayKey;
            const isToday = dateKey === todayKey;
            const selectedCount = dayClasses.filter((c) => selectedKeys[c.classKey]).length;

            grid.push({
                type: 'day',
                key: dateKey,
                day: d,
                dateKey,
                isHoliday,
                isToday,
                isPast,
                isPlannable,
                pastStatus: record?.status || null,
                selected: selectedCount > 0,
                selectedCount,
                classCount: dayClasses.length,
            });
        }

        return { cells: grid, monthLabel: `${MONTH_NAMES[month]} ${year}` };
    }, [monthCursor, state.attendanceRecords, state.holidays, subjectId, classesByDateKey, selectedKeys, todayKey]);

    // Navigation gating: never browse before the current month, never past the
    // last month that actually contains a plannable class.
    const now = new Date();
    const atFloor = monthCursor.year === now.getFullYear() && monthCursor.month === now.getMonth();
    const lastDate = lastPlannableKey ? new Date(lastPlannableKey + 'T12:00:00') : now;
    const atCeiling = monthCursor.year === lastDate.getFullYear() && monthCursor.month === lastDate.getMonth();

    const shiftMonth = (delta) => {
        setMonthCursor((prev) => {
            const next = new Date(prev.year, prev.month + delta, 1);
            return { year: next.getFullYear(), month: next.getMonth() };
        });
    };

    const accent = isSkip ? COLORS.danger : COLORS.success;
    const accentLight = isSkip ? COLORS.dangerLight : COLORS.successLight;
    const accentDark = isSkip ? COLORS.dangerDark : COLORS.successDark;

    return (
        <View style={styles.container}>
            {/* Month navigation */}
            <View style={styles.monthNav}>
                <TouchableOpacity
                    onPress={() => shiftMonth(-1)}
                    style={[styles.navBtn, atFloor && styles.navBtnDisabled]}
                    disabled={atFloor}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel="Previous month"
                >
                    <Text style={styles.navBtnText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.monthTitle}>{monthLabel}</Text>
                <TouchableOpacity
                    onPress={() => shiftMonth(1)}
                    style={[styles.navBtn, atCeiling && styles.navBtnDisabled]}
                    disabled={atCeiling}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel="Next month"
                >
                    <Text style={styles.navBtnText}>›</Text>
                </TouchableOpacity>
            </View>

            {/* Day headers */}
            <View style={styles.dayHeaderRow}>
                {DAY_HEADERS.map((d, i) => (
                    <Text key={i} style={styles.dayHeader}>{d}</Text>
                ))}
            </View>

            {/* Grid */}
            <View style={styles.grid}>
                {cells.map((cell) => {
                    if (cell.type === 'pad') {
                        return <View key={cell.key} style={styles.cellOuter} />;
                    }

                    const tappable = cell.isPlannable && !cell.isPast;

                    let innerStyle = [styles.cellInner];
                    let textStyle = [styles.dayText];

                    if (cell.selected) {
                        innerStyle.push({ backgroundColor: accentLight, borderColor: accent, borderWidth: 1.5 });
                        textStyle.push({ color: accentDark, fontWeight: '800' });
                    } else if (cell.isToday) {
                        innerStyle.push(styles.cellToday);
                    }

                    if (cell.isPast || cell.isHoliday) {
                        textStyle.push({ color: COLORS.textMuted });
                    } else if (!tappable && !cell.selected) {
                        textStyle.push({ color: COLORS.textMuted });
                    }

                    return (
                        <TouchableOpacity
                            key={cell.key}
                            style={styles.cellOuter}
                            activeOpacity={tappable ? 0.6 : 1}
                            disabled={!tappable}
                            onPress={() => tappable && onToggleDay(cell.dateKey)}
                            accessibilityRole={tappable ? 'button' : undefined}
                            accessibilityState={tappable ? { selected: cell.selected } : undefined}
                            accessibilityLabel={tappable
                                ? `${monthLabel.split(' ')[0]} ${cell.day}, ${cell.selected ? 'planned' : 'tap to plan'}`
                                : undefined}
                        >
                            <View style={innerStyle}>
                                <Text style={textStyle}>{cell.day}</Text>

                                {/* Selection icon for chosen days */}
                                {cell.selected && (
                                    <View style={[styles.selBadge, { backgroundColor: accent }]}>
                                        <Text style={styles.selBadgeIcon}>{isSkip ? '✕' : '✓'}</Text>
                                    </View>
                                )}

                                {/* Past attendance dot for context */}
                                {!cell.selected && cell.pastStatus === 'present' && (
                                    <View style={[styles.dot, { backgroundColor: COLORS.success }]} />
                                )}
                                {!cell.selected && cell.pastStatus === 'absent' && (
                                    <View style={[styles.dot, { backgroundColor: COLORS.danger }]} />
                                )}

                                {/* Plannable-but-unselected indicator */}
                                {!cell.selected && tappable && !cell.pastStatus && (
                                    <View style={[styles.dot, styles.dotPlannable]} />
                                )}
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const getStyles = () => StyleSheet.create({
    container: {
        marginTop: SPACING.xs,
    },
    monthNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: SPACING.sm,
        paddingHorizontal: 2,
    },
    navBtn: {
        width: 34,
        height: 34,
        borderRadius: BORDER_RADIUS.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.inputBackground,
        alignItems: 'center',
        justifyContent: 'center',
    },
    navBtnDisabled: {
        opacity: 0.35,
    },
    navBtnText: {
        fontSize: 18,
        color: COLORS.textPrimary,
    },
    monthTitle: {
        ...TYPOGRAPHY.headingSmall,
        color: COLORS.textPrimary,
        textAlign: 'center',
        flex: 1,
    },
    dayHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: SPACING.xs,
    },
    dayHeader: {
        ...TYPOGRAPHY.captionMedium,
        color: COLORS.textMuted,
        width: `${100 / 7}%`,
        textAlign: 'center',
        fontWeight: '700',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    cellOuter: {
        width: `${100 / 7}%`,
        height: CELL_SIZE + 14,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 2,
    },
    cellInner: {
        width: CELL_SIZE,
        height: CELL_SIZE,
        borderRadius: BORDER_RADIUS.sm,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    cellToday: {
        borderWidth: 2,
        borderColor: COLORS.primary,
    },
    dayText: {
        fontWeight: '600',
        fontSize: 13,
        color: COLORS.textPrimary,
        lineHeight: 16,
    },
    dot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        marginTop: 2,
    },
    dotPlannable: {
        backgroundColor: COLORS.textMuted,
        opacity: 0.5,
    },
    selBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 15,
        height: 15,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    selBadgeIcon: {
        color: COLORS.textOnPrimary,
        fontSize: 8,
        fontWeight: '800',
    },
});
