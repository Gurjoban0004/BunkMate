import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Platform,
    LayoutAnimation,
} from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import { getSubjectAttendance, calculateSkips } from '../../utils/attendance';
import { calculateGlobalStaleness } from '../../utils/erpFreshness';

// Components
import OverallStatsCard from '../../components/subjects/OverallStatsCard';
import SubjectRow from '../../components/subjects/SubjectRow';
import CalendarView from '../../components/subjects/CalendarView';
import ProjectionTransparencyModal from '../../components/insights/ProjectionTransparencyModal';
import { calculateProjectionBreakdown } from '../../utils/transparency';

const SubjectsScreen = ({ navigation }) => {
    const styles = getStyles();
    const { state, triggerErpSync } = useApp();
    const [viewMode, setViewMode] = useState('list');
    const switchView = useCallback((mode) => {
        LayoutAnimation.configureNext(LayoutAnimation.create(180, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
        setViewMode(mode);
    }, []);
    const [refreshing, setRefreshing] = useState(false);
    const [transparencyVisible, setTransparencyVisible] = useState(false);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        if (state.settings?.erpConnected && triggerErpSync) {
            triggerErpSync(true);
        }
        setTimeout(() => setRefreshing(false), 800);
    }, [state.settings?.erpConnected, triggerErpSync]);

    const dangerThreshold = state.settings?.dangerThreshold || 75;

    // Calculate stats for all subjects
    const subjectsWithStats = useMemo(() => {
        return state.subjects.map(subject => {
            const stats = getSubjectAttendance(subject.id, state);
            const target = subject.target || dangerThreshold;
            const attendedUnits = stats?.attendedUnits ?? 0;
            const totalUnits = stats?.totalUnits ?? 0;
            const percentage = stats?.percentage ?? 0;
            // calculateSkips reports both: `count` in ERP periods and
            // `classes` in physical classes. Students think in classes.
            const skipInfo = calculateSkips(attendedUnits, totalUnits, target, stats?.sessionUnits);
            const physicalSkipInfo = { ...skipInfo, count: skipInfo.classes };

            return {
                ...subject,
                attendedUnits,
                totalUnits,
                percentage,
                hasPredictions: stats?.hasPredictions ?? false,
                skipInfo: physicalSkipInfo,
                resolvedTarget: target,
            };
        });
        // Only recalculate when the data that actually affects attendance changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.subjects, state.attendanceRecords, state.holidays, state.trackingStartDate, dangerThreshold]);

    // Shorten the list: hide "empty" subjects — 0 tracked classes and no ERP totals.
    // These are timetable/elective stubs and stale prior-term rows with nothing to
    // show. Guard: if EVERY subject is still 0/0 (a fresh term before any class is
    // marked), show them all rather than an empty screen.
    const visibleSubjects = useMemo(() => {
        const hasReal = (s) => (s.totalUnits > 0) || (Number(s.erpDelivered) > 0);
        const anyReal = subjectsWithStats.some(hasReal);
        return anyReal ? subjectsWithStats.filter(hasReal) : subjectsWithStats;
    }, [subjectsWithStats]);

    // Categorize subjects
    const categorizedSubjects = useMemo(() => {
        const danger = [];
        const edge = [];
        const safe = [];

        visibleSubjects.forEach(subject => {
            const target = subject.resolvedTarget;
            const edgeThresholdForSubject = target + 3;

            if (subject.percentage < target) {
                danger.push(subject);
            } else if (subject.percentage < edgeThresholdForSubject) {
                edge.push(subject);
            } else {
                safe.push(subject);
            }
        });

        // Most-slack-first. Two subjects at 89% are not equally skippable —
        // the one with 13 spare classes is the one to bunk.
        const slack = (s) => (s.skipInfo?.count === Infinity
            ? Number.MAX_SAFE_INTEGER
            : s.skipInfo?.count ?? 0);

        danger.sort((a, b) => a.percentage - b.percentage);
        edge.sort((a, b) => a.percentage - b.percentage);
        safe.sort((a, b) => slack(b) - slack(a) || b.percentage - a.percentage);

        return { danger, edge, safe };
    }, [visibleSubjects]);

    // Calculate overall stats
    const overallStats = useMemo(() => {
        const totalAttended = subjectsWithStats.reduce((sum, s) => sum + s.attendedUnits, 0);
        const totalUnitsVal = subjectsWithStats.reduce((sum, s) => sum + s.totalUnits, 0);
        const pct = totalUnitsVal > 0 ? (totalAttended / totalUnitsVal) * 100 : 0;

        return {
            attended: totalAttended,
            total: totalUnitsVal,
            percentage: parseFloat(pct.toFixed(1)),
            dangerCount: categorizedSubjects.danger.length,
            edgeCount: categorizedSubjects.edge.length,
            safeCount: categorizedSubjects.safe.length,
        };
    }, [subjectsWithStats, categorizedSubjects]);

    // Calculate global staleness for the stats card
    const staleness = useMemo(() => {
        if (!state.settings?.erpConnected) return null;
        return calculateGlobalStaleness(state);
    }, [state.settings?.lastSubjectSyncDates, state.subjects, state.attendanceRecords, state.settings?.erpConnected, state.devDate]);

    const handleSubjectPress = (subject) => {
        navigation.navigate('SubjectDetail', { subjectId: subject.id });
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={COLORS.primary}
                    />
                }
            >
                {/* Header */}
                <View style={styles.headerContainer}>
                    <View style={styles.headerRow}>
                        <Text style={styles.headerTitle}>Subjects</Text>
                    </View>
                    
                    {/* View Mode Segmented Control */}
                    <View style={styles.toggleContainer}>
                        {[
                            { key: 'list', label: 'Subjects' },
                            { key: 'calendar', label: 'Heatmap' },
                        ].map(tab => (
                            <TouchableOpacity
                                key={tab.key}
                                style={[styles.toggleTab, viewMode === tab.key && styles.toggleTabActive]}
                                onPress={() => switchView(tab.key)}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.toggleTabText, viewMode === tab.key && styles.toggleTabTextActive]}>
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Overall Stats Card */}
                <OverallStatsCard
                    stats={overallStats}
                    threshold={dangerThreshold}
                    staleness={staleness}
                    onBannerPress={() => setTransparencyVisible(true)}
                />

                {viewMode === 'list' ? (
                    <>
                        {/* Danger Section */}
                        {categorizedSubjects.danger.length > 0 && (
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <View style={[styles.sectionRule, styles.sectionRuleDanger]} />
                                    <Text style={styles.sectionTitle}>
                                        Needs Attention
                                    </Text>
                                </View>

                                {categorizedSubjects.danger.map(subject => (
                                    <SubjectRow
                                        key={subject.id}
                                        subject={subject}
                                        status="danger"
                                        threshold={dangerThreshold}
                                        onPress={() => handleSubjectPress(subject)}
                                    />
                                ))}
                            </View>
                        )}

                        {/* Edge Section */}
                        {categorizedSubjects.edge.length > 0 && (
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <View style={[styles.sectionRule, styles.sectionRuleEdge]} />
                                    <Text style={styles.sectionTitle}>
                                        Borderline
                                    </Text>
                                </View>

                                {categorizedSubjects.edge.map(subject => (
                                    <SubjectRow
                                        key={subject.id}
                                        subject={subject}
                                        status="edge"
                                        threshold={dangerThreshold}
                                        onPress={() => handleSubjectPress(subject)}
                                    />
                                ))}
                            </View>
                        )}

                        {/* Safe Section */}
                        {categorizedSubjects.safe.length > 0 && (
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <View style={[styles.sectionRule, styles.sectionRuleSafe]} />
                                    <Text style={styles.sectionTitle}>
                                        Safe
                                    </Text>
                                </View>

                                {categorizedSubjects.safe.map(subject => (
                                    <SubjectRow
                                        key={subject.id}
                                        subject={subject}
                                        status="safe"
                                        threshold={dangerThreshold}
                                        onPress={() => handleSubjectPress(subject)}
                                    />
                                ))}
                            </View>
                        )}
                    </>
                ) : (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <View style={[styles.sectionRule, styles.sectionRuleSafe]} />
                            <Text style={styles.sectionTitle}>
                                Daily History Heatmap
                            </Text>
                        </View>
                        <CalendarView state={state} />
                    </View>
                )}

                {/* Bottom Padding */}
                <View style={styles.bottomPadding} />
            </ScrollView>

            {/* Transparency Modal */}
            <ProjectionTransparencyModal
                visible={transparencyVisible}
                onClose={() => setTransparencyVisible(false)}
                breakdown={calculateProjectionBreakdown(state)}
            />
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
        paddingTop: SPACING.md,
        paddingBottom: SPACING.xxl,
    },
    headerContainer: {
        paddingHorizontal: SPACING.screenPadding,
        paddingBottom: SPACING.cardGap,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerTitle: {
        fontWeight: '700',
        fontSize: 26,
        letterSpacing: 0,
        color: COLORS.textPrimary,
    },
    toggleContainer: {
        flexDirection: 'row',
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: 4,
        marginTop: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    toggleTab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: BORDER_RADIUS.sm,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    toggleTabActive: {
        backgroundColor: COLORS.cardBackground,
        borderColor: COLORS.border,
        ...Platform.select({
            ios: {
                shadowColor: COLORS.shadow,
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 1,
            },
            android: {
                elevation: 1,
            },
            web: {
                boxShadow: '0px 1px 2px rgba(15,23,42,0.05)',
            }
        }),
    },
    toggleTabText: {
        fontWeight: '600',
        fontSize: FONT_SIZES.sm,
        color: COLORS.textMuted,
    },
    toggleTabTextActive: {
        color: COLORS.textPrimary,
        fontWeight: '700',
    },
    section: {
        marginTop: SPACING.lg,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.md - 4,
        gap: SPACING.sm,
    },
    sectionRule: {
        width: 18,
        height: 2,
        borderRadius: 1,
    },
    sectionRuleDanger: {
        backgroundColor: COLORS.danger,
    },
    sectionRuleEdge: {
        backgroundColor: COLORS.warning,
    },
    sectionRuleSafe: {
        backgroundColor: COLORS.success,
    },
    sectionTitle: {
        fontWeight: '700',
        fontSize: FONT_SIZES.xs,
        letterSpacing: 0.5,
        color: COLORS.textMuted,
    },
    bottomPadding: {
        height: 100,
    },
});

export default SubjectsScreen;
