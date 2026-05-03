import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Platform } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../../theme/theme';

const CELL_SIZE = 32;

/**
 * Calendar heatmap showing attendance for a subject or globally.
 * Auto-jumps to latest ERP data month on first render.
 *
 * @param {string|null} subjectId - null = global heatmap
 * @param {object} state - full AppContext state
 * @param {string|null} subjectColor - accent color for subject mode
 */
export default function CalendarView({ subjectId, state, subjectColor }) {
    const styles = getStyles();

    // ── Compute initial month offset to jump to latest ERP data ──────
    const initialOffset = useMemo(() => {
        const latestErpDate = state.latestErpDate;
        if (!latestErpDate) return 0;

        const now = new Date();
        const latest = new Date(latestErpDate + 'T12:00:00');
        const monthDiff =
            (latest.getFullYear() - now.getFullYear()) * 12 +
            (latest.getMonth() - now.getMonth());

        // Jump to the month containing the latest ERP date, capped at current month
        return Math.min(0, monthDiff);
    }, [state.latestErpDate]);

    const [monthOffset, setMonthOffset] = useState(initialOffset);
    const [selectedDay, setSelectedDay] = useState(null);

    const { month, year, calendarData, monthName, firstDayOfWeek } = useMemo(() => {
        const now = new Date();
        const mn = now.getMonth() + monthOffset;
        const target = new Date(now.getFullYear(), mn, 1);
        const targetYear = target.getFullYear();
        const targetMonth = target.getMonth();

        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        const daysCount = new Date(targetYear, targetMonth + 1, 0).getDate();
        const firstDay = new Date(targetYear, targetMonth, 1).getDay();

        const data = [];
        for (let d = 1; d <= daysCount; d++) {
            const dateKey = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayRecord = state.attendanceRecords[dateKey];
            const isHoliday = dayRecord?._holiday || (state.holidays || []).includes(dateKey);

            let status = 'none';
            let units = 1;
            let subjectDetails = [];

            if (isHoliday) {
                status = 'holiday';
            } else if (subjectId && dayRecord?.[subjectId]) {
                const record = dayRecord[subjectId];
                status = record.status === 'cancelled' ? 'cancelled' : record.status;
                units = record.units || 1;
            } else if (!subjectId && dayRecord) {
                // Global heatmap: collect all subject records for the day
                const entries = Object.entries(dayRecord)
                    .filter(([k, r]) => k !== '_holiday' && r && typeof r === 'object' && r.status);

                const absentCount = entries.filter(([, r]) => r.status === 'absent').length;
                const presentCount = entries.filter(([, r]) => r.status === 'present').length;
                const cancelledCount = entries.filter(([, r]) => r.status === 'cancelled').length;

                if (absentCount > 0) status = 'absent';
                else if (presentCount > 0) status = 'present';
                else if (cancelledCount > 0) status = 'cancelled';

                units = entries.reduce((sum, [, r]) => sum + (r.units || 1), 0);

                // Build subject details for tap overlay
                subjectDetails = entries.map(([sid, r]) => {
                    const sub = state.subjects.find(s => s.id === sid);
                    return { name: sub?.name || 'Unknown', color: sub?.color || COLORS.primary, status: r.status, units: r.units || 1 };
                });
            }

            data.push({ day: d, dateKey, status, units, subjectDetails });
        }

        return {
            month: targetMonth,
            year: targetYear,
            calendarData: data,
            monthName: `${monthNames[targetMonth]} ${targetYear}`,
            firstDayOfWeek: firstDay,
        };
    }, [subjectId, state.attendanceRecords, state.holidays, state.subjects, monthOffset]);

    // Build grid
    const gridCells = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
        gridCells.push({ type: 'empty', key: `empty-${i}` });
    }
    calendarData.forEach(d => gridCells.push({ type: 'day', ...d, key: d.dateKey }));

    const getCellStyle = useCallback((status) => {
        switch (status) {
            case 'present':  return { bg: COLORS.successLight, text: COLORS.successDark };
            case 'absent':   return { bg: COLORS.dangerLight,  text: COLORS.dangerDark  };
            case 'holiday':  return { bg: COLORS.primaryLight,  text: COLORS.primary    };
            case 'cancelled': return { bg: COLORS.inputBackground, text: COLORS.textMuted };
            default:         return { bg: 'transparent', text: COLORS.textSecondary };
        }
    }, []);

    const dayHeaders = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const accentColor = subjectColor || COLORS.primary;

    const handleDayPress = (cell) => {
        if (cell.status === 'none') return;
        setSelectedDay(cell);
    };

    return (
        <View style={styles.container}>
            {/* Month navigation */}
            <View style={styles.monthNav}>
                <TouchableOpacity
                    onPress={() => setMonthOffset(monthOffset - 1)}
                    style={styles.navBtn}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                    <Text style={styles.navBtnText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.monthTitle}>{monthName}</Text>
                <TouchableOpacity
                    onPress={() => setMonthOffset(monthOffset + 1)}
                    style={styles.navBtn}
                    disabled={monthOffset >= 0}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
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
                {gridCells.map(cell => {
                    if (cell.type === 'empty') {
                        return <View key={cell.key} style={styles.cellOuter} />;
                    }
                    const cs = getCellStyle(cell.status);
                    const isToday = cell.dateKey === new Date().toISOString().slice(0, 10);
                    const multiPeriod = cell.units >= 2 && cell.status !== 'none';

                    return (
                        <TouchableOpacity
                            key={cell.key}
                            style={styles.cellOuter}
                            onPress={() => handleDayPress(cell)}
                            activeOpacity={cell.status === 'none' ? 1 : 0.7}
                        >
                            <View style={[
                                styles.cellInner,
                                cell.status !== 'none' && { backgroundColor: cs.bg },
                                isToday && styles.cellToday,
                                multiPeriod && { borderWidth: 1.5, borderColor: cs.text + '60' },
                            ]}>
                                <Text style={[
                                    styles.dayText,
                                    cell.status !== 'none' && { color: cs.text, fontWeight: '600' },
                                    isToday && { fontWeight: '800' },
                                ]}>
                                    {cell.day}
                                </Text>
                                {/* Dot indicator for status */}
                                {cell.status !== 'none' && cell.status !== 'holiday' && (
                                    <View style={styles.dotsRow}>
                                        <View style={[styles.dot, { backgroundColor: cs.text }]} />
                                        {/* Second dot for multi-period days */}
                                        {multiPeriod && (
                                            <View style={[styles.dot, { backgroundColor: cs.text }]} />
                                        )}
                                    </View>
                                )}
                                {cell.status === 'holiday' && (
                                    <View style={[styles.dot, { backgroundColor: COLORS.primary }]} />
                                )}
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Legend */}
            <View style={styles.legend}>
                {[
                    { label: 'Present', color: COLORS.success },
                    { label: 'Absent',  color: COLORS.danger },
                    { label: 'Holiday', color: COLORS.primary },
                ].map(({ label, color }) => (
                    <View key={label} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: color }]} />
                        <Text style={styles.legendText}>{label}</Text>
                    </View>
                ))}
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, styles.legendDotDouble]}>
                        <View style={[styles.dot, { backgroundColor: COLORS.successDark }]} />
                        <View style={[styles.dot, { backgroundColor: COLORS.successDark }]} />
                    </View>
                    <Text style={styles.legendText}>2+ periods</Text>
                </View>
            </View>

            {/* Day Detail Modal */}
            {selectedDay && (
                <Modal
                    visible={!!selectedDay}
                    transparent
                    animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
                    onRequestClose={() => setSelectedDay(null)}
                >
                    <TouchableOpacity
                        style={styles.modalOverlay}
                        activeOpacity={1}
                        onPress={() => setSelectedDay(null)}
                    >
                        <View style={styles.dayDetailSheet}>
                            <View style={styles.dayDetailHandle} />
                            <Text style={styles.dayDetailDate}>
                                {new Date(selectedDay.dateKey + 'T12:00:00').toLocaleDateString('en-US', {
                                    weekday: 'long', month: 'long', day: 'numeric'
                                })}
                            </Text>

                            {selectedDay.status === 'holiday' ? (
                                <View style={styles.dayDetailRow}>
                                    <View style={[styles.statusPill, { backgroundColor: COLORS.primaryLight }]}>
                                        <Text style={[styles.statusPillText, { color: COLORS.primary }]}>Holiday</Text>
                                    </View>
                                </View>
                            ) : subjectId ? (
                                // Subject-specific detail
                                <View style={styles.dayDetailRow}>
                                    <View style={[styles.statusPill, {
                                        backgroundColor: selectedDay.status === 'present' ? COLORS.successLight : COLORS.dangerLight,
                                    }]}>
                                        <Text style={[styles.statusPillText, {
                                            color: selectedDay.status === 'present' ? COLORS.successDark : COLORS.dangerDark,
                                        }]}>
                                            {selectedDay.status === 'present' ? 'Present' : 'Absent'}
                                        </Text>
                                    </View>
                                    {selectedDay.units >= 2 && (
                                        <Text style={styles.dayDetailUnits}>{selectedDay.units} periods</Text>
                                    )}
                                    <View style={[styles.sourcePill]}>
                                        <Text style={styles.sourcePillText}>
                                            {state.attendanceRecords[selectedDay.dateKey]?.[subjectId]?.source === 'erp' ? 'Portal' : 'Manual'}
                                        </Text>
                                    </View>
                                </View>
                            ) : (
                                // Global detail — list subjects
                                <ScrollView style={styles.dayDetailSubjects} showsVerticalScrollIndicator={false}>
                                    {selectedDay.subjectDetails.length > 0 ? (
                                        selectedDay.subjectDetails.map((sd, i) => (
                                            <View key={i} style={styles.dayDetailSubjectRow}>
                                                <View style={[styles.subjectColorDot, { backgroundColor: sd.color }]} />
                                                <Text style={styles.dayDetailSubjectName}>{sd.name}</Text>
                                                <View style={[styles.statusPill, {
                                                    backgroundColor: sd.status === 'present' ? COLORS.successLight : COLORS.dangerLight,
                                                }]}>
                                                    <Text style={[styles.statusPillText, {
                                                        color: sd.status === 'present' ? COLORS.successDark : COLORS.dangerDark,
                                                        fontSize: 11,
                                                    }]}>
                                                        {sd.status === 'present' ? 'Present' : sd.status === 'absent' ? 'Absent' : 'Cancelled'}
                                                    </Text>
                                                </View>
                                                {sd.units >= 2 && (
                                                    <Text style={styles.dayDetailUnits}>{sd.units}×</Text>
                                                )}
                                            </View>
                                        ))
                                    ) : (
                                        <Text style={styles.dayDetailEmpty}>No data for this day</Text>
                                    )}
                                </ScrollView>
                            )}
                        </View>
                    </TouchableOpacity>
                </Modal>
            )}
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
        paddingHorizontal: 2,
    },
    navBtn: {
        padding: SPACING.xs,
        width: 36,
        alignItems: 'center',
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
        textAlign: 'center',
        flex: 1,
    },
    dayHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: SPACING.xs,
    },
    dayHeader: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        width: `${100 / 7}%`,
        textAlign: 'center',
        fontWeight: '700',
        fontSize: 11,
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
    },
    cellToday: {
        borderWidth: 2,
        borderColor: COLORS.primary,
    },
    dayText: {
        fontSize: 12,
        color: COLORS.textSecondary,
        lineHeight: 15,
    },
    dotsRow: {
        flexDirection: 'row',
        gap: 2,
        marginTop: 1,
    },
    dot: {
        width: 4,
        height: 4,
        borderRadius: 2,
    },
    legend: {
        flexDirection: 'row',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: SPACING.sm,
        marginTop: SPACING.md,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    legendDotDouble: {
        width: 'auto',
        height: 'auto',
        borderRadius: 0,
        backgroundColor: 'transparent',
        flexDirection: 'row',
        gap: 2,
    },
    legendText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        fontSize: 11,
    },
    // Modal / day detail sheet
    modalOverlay: {
        flex: 1,
        backgroundColor: COLORS.overlay,
        justifyContent: 'flex-end',
    },
    dayDetailSheet: {
        backgroundColor: COLORS.cardBackground,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: SPACING.lg,
        paddingBottom: SPACING.xxl,
        ...SHADOWS.large,
    },
    dayDetailHandle: {
        width: 40,
        height: 4,
        backgroundColor: COLORS.border,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: SPACING.md,
    },
    dayDetailDate: {
        ...TYPOGRAPHY.headerSmall,
        color: COLORS.textPrimary,
        marginBottom: SPACING.md,
    },
    dayDetailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    statusPill: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.full,
    },
    statusPillText: {
        fontSize: 13,
        fontWeight: '600',
    },
    sourcePill: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.full,
        backgroundColor: COLORS.inputBackground,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    sourcePillText: {
        fontSize: 11,
        color: COLORS.textMuted,
        fontWeight: '500',
    },
    dayDetailUnits: {
        fontSize: 12,
        color: COLORS.textMuted,
        marginLeft: 4,
    },
    dayDetailSubjects: {
        maxHeight: 280,
    },
    dayDetailSubjectRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        gap: SPACING.sm,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderSubtle,
    },
    subjectColorDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        flexShrink: 0,
    },
    dayDetailSubjectName: {
        flex: 1,
        fontSize: 14,
        color: COLORS.textPrimary,
        fontWeight: '500',
    },
    dayDetailEmpty: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        textAlign: 'center',
        marginTop: SPACING.md,
    },
});
