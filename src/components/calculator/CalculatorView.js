import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import { getSubjectAttendance } from '../../utils/attendance';
import {
    calculateImpact,
    calculateMaxSkips,
    calculateRecovery,
    detectPattern,
    calculateTrend,
    findBestSkipDay,
    compareSubjects,
    getPersonalizedMessage,
    getTrendInfo,
    estimateRemainingClasses,
    getNextClass,
} from '../../utils/calculator';

import SubjectPicker from './SubjectPicker';
import StatsCard from './StatsCard';
import SkipStepper from './SkipStepper';
import ImpactPreview from './ImpactPreview';
import TargetSelector from './TargetSelector';
import ResultCard from './ResultCard';
import InsightCard from './InsightCard';
import QuickActions from './QuickActions';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const CalculatorView = ({ navigation }) => {
    const styles = getStyles();
    const { state } = useApp();

    const [selectedSubjectId, setSelectedSubjectId] = useState(state.subjects[0]?.id);
    const [targetPercentage, setTargetPercentage] = useState(75);
    const [sliderValue, setSliderValue] = useState(0);

    // Get selected subject
    const selectedSubject = useMemo(
        () => state.subjects.find(s => s.id === selectedSubjectId),
        [selectedSubjectId, state.subjects]
    );

    // Get attendance stats
    const stats = useMemo(
        () => selectedSubjectId ? getSubjectAttendance(selectedSubjectId, state) : null,
        [selectedSubjectId, state]
    );

    // Classes per week for this subject
    const classesPerWeek = useMemo(() => {
        if (!selectedSubjectId) return 0;
        let count = 0;
        DAY_NAMES.forEach(day => {
            const slots = state.timetable[day] || [];
            slots.forEach(slot => {
                if (slot.subjectId === selectedSubjectId) count++;
            });
        });
        return count;
    }, [selectedSubjectId, state.timetable]);

    // Remaining classes estimate
    const remainingClasses = useMemo(
        () => selectedSubjectId ? estimateRemainingClasses(selectedSubjectId, state) : 0,
        [selectedSubjectId, state]
    );

    // Impact preview when skipping X classes
    const projectedPercentage = useMemo(
        () => stats ? calculateImpact(stats.attendedUnits, stats.totalUnits, sliderValue) : 0,
        [stats, sliderValue]
    );

    // Max skips for target
    const maxSkips = useMemo(
        () => stats ? calculateMaxSkips(stats.attendedUnits, stats.totalUnits, targetPercentage) : 0,
        [stats, targetPercentage]
    );

    // Recovery needed
    const recoveryNeeded = useMemo(
        () => stats ? calculateRecovery(stats.attendedUnits, stats.totalUnits, targetPercentage) : 0,
        [stats, targetPercentage]
    );

    // Personalized message
    const personalizedMessage = useMemo(
        () => selectedSubject ? getPersonalizedMessage(stats?.percentage || 0, selectedSubject.name) : '',
        [selectedSubject, stats]
    );

    // --- Insights ---
    const patternInsight = useMemo(() => {
        if (!selectedSubjectId) return null;
        const pattern = detectPattern(selectedSubjectId, state);
        if (!pattern) return null;
        return {
            primary: `You skip ${selectedSubject?.name} on ${pattern.patternDay}s`,
            secondary: `${pattern.skipCount} of ${pattern.totalSkips} skips were on ${pattern.patternDay}`,
            tip: `Try attending ${pattern.patternDay}s to improve!`,
        };
    }, [selectedSubjectId, state, selectedSubject]);

    const trendInsight = useMemo(() => {
        if (!selectedSubjectId) return null;
        const trend = calculateTrend(selectedSubjectId, state);
        const info = getTrendInfo(trend);
        return {
            emoji: info.emoji,
            primary: `${info.label} ${info.emoji}`,
            secondary: trend === 'declining'
                ? `Your ${selectedSubject?.name} attendance is dropping — be careful!`
                : trend === 'improving'
                    ? `Great job! Your ${selectedSubject?.name} is getting better`
                    : `Your ${selectedSubject?.name} attendance is holding steady`,
        };
    }, [selectedSubjectId, state, selectedSubject]);

    const bestDayInsight = useMemo(() => {
        if (!selectedSubjectId) return null;
        const result = findBestSkipDay(selectedSubjectId, state);
        if (!result) return null;
        return {
            primary: result.bestDay,
            secondary: result.reason,
        };
    }, [selectedSubjectId, state]);

    const comparisonInsight = useMemo(() => {
        const ranked = compareSubjects(state);
        const subjectRank = ranked.find(r => r.id === selectedSubjectId);
        if (!subjectRank) return null;
        const best = ranked[0];
        return {
            primary: `${subjectRank.rank}${getOrdinal(subjectRank.rank)} of ${subjectRank.total} subjects`,
            secondary: subjectRank.rank <= 2
                ? `This is one of your best subjects!`
                : `Best: ${best.name} (${best.percentage.toFixed(0)}%)`,
        };
    }, [selectedSubjectId, state]);

    // Next class
    const nextClass = useMemo(
        () => selectedSubjectId ? getNextClass(selectedSubjectId, state) : null,
        [selectedSubjectId, state]
    );

    if (!selectedSubject || !stats) {
        return (
            <View style={styles.empty}>
                <Text style={styles.emptyText}>No subjects found</Text>
            </View>
        );
    }

    return (
        <View>
            {/* Personalized Greeting */}
            <Text style={styles.greeting}>{personalizedMessage}</Text>

            {/* Subject Selector */}
            <View style={styles.pickerSection}>
                <Text style={styles.sectionLabel}>Select Subject</Text>
                <SubjectPicker
                    subjects={state.subjects}
                    selectedId={selectedSubjectId}
                    onSelect={(id) => {
                        setSelectedSubjectId(id);
                        setSliderValue(0);
                    }}
                />
            </View>

            {/* Current Stats */}
            <StatsCard
                subject={selectedSubject}
                stats={stats}
                classesPerWeek={classesPerWeek}
                remainingClasses={remainingClasses}
            />

            {/* Skip Stepper */}
            <SkipStepper
                value={sliderValue}
                onValueChange={setSliderValue}
                maxValue={Math.max(15, maxSkips + 5)}
                subjectColor={selectedSubject.color}
            />

            {/* Impact Preview */}
            <ImpactPreview
                currentPercentage={stats.percentage}
                projectedPercentage={projectedPercentage}
                skipCount={sliderValue}
            />

            {/* Target Selector */}
            <TargetSelector
                selected={targetPercentage}
                onSelect={setTargetPercentage}
            />

            {/* Result Card */}
            <ResultCard
                maxSkips={maxSkips}
                recoveryNeeded={recoveryNeeded}
                currentPercentage={stats.percentage}
                targetPercentage={targetPercentage}
                onRecoveryPress={stats.percentage < targetPercentage ? () => {
                    navigation?.navigate('Planner', {
                        screen: 'PlannerSubjectDetail',
                        params: {
                            subjectId: selectedSubjectId,
                            subjectName: selectedSubject.name,
                        },
                    });
                } : null}
            />

            {/* Insights Section */}
            <Text style={styles.insightsTitle}>Insights for {selectedSubject.name}</Text>

            {bestDayInsight && (
                <InsightCard type="bestDay" data={bestDayInsight} />
            )}
            {patternInsight && (
                <InsightCard type="pattern" data={patternInsight} />
            )}
            {trendInsight && (
                <InsightCard type="trend" data={trendInsight} />
            )}
            {comparisonInsight && (
                <InsightCard type="comparison" data={comparisonInsight} />
            )}

            {/* Show a generic message if no insights */}
            {!bestDayInsight && !patternInsight && !trendInsight && !comparisonInsight && (
                <View style={styles.noInsights}>
                    <Text style={styles.noInsightsText}>
                        Keep marking attendance to unlock personalized insights! 📊
                    </Text>
                </View>
            )}

            {/* Quick Actions */}
            <QuickActions
                nextClass={nextClass}
                showRecovery={stats.percentage < targetPercentage}
                onRecoveryPress={() => {
                    navigation?.navigate('Planner', {
                        screen: 'PlannerSubjectDetail',
                        params: {
                            subjectId: selectedSubjectId,
                            subjectName: selectedSubject.name,
                        },
                    });
                }}
                onViewStatsPress={() => {
                    navigation?.navigate('Subjects', {
                        screen: 'SubjectDetail',
                        params: {
                            subjectId: selectedSubjectId,
                            subjectName: selectedSubject.name,
                        },
                    });
                }}
            />
        </View>
    );
};

function getOrdinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
}

const getStyles = () => StyleSheet.create({
    greeting: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginBottom: SPACING.md,
        paddingHorizontal: SPACING.lg,
    },
    pickerSection: {
        marginBottom: SPACING.md,
        paddingHorizontal: SPACING.lg,
    },
    sectionLabel: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginBottom: SPACING.sm,
    },
    insightsTitle: {
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: SPACING.sm,
        paddingHorizontal: SPACING.lg,
    },
    noInsights: {
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.md,
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        alignItems: 'center',
    },
    noInsightsText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textMuted,
        textAlign: 'center',
    },
    empty: {
        alignItems: 'center',
        paddingVertical: SPACING.xxl,
    },
    emptyText: {
        fontSize: FONT_SIZES.md,
        color: COLORS.textMuted,
    },
});

export default CalculatorView;
