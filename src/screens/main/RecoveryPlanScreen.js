import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
} from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import { getSubjectAttendance } from '../../utils/attendance';
import { getRecoveryNeeded, getRecoverySteps, getClassesForDay } from '../../utils/planner';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const RecoveryPlanScreen = ({ route }) => {
    const styles = getStyles();
    const { state } = useApp();
    const { subjectId, subjectName, threshold = 75 } = route.params || {};

    const data = useMemo(() => {
        const stats = getSubjectAttendance(subjectId, state);
        if (!stats) return null;

        const needed = getRecoveryNeeded(stats.attendedUnits, stats.totalUnits, threshold);
        const steps = getRecoverySteps(stats.attendedUnits, stats.totalUnits, needed, threshold);

        // Get weekly schedule for this subject
        const schedule = [];
        let weeklyUnits = 0;
        DAY_NAMES.forEach((day) => {
            const classes = getClassesForDay(state, day);
            classes.forEach((cls) => {
                if (cls.subjectId === subjectId) {
                    schedule.push({ day, startTime: cls.startTime, endTime: cls.endTime, units: cls.units });
                    weeklyUnits += cls.units;
                }
            });
        });

        const weeksToRecover = weeklyUnits > 0 ? Math.ceil(needed / weeklyUnits) : null;
        const today = new Date();
        const recoveryDate = weeksToRecover
            ? new Date(today.getTime() + weeksToRecover * 7 * 24 * 60 * 60 * 1000)
            : null;

        return {
            ...stats,
            needed,
            steps,
            schedule,
            weeklyUnits,
            weeksToRecover,
            recoveryDate,
        };
    }, [subjectId, state, threshold]);

    if (!data) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={styles.emptyText}>Subject not found</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Subject name & current status */}
                <Text style={styles.pageTitle}>🏥 Recovery Plan</Text>
                <Text style={styles.subjectName}>{subjectName}</Text>
                <Text style={styles.currentInfo}>
                    Current: {data.percentage.toFixed(1)}% ({data.attendedUnits}/{data.totalUnits} marks)
                </Text>
                <Text style={styles.targetInfo}>Target: {threshold}%</Text>

                {/* Big Number Card */}
                <View style={styles.bigCard}>
                    <Text style={styles.bigLabel}>You need to attend:</Text>
                    <Text style={styles.bigNumber}>{data.needed}</Text>
                    <Text style={styles.bigUnit}>consecutive classes</Text>
                    <Text style={styles.bigNote}>without missing any</Text>
                </View>

                {/* Progress Visualization */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Progress Visualization</Text>
                    <View style={styles.progressCard}>
                        {data.steps.map((step, i) => (
                            <View key={i} style={styles.progressRow}>
                                <Text style={styles.progressLabel}>
                                    {step.classesAttended === 0 ? 'Now:' : `+${step.classesAttended} cls:`}
                                </Text>
                                <View style={styles.progressBarContainer}>
                                    <View style={[
                                        styles.progressBar,
                                        {
                                            width: `${Math.min(step.percentage, 100)}%`,
                                            backgroundColor: step.reachedTarget ? COLORS.success : COLORS.warning,
                                        },
                                    ]} />
                                </View>
                                <Text style={[
                                    styles.progressPercent,
                                    step.reachedTarget && { color: COLORS.success },
                                ]}>
                                    {step.percentage.toFixed(0)}% {step.reachedTarget ? '✅' : ''}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Schedule */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Your {subjectName} Schedule</Text>
                    <View style={styles.scheduleCard}>
                        {data.schedule.map((slot, i) => (
                            <View key={i} style={styles.scheduleRow}>
                                <Text style={styles.scheduleDay}>{slot.day}</Text>
                                <Text style={styles.scheduleTime}>
                                    {slot.startTime} - {slot.endTime}
                                </Text>
                                <Text style={styles.scheduleUnits}>
                                    ({slot.units} mark{slot.units > 1 ? 's' : ''})
                                </Text>
                            </View>
                        ))}
                        <View style={styles.scheduleDivider} />
                        <Text style={styles.scheduleTotal}>
                            Total per week: {data.weeklyUnits} marks
                        </Text>
                    </View>
                </View>

                {/* Warning */}
                <View style={styles.warningCard}>
                    <Text style={styles.warningTitle}>Important</Text>
                    <Text style={styles.warningText}>
                        Missing even ONE class extends recovery by 1–2 extra classes!
                    </Text>
                </View>

                {/* Estimated recovery date */}
                {data.recoveryDate && (
                    <Text style={styles.estimateText}>
                        Estimated recovery: {data.recoveryDate.toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric',
                        })}
                        {'\n'}
                        <Text style={styles.estimateNote}>
                            (If you attend all {subjectName} classes)
                        </Text>
                    </Text>
                )}

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const getStyles = () => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: SPACING.lg,
        paddingHorizontal: SPACING.lg,
    },
    emptyText: {
        fontSize: FONT_SIZES.md,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginTop: 100,
    },
    pageTitle: {
        fontSize: FONT_SIZES.xl,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    subjectName: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginTop: SPACING.xs,
    },
    currentInfo: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        marginTop: SPACING.xs,
    },
    targetInfo: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        marginBottom: SPACING.lg,
    },
    bigCard: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.xl,
        alignItems: 'center',
        marginBottom: SPACING.lg,


        ...SHADOWS.medium,
    },
    bigLabel: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
    },
    bigNumber: {
        fontSize: 64,
        fontWeight: '700',
        color: COLORS.danger,
        lineHeight: 72,
    },
    bigUnit: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '500',
        color: COLORS.textPrimary,
    },
    bigNote: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textMuted,
        marginTop: SPACING.xs,
    },
    section: {
        marginBottom: SPACING.lg,
    },
    sectionTitle: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginBottom: SPACING.sm,
    },
    progressCard: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,


    },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    progressLabel: {
        width: 65,
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
    },
    progressBarContainer: {
        flex: 1,
        height: 8,
        backgroundColor: COLORS.border,
        borderRadius: 4,
        marginHorizontal: SPACING.sm,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        borderRadius: 4,
    },
    progressPercent: {
        width: 55,
        fontSize: FONT_SIZES.xs,
        fontWeight: '600',
        color: COLORS.textSecondary,
        textAlign: 'right',
    },
    scheduleCard: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,


    },
    scheduleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.xs,
    },
    scheduleDay: {
        width: 80,
        fontSize: FONT_SIZES.sm,
        fontWeight: '500',
        color: COLORS.textPrimary,
    },
    scheduleTime: {
        flex: 1,
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
    },
    scheduleUnits: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
    },
    scheduleDivider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginVertical: SPACING.sm,
    },
    scheduleTotal: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    warningCard: {
        backgroundColor: COLORS.warningLight,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,


        marginBottom: SPACING.md,
    },
    warningTitle: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.warningDark,
        marginBottom: 4,
    },
    warningText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.warningDark,
    },
    estimateText: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.textPrimary,
        textAlign: 'center',
    },
    estimateNote: {
        fontSize: FONT_SIZES.sm,
        fontWeight: 'normal',
        color: COLORS.textSecondary,
    },
});

export default RecoveryPlanScreen;
