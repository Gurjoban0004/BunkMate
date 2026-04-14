import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Platform,
} from 'react-native';
import { triggerHaptic } from '../../utils/haptics';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS, FONT_SIZES } from '../../theme/theme';
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

    // Get subject data
    const subject = state.subjects.find(s => s.id === subjectId);
    const color = subject?.color || COLORS.primary;

    // Get current attendance
    const stats = getSubjectAttendance(subjectId, state);
    const percentage = stats?.percentage || 0;
    const attendedUnits = stats?.attendedUnits || 0;
    const totalUnits = stats?.totalUnits || 0;

    // Get today's record
    const todayKey = getTodayKey(state.devDate);
    const todayRecord = state.attendanceRecords[todayKey]?.[subjectId];
    const markedStatus = todayRecord?.status; // 'present', 'absent', or undefined
    const isSyncedFromErp = todayRecord?.source === 'erp';

    // Freshness Engine drives predicted vs confirmed
    const isPredicted = freshnessData ? freshnessData.hasPrediction : (todayRecord?.source === 'prediction');
    // If not predicted and it has a status, but is NOT explicitly confirmed, we can assume it's a gap fallback.

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
        // Haptic feedback (handled cross-platform by wrapper)
        triggerHaptic('medium');

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
        setPreviousPercentage(percentage); // reset so change indicator is clean
        setShowChange(false);
        onMark(subjectId, null, units); // null status removes the record
    };

    // Calculate what classes needed to reach threshold
    // For 2-hour classes (units > 1), divide by units to show real class count
    const classesNeeded = calculateClassesNeeded(attendedUnits, totalUnits, dangerThreshold, units);

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
            {/* Color Accent Dot */}
            <View style={[styles.colorBar, { backgroundColor: color }]} />

            <View style={styles.content}>
                {/* Header Row - Subject name + time on left, badge on right */}
                <View style={styles.headerRow}>
                    <View style={styles.subjectInfo}>
                        <Text style={styles.subjectName}>{subjectName}</Text>
                        <View style={styles.timeContainer}>
                            <Text style={styles.time}>
                                {formatTimeRange(startTime, endTime)}
                            </Text>
                            {units > 1 && (
                                <View style={styles.durationBadge}>
                                    <Text style={styles.durationBadgeText}>{units}-HR</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Status Badge or Safe indicator */}
                    {!isDanger && !markedStatus && percentage >= (dangerThreshold + 10) && (
                        <View style={[styles.durationBadge, { backgroundColor: COLORS.successLight, marginLeft: 8 }]}>
                            <Text style={[styles.durationBadgeText, { color: COLORS.success }]}>SAFE</Text>
                        </View>
                    )}
                    {isDanger && !markedStatus && (
                        <View style={[styles.durationBadge, { backgroundColor: COLORS.dangerLight, marginLeft: 8 }]}>
                            <Text style={[styles.durationBadgeText, { color: COLORS.danger }]}>LOW</Text>
                        </View>
                    )}
                    {isEdge && !markedStatus && (
                        <View style={[styles.durationBadge, { backgroundColor: COLORS.warningLight, marginLeft: 8 }]}>
                            <Text style={[styles.durationBadgeText, { color: COLORS.warning }]}>EDGE</Text>
                        </View>
                    )}
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
                    <View style={styles.buttonRow}>
                        <View style={[
                            styles.actionButton,
                            markedStatus === 'present' ? styles.presentButton : styles.absentButton,
                            { flex: 1 },
                        ]}>
                            <Text style={markedStatus === 'present' ? styles.presentButtonText : styles.absentButtonText}>
                                {markedStatus === 'present' ? '✓ Present' : '✕ Absent'}
                                {isSyncedFromErp && ' (ERP)'}
                                {isPredicted && !isSyncedFromErp && ' (Predicted)'}
                            </Text>
                        </View>

                        {!isSyncedFromErp && (
                            <TouchableOpacity
                                style={[styles.actionButton, { backgroundColor: COLORS.inputBackground, borderWidth: 1, borderColor: COLORS.border }]}
                                onPress={handleUndo}
                            >
                                <Text style={{ color: COLORS.textSecondary, fontWeight: '600' }}>Undo</Text>
                            </TouchableOpacity>
                        )}
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
                                ✓ Present
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionButton, styles.absentButton]}
                            onPress={() => handleMark('absent')}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.absentButtonText}>
                                ✕ Absent
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </Animated.View>
    );
};

// Helper function — returns real class count (not inflated units for 2-hr classes)
const calculateClassesNeeded = (attended, total, target, units = 1) => {
    const targetDecimal = target / 100;
    if (targetDecimal >= 1) return Infinity;
    const divisor = 1 - targetDecimal;
    const neededUnits = Math.ceil((targetDecimal * total - attended) / divisor);
    // Divide by units to convert from "marks" to "physical classes"
    return Math.max(0, Math.ceil(Math.max(0, neededUnits) / units));
};

const getStyles = () => StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: COLORS.cardBackground,
        marginHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.cardGap,
        borderRadius: BORDER_RADIUS.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.borderLight,
        ...SHADOWS.small,
    },
    currentClassShadow: {
        ...SHADOWS.large,
        borderWidth: 2,
        borderColor: COLORS.primary,
    },
    colorBar: {
        position: 'absolute',
        left: 14,
        top: 14,
        width: 6,
        height: 6,
        borderRadius: 3,
        shadowColor: 'currentColor',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 6,
        elevation: 4,
    },
    content: {
        flex: 1,
        padding: 12,
        paddingLeft: 28,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 6,
    },
    subjectInfo: {
        flex: 1,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    subjectName: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.textPrimary,
        lineHeight: 22,
    },
    timeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    time: {
        fontSize: 13,
        fontWeight: '500',
        color: COLORS.textSecondary,
    },
    durationBadge: {
        backgroundColor: COLORS.primaryLight,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: BORDER_RADIUS.sm,
        marginLeft: SPACING.sm,
    },
    durationBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.primary,
        letterSpacing: 0.5,
    },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    progressBarContainer: {
        flex: 1,
        height: 5,
        backgroundColor: COLORS.border,
        borderRadius: 3,
        marginRight: 10,
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
        fontSize: 14,
        fontWeight: '800',
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
        marginTop: 8,
        backgroundColor: COLORS.warningLight,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: BORDER_RADIUS.sm,
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.3)',
    },
    warningText: {
        fontSize: 12,
        color: COLORS.warningDark,
        fontWeight: '600',
    },
    buttonRow: {
        flexDirection: 'row',
        marginTop: 12,
        gap: SPACING.sm,
    },
    actionButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: BORDER_RADIUS.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    presentButton: {
        backgroundColor: COLORS.successLight,
        borderWidth: 1,
        borderColor: COLORS.success,
    },
    presentButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.successDark,
    },
    absentButton: {
        backgroundColor: COLORS.dangerLight,
        borderWidth: 1,
        borderColor: COLORS.danger,
    },
    absentButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.dangerDark,
    },
});

export default ClassCard;
