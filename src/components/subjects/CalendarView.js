import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../../theme/theme';

const CELL_SIZE = 28;
const GAP = 4;

/**
 * Calendar heatmap showing attendance for a subject.
 * Shows current month by default. Colored dots per day.
 *
 * @param {string} subjectId
 * @param {object} state
 */
export default function CalendarView({ subjectId, state }) {
    const styles = getStyles();
    const [monthOffset, setMonthOffset] = useState(0);

    const { month, year, calendarData, monthName, daysInMonth, firstDayOfWeek } = useMemo(() => {
        const now = new Date();
        const yr = now.getFullYear();
        const mn = now.getMonth() + monthOffset;
        const target = new Date(yr, mn, 1);
        const targetYear = target.getFullYear();
        const targetMonth = target.getMonth();

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const daysCount = new Date(targetYear, targetMonth + 1, 0).getDate();
        const firstDay = new Date(targetYear, targetMonth, 1).getDay(); // 0=Sun

        const data = [];
        for (let d = 1; d <= daysCount; d++) {
            const dateKey = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayRecord = state.attendanceRecords[dateKey];
            const isHoliday = dayRecord?._holiday || (state.holidays || []).includes(dateKey);

            let status = 'none'; // no data
            if (isHoliday) {
                status = 'holiday';
            } else if (subjectId && dayRecord?.[subjectId]) {
                const record = dayRecord[subjectId];
                if (record.status === 'present') status = 'present';
                else if (record.status === 'absent') status = 'absent';
                else if (record.status === 'cancelled') status = 'cancelled';
            } else if (!subjectId && dayRecord) {
                // Global Heatmap Mode: Aggregate all classes for the day
                const records = Object.values(dayRecord).filter(r => r && typeof r === 'object');
                const isAbsent = records.some(r => r.status === 'absent');
                const isPresent = records.some(r => r.status === 'present');
                const isCancelled = records.some(r => r.status === 'cancelled');

                if (isAbsent) {
                    status = 'absent'; // Show red if you skipped ANYTHING that day
                } else if (isPresent) {
                    status = 'present'; // Fully safe day
                } else if (isCancelled) {
                    status = 'cancelled';
                }
            }

            data.push({ day: d, dateKey, status });
        }

        return {
            month: targetMonth,
            year: targetYear,
            calendarData: data,
            monthName: `${monthNames[targetMonth]} ${targetYear}`,
            daysInMonth: daysCount,
            firstDayOfWeek: firstDay,
        };
    }, [subjectId, state.attendanceRecords, state.holidays, monthOffset]);

    const dayHeaders = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    // Build grid with leading empty cells
    const gridCells = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
        gridCells.push({ type: 'empty', key: `empty-${i}` });
    }
    calendarData.forEach((d) => {
        gridCells.push({ type: 'day', ...d, key: d.dateKey });
    });

    const getDotColor = (status) => {
        switch (status) {
            case 'present':  return COLORS.success;
            case 'absent':   return COLORS.danger;
            case 'holiday':  return COLORS.primary;
            case 'cancelled': return COLORS.border;
            default: return null;
        }
    };

    const getCellBg = (status) => {
        switch (status) {
            case 'present':  return COLORS.successLight;
            case 'absent':   return COLORS.dangerLight;
            case 'holiday':  return COLORS.primaryLight;
            case 'cancelled': return COLORS.inputBackground;
            default: return 'transparent';
        }
    };

    return (
        <View style={styles.container}>
            {/* Month navigation */}
            <View style={styles.monthNav}>
                <TouchableOpacity onPress={() => setMonthOffset(monthOffset - 1)} style={styles.navBtn}>
                    <Text style={styles.navBtnText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.monthTitle}>{monthName}</Text>
                <TouchableOpacity
                    onPress={() => setMonthOffset(monthOffset + 1)}
                    style={styles.navBtn}
                    disabled={monthOffset >= 0}
                >
                    <Text style={[styles.navBtnText, monthOffset >= 0 && styles.navBtnDisabled]}>›</Text>
                </TouchableOpacity>
            </View>

            {/* Day headers */}
            <View style={styles.dayHeaderRow}>
                {dayHeaders.map((d, i) => (
                    <Text key={i} style={styles.dayHeader}>{d}</Text>
                ))}
            </View>

            {/* Calendar grid */}
            <View style={styles.grid}>
                {gridCells.map((cell) => (
                    <View key={cell.key} style={styles.cellOuter}>
                        {cell.type === 'day' ? (
                            <View style={[
                                styles.cellInner,
                                cell.status !== 'none' && { backgroundColor: getCellBg(cell.status) }
                            ]}>
                                <Text style={[
                                    styles.dayText,
                                    cell.status === 'present' && styles.dayTextPresent,
                                    cell.status === 'absent' && styles.dayTextAbsent,
                                ]}>
                                    {cell.day}
                                </Text>
                                {getDotColor(cell.status) && (
                                    <View style={[styles.statusDot, { backgroundColor: getDotColor(cell.status) }]} />
                                )}
                            </View>
                        ) : null}
                    </View>
                ))}
            </View>

            {/* Legend */}
            <View style={styles.legend}>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: COLORS.success }]} />
                    <Text style={styles.legendText}>Attended</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: COLORS.danger }]} />
                    <Text style={styles.legendText}>Skipped</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: COLORS.primary }]} />
                    <Text style={styles.legendText}>Holiday</Text>
                </View>
            </View>
        </View>
    );
}

const getStyles = () => StyleSheet.create({
    container: {
        marginBottom: SPACING.md,
    },
    monthNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: SPACING.sm,
    },
    navBtn: {
        padding: SPACING.xs,
    },
    navBtnText: {
        fontSize: 24,
        color: COLORS.primary,
        fontWeight: '600',
    },
    navBtnDisabled: {
        color: COLORS.textMuted,
    },
    monthTitle: {
        ...TYPOGRAPHY.headerSmall,
        color: COLORS.textPrimary,
    },
    dayHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: SPACING.xs,
    },
    dayHeader: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        width: CELL_SIZE,
        textAlign: 'center',
        fontWeight: '600',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    cellOuter: {
        width: `${100 / 7}%`,
        height: CELL_SIZE + 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: GAP,
    },
    cellInner: {
        width: CELL_SIZE + 6,
        height: CELL_SIZE + 6,
        borderRadius: BORDER_RADIUS.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusDot: {
        width: 5,
        height: 5,
        borderRadius: 3,
        marginTop: 2,
    },
    dayText: {
        ...TYPOGRAPHY.bodySmall,
        color: COLORS.textPrimary,
        fontSize: 13,
    },
    dayTextPresent: {
        color: COLORS.successDark,
        fontWeight: '600',
    },
    dayTextAbsent: {
        color: COLORS.dangerDark,
        fontWeight: '600',
    },
    legend: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: SPACING.md,
        marginTop: SPACING.sm,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    legendText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        fontSize: 11,
        fontWeight: '500',
    },
});
