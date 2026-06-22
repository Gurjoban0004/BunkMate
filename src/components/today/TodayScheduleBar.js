import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../../theme/theme';
import { parseTimeToMinutes } from '../../utils/dateHelpers';

const TodayScheduleBar = ({ todayClasses, attendanceRecords, todayKey, currentTime, nextClassInfo }) => {
    const styles = getStyles();

    const timeMarkerPosition = useMemo(() => {
        if (!todayClasses || todayClasses.length === 0) return null;

        const firstStart = parseTimeToMinutes(todayClasses[0].startTime);
        const lastEnd = parseTimeToMinutes(todayClasses[todayClasses.length - 1].endTime);
        const totalSpan = lastEnd - firstStart;
        if (totalSpan <= 0) return null;

        const now = currentTime || new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();

        if (nowMinutes < firstStart || nowMinutes > lastEnd) return null;
        return ((nowMinutes - firstStart) / totalSpan) * 100;
    }, [todayClasses, currentTime]);

    if (!todayClasses || todayClasses.length === 0) return null;

    const firstStart = parseTimeToMinutes(todayClasses[0].startTime);
    const lastEnd = parseTimeToMinutes(todayClasses[todayClasses.length - 1].endTime);
    const totalSpan = lastEnd - firstStart;

    return (
        <View style={styles.container}>
            <View style={styles.meta}>
                <Text style={styles.label}>Today's Schedule</Text>
                {nextClassInfo ? (
                    <Text style={styles.timeInfo}>{nextClassInfo}</Text>
                ) : null}
            </View>

            <View style={styles.track}>
                {todayClasses.map((c, idx) => {
                    const startMin = parseTimeToMinutes(c.startTime);
                    const endMin = parseTimeToMinutes(c.endTime);
                    const widthPct = totalSpan > 0 ? ((endMin - startMin) / totalSpan) * 100 : (100 / todayClasses.length);

                    const dayRecords = attendanceRecords?.[todayKey] || {};
                    const record = dayRecords[c.subjectId];
                    const status = record?.status;

                    const blockBg = status === 'present'
                        ? COLORS.successLight
                        : status === 'absent'
                            ? COLORS.dangerLight
                            : COLORS.inputBackground;

                    const shortName = c.subjectName.split(' ')[0];

                    return (
                        <View
                            key={`${c.subjectId}-${idx}`}
                            style={[
                                styles.classBlock,
                                {
                                    width: `${widthPct}%`,
                                    backgroundColor: blockBg,
                                    borderTopColor: c.color || COLORS.textMuted,
                                },
                                idx < todayClasses.length - 1 && styles.classBlockBorder,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.blockLabel,
                                    status && { color: COLORS.textPrimary },
                                ]}
                                numberOfLines={1}
                            >
                                {shortName}
                            </Text>
                        </View>
                    );
                })}

                {timeMarkerPosition !== null && (
                    <View style={[styles.timeMarker, { left: `${timeMarkerPosition}%` }]}>
                        <View style={styles.timeMarkerDot} />
                        <View style={styles.timeMarkerLine} />
                    </View>
                )}
            </View>
        </View>
    );
};

const getStyles = () => StyleSheet.create({
    container: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        marginHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.cardGap,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    meta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    label: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    timeInfo: {
        fontSize: 10,
        color: COLORS.textSecondary,
    },
    track: {
        height: 28,
        width: '100%',
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.md,
        flexDirection: 'row',
        overflow: 'hidden',
        position: 'relative',
    },
    classBlock: {
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        borderTopWidth: 3,
    },
    classBlockBorder: {
        borderRightWidth: 1,
        borderRightColor: COLORS.border,
    },
    blockLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: COLORS.textSecondary,
        paddingHorizontal: 2,
    },
    timeMarker: {
        position: 'absolute',
        top: -2,
        bottom: 0,
        width: 2,
        alignItems: 'center',
        zIndex: 10,
    },
    timeMarkerDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.primary,
        marginLeft: -3,
    },
    timeMarkerLine: {
        width: 2,
        flex: 1,
        backgroundColor: COLORS.primary,
    },
});

export default TodayScheduleBar;
