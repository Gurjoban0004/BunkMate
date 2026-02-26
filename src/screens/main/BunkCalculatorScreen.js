import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
} from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import { getSubjectAttendance, calculateBunks } from '../../utils/attendance';

// Components
import SubjectPicker from '../../components/calculator/SubjectPicker';

const TARGET_OPTIONS = [70, 75, 80, 85, 90];

const BunkCalculatorScreen = () => {
    const { state } = useApp();
    const [selectedSubjectId, setSelectedSubjectId] = useState(state.subjects[0]?.id);
    const [targetPercentage, setTargetPercentage] = useState(
        state.settings?.dangerThreshold || 75
    );

    // Get selected subject stats
    const subjectStats = useMemo(() => {
        if (!selectedSubjectId) return null;

        const subject = state.subjects.find(s => s.id === selectedSubjectId);
        const stats = getSubjectAttendance(selectedSubjectId, state);
        const bunkInfo = calculateBunks(stats.attendedUnits, stats.totalUnits, targetPercentage);

        return {
            ...subject,
            ...stats,
            bunkInfo,
        };
    }, [selectedSubjectId, state, targetPercentage]);

    // Calculate what-if scenarios
    const whatIfScenarios = useMemo(() => {
        if (!subjectStats) return [];

        const { attendedUnits, totalUnits } = subjectStats;
        const scenarios = [];

        for (let bunks = 1; bunks <= 6; bunks++) {
            const newTotal = totalUnits + bunks;
            const newPercentage = (attendedUnits / newTotal) * 100;

            let status = 'safe';
            if (newPercentage < targetPercentage) status = 'danger';
            else if (newPercentage < targetPercentage + 3) status = 'edge';

            scenarios.push({
                bunks,
                percentage: newPercentage.toFixed(1),
                status,
            });
        }

        return scenarios;
    }, [subjectStats, targetPercentage]);

    // Calculate prediction
    const prediction = useMemo(() => {
        if (!subjectStats) return null;

        const remainingClasses = 60;
        const currentRate = subjectStats.percentage / 100;
        const expectedAttend = Math.floor(remainingClasses * currentRate);

        const projectedTotal = subjectStats.totalUnits + remainingClasses;
        const projectedAttended = subjectStats.attendedUnits + expectedAttend;
        const projectedPercentage = (projectedAttended / projectedTotal) * 100;

        return projectedPercentage.toFixed(0);
    }, [subjectStats]);

    if (!subjectStats) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={styles.emptyText}>No subjects found</Text>
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
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Bunk Calculator</Text>
                    <Text style={styles.headerEmoji}>🎯</Text>
                </View>

                {/* Subject Picker */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Select Subject</Text>
                    <SubjectPicker
                        subjects={state.subjects}
                        selectedId={selectedSubjectId}
                        onSelect={setSelectedSubjectId}
                    />
                </View>

                {/* Target Selector */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Target Attendance</Text>
                    <View style={styles.targetContainer}>
                        {TARGET_OPTIONS.map((target) => (
                            <TouchableOpacity
                                key={target}
                                style={[
                                    styles.targetButton,
                                    targetPercentage === target && styles.targetButtonActive,
                                ]}
                                onPress={() => setTargetPercentage(target)}
                            >
                                <Text style={[
                                    styles.targetText,
                                    targetPercentage === target && styles.targetTextActive,
                                ]}>
                                    {target}%
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Result Card */}
                <View style={styles.resultCard}>
                    {/* Current Stats */}
                    <View style={styles.currentStats}>
                        <Text style={styles.currentLabel}>Current</Text>
                        <Text style={styles.currentPercentage}>
                            {subjectStats.percentage.toFixed(1)}%
                        </Text>
                        <View style={styles.progressBar}>
                            <View
                                style={[
                                    styles.progressFill,
                                    {
                                        width: `${Math.min(subjectStats.percentage, 100)}%`,
                                        backgroundColor: subjectStats.percentage >= targetPercentage
                                            ? COLORS.success
                                            : COLORS.danger,
                                    },
                                ]}
                            />
                        </View>
                        <Text style={styles.marksText}>
                            {subjectStats.attendedUnits} / {subjectStats.totalUnits} marks
                        </Text>
                    </View>

                    <View style={styles.divider} />

                    {/* Bunk Result */}
                    <View style={styles.bunkResult}>
                        {subjectStats.bunkInfo.status === 'safe' ? (
                            <>
                                <Text style={styles.resultEmoji}>✅</Text>
                                <Text style={styles.resultLabel}>You can safely bunk</Text>
                                <Text style={styles.resultNumber}>{subjectStats.bunkInfo.count}</Text>
                                <Text style={styles.resultUnit}>classes</Text>
                                <Text style={styles.resultNote}>
                                    and still maintain {targetPercentage}%
                                </Text>
                            </>
                        ) : (
                            <>
                                <Text style={styles.resultEmoji}>⚠️</Text>
                                <Text style={styles.resultLabel}>You need to attend</Text>
                                <Text style={[styles.resultNumber, styles.resultNumberDanger]}>
                                    {subjectStats.bunkInfo.count}
                                </Text>
                                <Text style={styles.resultUnit}>consecutive classes</Text>
                                <Text style={styles.resultNote}>
                                    to reach {targetPercentage}%
                                </Text>
                            </>
                        )}
                    </View>
                </View>

                {/* What-If Analysis */}
                <View style={styles.whatIfCard}>
                    <Text style={styles.whatIfTitle}>📊 What-If Analysis</Text>

                    {whatIfScenarios.slice(0, 4).map((scenario) => (
                        <View key={scenario.bunks} style={styles.whatIfRow}>
                            <Text style={styles.whatIfLabel}>
                                If you bunk {scenario.bunks}:
                            </Text>
                            <View style={styles.whatIfResult}>
                                <Text style={[
                                    styles.whatIfPercentage,
                                    scenario.status === 'danger' && styles.whatIfDanger,
                                    scenario.status === 'edge' && styles.whatIfEdge,
                                ]}>
                                    {scenario.percentage}%
                                </Text>
                                <Text style={styles.whatIfEmoji}>
                                    {scenario.status === 'safe' && '✅'}
                                    {scenario.status === 'edge' && '⚠️'}
                                    {scenario.status === 'danger' && '🚨'}
                                </Text>
                            </View>
                        </View>
                    ))}
                </View>

                {/* Prediction */}
                <View style={styles.predictionCard}>
                    <Text style={styles.predictionTitle}>📈 Prediction</Text>
                    <Text style={styles.predictionText}>
                        At this rate, you'll have approximately
                    </Text>
                    <Text style={styles.predictionPercentage}>~{prediction}%</Text>
                    <Text style={styles.predictionNote}>by end of semester</Text>
                </View>

                {/* Bottom Padding */}
                <View style={styles.bottomPadding} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: SPACING.lg,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        marginBottom: SPACING.lg,
    },
    headerTitle: {
        fontSize: FONT_SIZES.xl,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    headerEmoji: {
        fontSize: 28,
    },
    section: {
        marginBottom: SPACING.md,
        paddingHorizontal: SPACING.lg,
    },
    sectionLabel: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginBottom: SPACING.sm,
    },
    targetContainer: {
        flexDirection: 'row',
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: 4,
    },
    targetButton: {
        flex: 1,
        paddingVertical: SPACING.sm,
        alignItems: 'center',
        borderRadius: BORDER_RADIUS.sm,
    },
    targetButtonActive: {
        backgroundColor: COLORS.primary,
    },
    targetText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '500',
        color: COLORS.textSecondary,
    },
    targetTextActive: {
        color: COLORS.textOnPrimary,
        fontWeight: '600',
    },
    resultCard: {
        backgroundColor: COLORS.cardBackground,
        marginHorizontal: SPACING.lg,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.medium,
    },
    currentStats: {
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    currentLabel: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        marginBottom: 4,
    },
    currentPercentage: {
        fontSize: 32,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    progressBar: {
        width: '100%',
        height: 8,
        backgroundColor: COLORS.progressBackground,
        borderRadius: 4,
        marginVertical: SPACING.sm,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 4,
    },
    marksText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginVertical: SPACING.md,
    },
    bunkResult: {
        alignItems: 'center',
        paddingVertical: SPACING.md,
    },
    resultEmoji: {
        fontSize: 32,
        marginBottom: SPACING.sm,
    },
    resultLabel: {
        fontSize: FONT_SIZES.md,
        color: COLORS.textSecondary,
    },
    resultNumber: {
        fontSize: 64,
        fontWeight: '700',
        color: COLORS.success,
        lineHeight: 72,
    },
    resultNumberDanger: {
        color: COLORS.danger,
    },
    resultUnit: {
        fontSize: FONT_SIZES.lg,
        color: COLORS.textPrimary,
        fontWeight: '500',
    },
    resultNote: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        marginTop: SPACING.sm,
    },
    whatIfCard: {
        backgroundColor: COLORS.cardBackground,
        marginHorizontal: SPACING.lg,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    whatIfTitle: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: SPACING.md,
    },
    whatIfRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: SPACING.xs,
    },
    whatIfLabel: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
    },
    whatIfResult: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    whatIfPercentage: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.success,
        marginRight: SPACING.xs,
    },
    whatIfDanger: {
        color: COLORS.danger,
    },
    whatIfEdge: {
        color: COLORS.warning,
    },
    whatIfEmoji: {
        fontSize: 14,
    },
    predictionCard: {
        backgroundColor: COLORS.primaryLight,
        marginHorizontal: SPACING.lg,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.primary,
    },
    predictionTitle: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.primary,
        marginBottom: SPACING.sm,
    },
    predictionText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        textAlign: 'center',
    },
    predictionPercentage: {
        fontSize: 36,
        fontWeight: '700',
        color: COLORS.primary,
        marginVertical: SPACING.xs,
    },
    predictionNote: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
    },
    bottomPadding: {
        height: 100,
    },
    emptyText: {
        fontSize: FONT_SIZES.md,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginTop: 100,
    },
});

export default BunkCalculatorScreen;
