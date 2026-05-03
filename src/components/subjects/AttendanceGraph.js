import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../../theme/theme';

const CHART_HEIGHT = 100;

/**
 * Pure React Native bar chart showing attendance trend.
 *
 * @param {string} subjectId - subject to graph
 * @param {object} state - full app state
 * @param {number} days - number of classes to show (default 14)
 */
export default function AttendanceGraph({ subjectId, state, days = 14 }) {
    const styles = getStyles();

    // Get all chronological records and compute cumulative pct
    const cumulativeData = useMemo(() => {
        const sortedDates = Object.keys(state.attendanceRecords).sort(); // Oldest to newest
        const subject = state.subjects.find((s) => s.id === subjectId);
        
        let totalUnits = subject?.initialTotal || 0;
        let attendedUnits = subject?.initialAttended || 0;
        const allClasses = [];

        for (const dateKey of sortedDates) {
            const record = state.attendanceRecords[dateKey]?.[subjectId];
            if (!record) continue; // Skip days with no class for this subject

            const date = new Date(dateKey + 'T12:00:00');
            const units = record.units || 1;

            if (record.status === 'present') {
                totalUnits += units;
                attendedUnits += units;
            } else if (record.status === 'absent') {
                totalUnits += units;
            }
            // If cancelled, units are not added.

            const pct = totalUnits > 0 ? Math.round((attendedUnits / totalUnits) * 100) : 0;

            allClasses.push({
                dateKey,
                day: date.getDate(),
                status: record.status,
                cumulativePct: pct
            });
        }

        // Return the last N classes
        return allClasses.slice(-days);
    }, [subjectId, state.attendanceRecords, state.subjects, days]);

    const barWidth = Math.max(
        8,
        (Dimensions.get('window').width - SPACING.screenPadding * 2 - SPACING.cardPadding * 2 - SPACING.xs * (days - 1)) / days
    );

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Last {days} Classes</Text>

            {/* Chart area */}
            <View style={styles.chartArea}>
                {/* 75% threshold line */}
                <View style={[styles.thresholdLine, { bottom: CHART_HEIGHT * 0.75 }]}>
                    <Text style={styles.thresholdLabel}>75%</Text>
                </View>

                {/* Bars */}
                <View style={styles.barsRow}>
                    {cumulativeData.map((d, idx) => {
                        const barHeight = (d.cumulativePct / 100) * CHART_HEIGHT;
                        const color =
                            d.status === 'none' || d.status === 'holiday' || d.status === 'cancelled'
                                ? COLORS.border
                                : d.cumulativePct >= 75
                                    ? COLORS.success
                                    : d.cumulativePct >= 60
                                        ? COLORS.warning
                                        : COLORS.danger;

                        return (
                            <View key={idx} style={styles.barColumn}>
                                <View style={[styles.barContainer, { height: CHART_HEIGHT }]}>
                                    <View
                                        style={[
                                            styles.bar,
                                            {
                                                height: Math.max(2, barHeight),
                                                backgroundColor: color,
                                                width: barWidth,
                                            },
                                        ]}
                                    />
                                </View>
                                <Text style={styles.dayLabel}>{d.day}</Text>
                            </View>
                        );
                    })}
                </View>
            </View>

            {/* Legend */}
            <View style={styles.legend}>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: COLORS.success }]} />
                    <Text style={styles.legendText}>≥75%</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: COLORS.warning }]} />
                    <Text style={styles.legendText}>60-74%</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: COLORS.danger }]} />
                    <Text style={styles.legendText}>&lt;60%</Text>
                </View>
            </View>
        </View>
    );
}

const getStyles = () => StyleSheet.create({
    container: {
        marginBottom: SPACING.md,
    },
    title: {
        ...TYPOGRAPHY.bodySmall,
        color: COLORS.textSecondary,
        marginBottom: SPACING.sm,
    },
    chartArea: {
        position: 'relative',
    },
    thresholdLine: {
        position: 'absolute',
        left: 0,
        right: 0,
        borderTopWidth: 1,
        borderTopColor: COLORS.danger,
        borderStyle: 'dashed',
        zIndex: 1,
        opacity: 0.4,
    },
    thresholdLabel: {
        position: 'absolute',
        right: 0,
        top: -14,
        ...TYPOGRAPHY.caption,
        color: COLORS.danger,
        fontSize: 10,
    },
    barsRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: SPACING.xs,
    },
    barColumn: {
        alignItems: 'center',
        flex: 1,
    },
    barContainer: {
        justifyContent: 'flex-end',
    },
    bar: {
        borderRadius: 3,
    },
    dayLabel: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        fontSize: 9,
        marginTop: 2,
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
        fontSize: 10,
    },
});
