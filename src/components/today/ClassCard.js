import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
} from 'react-native';
import { triggerHaptic } from '../../utils/haptics';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, TYPOGRAPHY } from '../../theme/theme';
import { getSubjectAttendance } from '../../utils/attendance';
import { getTodayKey, formatTimeRange } from '../../utils/dateHelpers';

const ClassCard = ({
    classInfo,
    state,
    onMark,
    isCurrentClass = false,
    isPreCounted = false,
    freshnessData = null,
}) => {
    const styles = getStyles();
    const { subjectId, subjectName, startTime, endTime, units } = classInfo;

    const subject = state.subjects.find(s => s.id === subjectId);
    const color = subject?.color || COLORS.primary;

    const stats = getSubjectAttendance(subjectId, state);
    const percentage = stats?.percentage || 0;
    const attendedUnits = stats?.attendedUnits || 0;
    const totalUnits = stats?.totalUnits || 0;

    const todayKey = getTodayKey(state.devDate);
    const todayRecord = state.attendanceRecords[todayKey]?.[subjectId];
    const markedStatus = todayRecord?.status;
    const isSyncedFromErp = todayRecord?.source === 'erp';

    const isPredicted = freshnessData ? freshnessData.hasPrediction : (todayRecord?.source === 'prediction');

    const dangerThreshold = state.settings?.dangerThreshold || 75;
    const isDanger = percentage < dangerThreshold;
    const isEdge = percentage >= dangerThreshold && percentage < dangerThreshold + 3;

    const scaleAnim = useRef(new Animated.Value(1)).current;

    const [previousPercentage, setPreviousPercentage] = useState(percentage);
    const [showChange, setShowChange] = useState(false);
    const percentageChange = percentage - previousPercentage;

    const handleMark = (status) => {
        triggerHaptic('medium');

        Animated.sequence([
            Animated.timing(scaleAnim, {
                toValue: 0.97,
                duration: 80,
                useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 80,
                useNativeDriver: true,
            }),
        ]).start();

        setPreviousPercentage(percentage);
        setShowChange(true);
        setTimeout(() => setShowChange(false), 3000);
        onMark(subjectId, status, units);
    };

    const handleUndo = () => {
        setPreviousPercentage(percentage);
        setShowChange(false);
        onMark(subjectId, null, units);
    };

    const classesNeeded = calculateClassesNeeded(attendedUnits, totalUnits, dangerThreshold, units);

    const getCardBorderColor = () => {
        if (markedStatus === 'present') return COLORS.success;
        if (markedStatus === 'absent') return COLORS.danger;
        if (isCurrentClass) return COLORS.primary;
        return COLORS.border;
    };

    const getCardBg = () => {
        if (markedStatus === 'present') return COLORS.successLight;
        if (markedStatus === 'absent') return COLORS.dangerLight;
        return COLORS.cardBackground;
    };

    if (isPreCounted) {
        return (
            <View style={[styles.container, { backgroundColor: COLORS.cardBackground, opacity: 0.7 }]}>
                <View style={[styles.colorDot, { backgroundColor: COLORS.border }]} />
                <View style={styles.content}>
                    <View style={styles.headerRow}>
                        <View style={styles.subjectInfo}>
                            <Text style={[styles.subjectName, { color: COLORS.textMuted }]}>{subjectName}</Text>
                            <View style={styles.timeRow}>
                                <Text style={[styles.time, { color: COLORS.textMuted }]}>
                                    {formatTimeRange(startTime, endTime)}
                                </Text>
                            </View>
                        </View>
                    </View>
                    <View style={styles.preCountedBadge}>
                        <Text style={styles.preCountedText}>INCLUDED IN SETUP</Text>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [{ scale: scaleAnim }],
                    backgroundColor: getCardBg(),
                    borderColor: getCardBorderColor(),
                },
                isCurrentClass && styles.currentClassBorder,
            ]}
        >
            <View style={[styles.colorDot, { backgroundColor: color }]} />

            <View style={styles.content}>
                <View style={styles.headerRow}>
                    <View style={styles.subjectInfo}>
                        <Text style={styles.subjectName} numberOfLines={1}>{subjectName}</Text>
                        <View style={styles.timeRow}>
                            <Text style={styles.time}>
                                {formatTimeRange(startTime, endTime)}
                            </Text>
                            {units > 1 && (
                                <View style={styles.durationBadge}>
                                    <Text style={styles.durationBadgeText}>{units} HR</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Status tags — text only, no emojis */}
                    {!markedStatus && !isDanger && !isEdge && percentage >= (dangerThreshold + 10) && (
                        <View style={[styles.statusTag, { backgroundColor: COLORS.successLight, borderColor: COLORS.success }]}>
                            <Text style={[styles.statusTagText, { color: COLORS.success }]}>SAFE</Text>
                        </View>
                    )}
                    {!markedStatus && isDanger && (
                        <View style={[styles.statusTag, { backgroundColor: COLORS.dangerLight, borderColor: COLORS.danger }]}>
                            <Text style={[styles.statusTagText, { color: COLORS.danger }]}>LOW</Text>
                        </View>
                    )}
                    {!markedStatus && isEdge && (
                        <View style={[styles.statusTag, { backgroundColor: COLORS.warningLight, borderColor: COLORS.warning }]}>
                            <Text style={[styles.statusTagText, { color: COLORS.warning }]}>EDGE</Text>
                        </View>
                    )}
                </View>

                {/* Progress Row */}
                <View style={styles.progressRow}>
                    <View style={styles.progressBarTrack}>
                        <View
                            style={[
                                styles.progressBarFill,
                                {
                                    width: `${Math.min(percentage, 100)}%`,
                                    backgroundColor: isDanger ? COLORS.danger :
                                        isEdge ? COLORS.warning : COLORS.success,
                                },
                            ]}
                        />
                    </View>

                    <View style={styles.percentageContainer}>
                        <Text style={[styles.percentage, isDanger && { color: COLORS.danger }]}>
                            {percentage.toFixed(1)}%
                        </Text>

                        {showChange && percentageChange !== 0 && (
                            <View style={[
                                styles.changeBadge,
                                { backgroundColor: percentageChange > 0 ? COLORS.successLight : COLORS.dangerLight },
                            ]}>
                                <Text style={[
                                    styles.changeText,
                                    { color: percentageChange > 0 ? COLORS.successDark : COLORS.dangerDark },
                                ]}>
                                    {percentageChange > 0 ? '+' : ''}{percentageChange.toFixed(1)}%
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Danger Warning */}
                {isDanger && !markedStatus && (
                    <View style={styles.warningRow}>
                        <Text style={styles.warningText}>
                            Attend {classesNeeded} more to reach {dangerThreshold}%
                        </Text>
                    </View>
                )}

                {/* Action Buttons — clean text tags, no emojis */}
                {markedStatus ? (
                    <View style={styles.buttonRow}>
                        <View style={[
                            styles.actionButton,
                            markedStatus === 'present' ? styles.presentButton : styles.absentButton,
                            { flex: 1 },
                        ]}>
                            <Text style={markedStatus === 'present' ? styles.presentButtonText : styles.absentButtonText}>
                                {markedStatus === 'present' ? 'PRESENT' : 'ABSENT'}
                                {isSyncedFromErp ? '  ·  Portal' : ''}
                                {isPredicted && !isSyncedFromErp ? '  ·  Predicted' : ''}
                            </Text>
                        </View>

                        {!isSyncedFromErp && (
                            <TouchableOpacity
                                style={[styles.actionButton, styles.undoButton]}
                                onPress={handleUndo}
                            >
                                <Text style={styles.undoButtonText}>Undo</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    <View style={styles.buttonRow}>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.presentButton]}
                            onPress={() => handleMark('present')}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.presentButtonText}>Attend</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionButton, styles.absentButton]}
                            onPress={() => handleMark('absent')}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.absentButtonText}>Bunk</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </Animated.View>
    );
};

const calculateClassesNeeded = (attended, total, target, units = 1) => {
    const targetDecimal = target / 100;
    if (targetDecimal >= 1) return Infinity;
    const divisor = 1 - targetDecimal;
    const neededUnits = Math.ceil((targetDecimal * total - attended) / divisor);
    return Math.max(0, Math.ceil(Math.max(0, neededUnits) / units));
};

const getStyles = () => StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: COLORS.cardBackground,
        marginHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.sm,
        borderRadius: BORDER_RADIUS.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    currentClassBorder: {
        borderWidth: 2,
    },
    colorDot: {
        position: 'absolute',
        left: 16,
        top: 20,
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    content: {
        flex: 1,
        padding: 16,
        paddingLeft: 36,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    subjectInfo: {
        flex: 1,
    },
    subjectName: {
        ...TYPOGRAPHY.headingSmall,
        color: COLORS.textPrimary,
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    time: {
        ...TYPOGRAPHY.bodySmall,
        color: COLORS.textSecondary,
    },
    durationBadge: {
        backgroundColor: COLORS.inputBackground,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 3,
        marginLeft: SPACING.sm,
    },
    durationBadgeText: {
        ...TYPOGRAPHY.micro,
        color: COLORS.textSecondary,
    },
    statusTag: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: BORDER_RADIUS.sm,
        borderWidth: 1,
        marginLeft: SPACING.sm,
    },
    statusTagText: {
        ...TYPOGRAPHY.micro,
    },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 14,
    },
    progressBarTrack: {
        flex: 1,
        height: 6,
        backgroundColor: COLORS.inputBackground,
        borderRadius: 3,
        marginRight: 10,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    percentageContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    percentage: {
        ...TYPOGRAPHY.displaySmall,
        color: COLORS.textPrimary,
        minWidth: 44,
        textAlign: 'right',
    },
    changeBadge: {
        marginLeft: 4,
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
    },
    changeText: {
        ...TYPOGRAPHY.micro,
    },
    warningRow: {
        marginTop: 8,
        backgroundColor: COLORS.warningLight,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.sm,
        borderWidth: 1,
        borderColor: COLORS.warning,
    },
    warningText: {
        ...TYPOGRAPHY.labelSmall,
        color: COLORS.warningDark,
    },
    buttonRow: {
        flexDirection: 'row',
        marginTop: 14,
        gap: SPACING.sm,
    },
    actionButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: BORDER_RADIUS.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    presentButton: {
        backgroundColor: COLORS.successLight,
        borderWidth: 1,
        borderColor: COLORS.success,
    },
    presentButtonText: {
        ...TYPOGRAPHY.labelMedium,
        color: COLORS.successDark,
    },
    absentButton: {
        backgroundColor: COLORS.dangerLight,
        borderWidth: 1,
        borderColor: COLORS.danger,
    },
    absentButtonText: {
        ...TYPOGRAPHY.labelMedium,
        color: COLORS.dangerDark,
    },
    undoButton: {
        backgroundColor: COLORS.inputBackground,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    undoButtonText: {
        ...TYPOGRAPHY.labelMedium,
        color: COLORS.textSecondary,
    },
    preCountedBadge: {
        marginTop: 8,
    },
    preCountedText: {
        ...TYPOGRAPHY.micro,
        color: COLORS.success,
    },
});

export default ClassCard;
