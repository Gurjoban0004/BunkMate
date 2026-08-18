import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS, TYPOGRAPHY } from '../../theme/theme';
import { parseTimeToMinutes } from '../../utils/dateHelpers';
import { shortSubjectName } from '../../utils/subjectName';

// A block on a 4-class day is ~80px wide at micro size, which fits about this
// many uppercase characters. Anything longer abbreviates rather than ellipses.
const BLOCK_NAME_BUDGET = 8;

/**
 * Where "now" sits on the track, as a 0–100 percentage — or null when the day
 * hasn't started or is over.
 *
 * Blocks are evenly spaced rather than time-scaled, so the marker is placed in
 * that same even space: which class we're in and how far through it, not what
 * fraction of the clock day has elapsed. A break parks the marker on the
 * boundary between the classes it separates.
 */
export const markerPercent = (classes, now) => {
    const n = classes?.length || 0;
    if (n === 0) return null;

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (nowMinutes < parseTimeToMinutes(classes[0].startTime)) return null;
    if (nowMinutes > parseTimeToMinutes(classes[n - 1].endTime)) return null;

    for (let i = 0; i < n; i++) {
        const start = parseTimeToMinutes(classes[i].startTime);
        const end = parseTimeToMinutes(classes[i].endTime);
        if (nowMinutes < start) return (i / n) * 100;   // in the break before class i
        if (nowMinutes <= end) {
            const within = end > start ? (nowMinutes - start) / (end - start) : 0;
            return ((i + within) / n) * 100;
        }
    }
    return null;
};

const TodayScheduleBar = ({ todayClasses, attendanceRecords, todayKey, currentTime, nextClassInfo }) => {
    const styles = getStyles();

    const timeMarkerPosition = useMemo(
        () => markerPercent(todayClasses, currentTime || new Date()),
        [todayClasses, currentTime],
    );

    if (!todayClasses || todayClasses.length === 0) return null;

    return (
        <View style={styles.container}>
            <View style={styles.meta}>
                <Text style={styles.label}>Today's Schedule</Text>
                {nextClassInfo ? (
                    <Text style={styles.timeInfo}>{nextClassInfo}</Text>
                ) : null}
            </View>

            <View style={styles.track}>
                {/* Even blocks, not time-scaled. Scaling by duration left a dead
                    slot wherever the timetable has a break, which read as a
                    rendering gap rather than as free time. */}
                {todayClasses.map((c, idx) => {
                    const dayRecords = attendanceRecords?.[todayKey] || {};
                    const record = dayRecords[c.subjectId];
                    const status = record?.status;

                    const blockBg = status === 'present'
                        ? COLORS.successLight
                        : status === 'absent'
                            ? COLORS.dangerLight
                            : COLORS.inputBackground;

                    return (
                        <View
                            key={`${c.subjectId}-${idx}`}
                            style={[
                                styles.classBlock,
                                {
                                    backgroundColor: blockBg,
                                    borderTopColor: c.color || COLORS.textMuted,
                                },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.blockLabel,
                                    status && { color: COLORS.textPrimary },
                                ]}
                                numberOfLines={1}
                            >
                                {shortSubjectName(c.subjectName, BLOCK_NAME_BUDGET)}
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
        borderRadius: BORDER_RADIUS.md,
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
        marginBottom: 12,
    },
    label: {
        ...TYPOGRAPHY.labelMedium,
        color: COLORS.textPrimary,
    },
    timeInfo: {
        ...TYPOGRAPHY.captionSmall,
        color: COLORS.textSecondary,
    },
    track: {
        flexDirection: 'row',
        height: 36,
        width: '100%',
        borderRadius: BORDER_RADIUS.md,
        overflow: 'hidden',
        position: 'relative',
        gap: 2,
    },
    classBlock: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderTopWidth: 3,
    },
    blockLabel: {
        ...TYPOGRAPHY.micro,
        color: COLORS.textSecondary,
        paddingHorizontal: 4,
        textAlign: 'center',
    },
    timeMarker: {
        position: 'absolute',
        top: -4,
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
