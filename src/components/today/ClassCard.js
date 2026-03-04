import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS, FONT_SIZES } from '../../theme/theme';
import { getSubjectAttendance } from '../../utils/attendance';
import { getTodayKey, formatTimeRange } from '../../utils/dateHelpers';

const ClassCard = ({
    classInfo,
    state,
    onMark,
    isCurrentClass = false,
    isPreCounted = false,
}) => {
    const { subjectId, subjectName, startTime, endTime, units } = classInfo;

    // Get subject data
    const subject = state.subjects.find(s => s.id === subjectId);
    const color = subject?.color || COLORS.primary;

    // Get current attendance
    const stats = getSubjectAttendance(subjectId, state);
    const percentage = stats?.percentage || 0;
    const attendedUnits = stats?.attendedUnits || 0;
    const totalUnits = stats?.totalUnits || 0;

    // Get today's record
    const todayKey = getTodayKey();
    const todayRecord = state.attendanceRecords[todayKey]?.[subjectId];
    const markedStatus = todayRecord?.status; // 'present', 'absent', or undefined

    // Calculate danger threshold (from settings or default 75)
    const dangerThreshold = state.settings?.dangerThreshold || 75;
    const isDanger = percentage < dangerThreshold;
    const isEdge = percentage >= dangerThreshold && percentage < dangerThreshold + 3;

    // Animation refs
    const scaleAnim = useRef(new Animated.Value(1)).current;

    // Previous percentage for showing change
    const [previousPercentage, setPreviousPercentage] = useState(percentage);
    const [showChange, setShowChange] = useState(false);
    const percentageChange = percentage - previousPercentage;

    // Handle mark attendance
    const handleMark = (status) => {
        // Haptic feedback
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }

        // Button press animation
        Animated.sequence([
            Animated.timing(scaleAnim, {
                toValue: 0.95,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 100,
                useNativeDriver: true,
            }),
        ]).start();

        // Store current percentage before update
        setPreviousPercentage(percentage);
        setShowChange(true);

        // Hide change indicator after 3 seconds
        setTimeout(() => setShowChange(false), 3000);

        // Call parent handler
        onMark(subjectId, status, units);
    };

    // Handle undo
    const handleUndo = () => {
        onMark(subjectId, null, units); // null status removes the record
        setShowChange(false);
    };

    // Calculate what classes needed to reach threshold
    const classesNeeded = calculateClassesNeeded(attendedUnits, totalUnits, dangerThreshold);

    // Determine card background based on state
    const getCardStyle = () => {
        if (markedStatus === 'present') {
            return { backgroundColor: COLORS.successLight, borderColor: COLORS.success };
        }
        if (markedStatus === 'absent') {
            return { backgroundColor: COLORS.dangerLight, borderColor: COLORS.danger };
        }
        if (isCurrentClass) {
            return { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary };
        }
        return { backgroundColor: COLORS.cardBackground, borderColor: COLORS.border };
    };

    const cardStyle = getCardStyle();

    if (isPreCounted) {
        return (
            <View style={[styles.container, { backgroundColor: COLORS.cardBackground, opacity: 0.8 }]}>
                <View style={[styles.colorBar, { backgroundColor: COLORS.border }]} />
                <View style={styles.content}>
                    <View style={styles.headerRow}>
                        <View style={styles.subjectInfo}>
                            <View style={styles.titleRow}>
                                <Text style={[styles.subjectName, { color: COLORS.textSecondary }]}>{subjectName}</Text>
                                {units > 1 && (
                                    <View style={[styles.durationBadge, { backgroundColor: COLORS.inputBackground }]}>
                                        <Text style={[styles.durationBadgeText, { color: COLORS.textSecondary }]}>{units}-HR CLASS</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                        <View style={[styles.timeContainer, { backgroundColor: COLORS.background }]}>
                            <Text style={[styles.time, { color: COLORS.textSecondary }]}>
                                {formatTimeRange(startTime, endTime)}
                            </Text>
                        </View>
                    </View>
                    <View style={{ marginTop: SPACING.md, flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontSize: FONT_SIZES.sm, color: COLORS.success, fontWeight: '600' }}>
                            ✓ Included in setup
                        </Text>
                    </View>
                </View >
            </View >
        );
    }

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [{ scale: scaleAnim }],
                    backgroundColor: cardStyle.backgroundColor,

                },
                isCurrentClass && styles.currentClassShadow,
            ]}
        >
            {/* Color Accent Bar */}
            <View style={[styles.colorBar, { backgroundColor: color }]} />

            <View style={styles.content}>
                {/* Header Row */}
                <View style={styles.headerRow}>
                    <View style={styles.subjectInfo}>
                        <View style={styles.titleRow}>
                            <Text style={styles.subjectName}>{subjectName}</Text>
                            {units > 1 && (
                                <View style={styles.durationBadge}>
                                    <Text style={styles.durationBadgeText}>{units}-HR CLASS</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    <View style={styles.timeContainer}>
                        <Text style={styles.time}>
                            {formatTimeRange(startTime, endTime)}
                        </Text>
                    </View>
                </View>

                {/* Progress Row */}
                <View style={styles.progressRow}>
                    <View style={styles.progressBarContainer}>
                        <View
                            style={[
                                styles.progressBar,
                                {
                                    width: `${Math.min(percentage, 100)}%`,
                                    backgroundColor: isDanger ? COLORS.danger :
                                        isEdge ? COLORS.warning :
                                            COLORS.success,
                                },
                            ]}
                        />
                    </View>

                    <View style={styles.percentageContainer}>
                        <Text
                            style={[
                                styles.percentage,
                                isDanger && styles.percentageDanger,
                            ]}
                        >
                            {percentage.toFixed(1)}%
                        </Text>

                        {/* Show change indicator */}
                        {showChange && percentageChange !== 0 && (
                            <View style={[
                                styles.changeBadge,
                                percentageChange > 0 ? styles.changePositive : styles.changeNegative,
                            ]}>
                                <Text style={styles.changeText}>
                                    {percentageChange > 0 ? '↑' : '↓'} {Math.abs(percentageChange).toFixed(1)}%
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

                {/* Action Buttons or Status */}
                {markedStatus ? (
                    // Already marked - show status and undo
                    <View style={styles.markedContainer}>
                        <View style={[
                            styles.statusBadge,
                            markedStatus === 'present' ? styles.statusPresent : styles.statusAbsent,
                        ]}>
                            <Text style={styles.statusEmoji}>
                                {markedStatus === 'present' ? '✅' : '❌'}
                            </Text>
                            <Text style={[
                                styles.statusText,
                                markedStatus === 'present' ? styles.statusTextPresent : styles.statusTextAbsent,
                            ]}>
                                Marked {markedStatus === 'present' ? 'Present' : 'Absent'}
                                {units > 1 && ` (${units} marks)`}
                            </Text>
                        </View>

                        <TouchableOpacity style={styles.undoButton} onPress={handleUndo}>
                            <Text style={styles.undoText}>Undo</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    // Not marked - show buttons
                    <View style={styles.buttonRow}>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.presentButton]}
                            onPress={() => handleMark('present')}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.presentButtonText}>
                                Present {units > 1 && `(${units} marks)`}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionButton, styles.absentButton]}
                            onPress={() => handleMark('absent')}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.absentButtonText}>
                                Absent
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </Animated.View>
    );
};

// Helper function
const calculateClassesNeeded = (attended, total, target) => {
    const targetDecimal = target / 100;
    const needed = Math.ceil((targetDecimal * total - attended) / (1 - targetDecimal));
    return Math.max(0, needed);
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: COLORS.cardBackground,
        marginHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.cardGap,
        borderRadius: BORDER_RADIUS.lg,
        overflow: 'hidden',
        ...SHADOWS.small,
    },
    currentClassShadow: {
        ...SHADOWS.large,
    },
    colorBar: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
    },
    content: {
        flex: 1,
        padding: SPACING.cardPadding,
        paddingLeft: SPACING.cardPadding + 4,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    subjectInfo: {
        flex: 1,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginBottom: 2,
    },
    subjectName: {
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginRight: SPACING.sm,
    },
    durationBadge: {
        backgroundColor: COLORS.primaryLight,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: BORDER_RADIUS.sm,
    },
    durationBadgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: COLORS.primary,
        letterSpacing: 0.5,
    },
    timeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.inputBackground,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.sm,
    },
    time: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    timeDivider: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
        marginHorizontal: 4,
    },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: SPACING.sm,
    },
    progressBarContainer: {
        flex: 1,
        height: 6,
        backgroundColor: COLORS.border,
        borderRadius: 3,
        marginRight: SPACING.sm,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        borderRadius: 3,
    },
    percentageContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    percentage: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '700',
        color: COLORS.textPrimary,
        minWidth: 48,
        textAlign: 'right',
    },
    percentageDanger: {
        color: COLORS.danger,
    },
    changeBadge: {
        marginLeft: SPACING.xs,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    changePositive: {
        backgroundColor: COLORS.successLight,
    },
    changeNegative: {
        backgroundColor: COLORS.dangerLight,
    },
    changeText: {
        fontSize: 10,
        fontWeight: '600',
    },
    warningRow: {
        marginTop: SPACING.sm,
        backgroundColor: COLORS.warningLight,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 6,
        borderRadius: BORDER_RADIUS.sm,
    },
    warningText: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.warningDark,
        fontWeight: '500',
    },
    buttonRow: {
        flexDirection: 'row',
        marginTop: SPACING.md,
        gap: SPACING.sm,
    },
    actionButton: {
        flex: 1,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    presentButton: {
        backgroundColor: COLORS.successLight,

    },
    presentButtonText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.successDark,
    },
    absentButton: {
        backgroundColor: COLORS.dangerLight,

    },
    absentButtonText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.dangerDark,
    },
    markedContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: SPACING.md,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.sm,
        paddingVertical: 6,
        borderRadius: BORDER_RADIUS.sm,
    },
    statusPresent: {
        backgroundColor: COLORS.successLight,
    },
    statusAbsent: {
        backgroundColor: COLORS.dangerLight,
    },
    statusEmoji: {
        fontSize: 14,
        marginRight: 6,
    },
    statusText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
    },
    statusTextPresent: {
        color: COLORS.successDark,
    },
    statusTextAbsent: {
        color: COLORS.dangerDark,
    },
    undoButton: {
        paddingHorizontal: SPACING.md,
        paddingVertical: 6,
    },
    undoText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.primary,
        fontWeight: '600',
    },
});

export default ClassCard;
