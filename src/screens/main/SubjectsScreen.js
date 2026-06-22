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
} from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import { getSubjectAttendance, calculateSkips, getSubjectUnits } from '../../utils/attendance';
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
            const skipInfo = calculateSkips(attendedUnits, totalUnits, target);

            // How many periods make up one physical class for this subject.
            // e.g. a 2-hr class = 2 periods → unitsPerClass = 2
            // We use this to convert "periods can skip" → "physical classes can skip".
            const unitsPerClass = Math.max(1, getSubjectUnits(subject.id, state));

            // Convert period-based skip count to physical class count
            const physicalSkipInfo = {
                ...skipInfo,
                count: skipInfo.count === Infinity
                    ? Infinity
                    : Math.floor(skipInfo.count / unitsPerClass),
            };

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

    // Categorize subjects
    const categorizedSubjects = useMemo(() => {
        const danger = [];
        const edge = [];
        const safe = [];

        subjectsWithStats.forEach(subject => {
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

        danger.sort((a, b) => a.percentage - b.percentage);
        edge.sort((a, b) => a.percentage - b.percentage);
        safe.sort((a, b) => b.percentage - a.percentage);

        return { danger, edge, safe };
    }, [subjectsWithStats]);

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
                        <TouchableOpacity
                            style={[
                                styles.toggleTab,
                                viewMode === 'list' && styles.toggleTabActive
                            ]}
                            onPress={() => setViewMode('list')}
                            activeOpacity={0.8}
                        >
                            <Text style={[
                                styles.toggleTabText,
                                viewMode === 'list' && styles.toggleTabTextActive
                            ]}>
                                Subjects List
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.toggleTab,
                                viewMode === 'calendar' && styles.toggleTabActive
                            ]}
                            onPress={() => setViewMode('calendar')}
                            activeOpacity={0.8}
                        >
                            <Text style={[
                                styles.toggleTabText,
                                viewMode === 'calendar' && styles.toggleTabTextActive
                            ]}>
                                Attendance Heatmap
                            </Text>
                        </TouchableOpacity>
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
                                    <View style={[styles.sectionBadge, styles.sectionBadgeDanger]}>
                                        <Text style={styles.sectionBadgeText}>
                                            {categorizedSubjects.danger.length}
                                        </Text>
                                    </View>
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
                                        Almost Low
                                    </Text>
                                    <View style={[styles.sectionBadge, styles.sectionBadgeEdge]}>
                                        <Text style={styles.sectionBadgeText}>
                                            {categorizedSubjects.edge.length}
                                        </Text>
                                    </View>
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
                                    <View style={[styles.sectionBadge, styles.sectionBadgeSafe]}>
                                        <Text style={styles.sectionBadgeText}>
                                            {categorizedSubjects.safe.length}
                                        </Text>
                                    </View>
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
        fontSize: 26,
        fontWeight: '800',
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
        paddingVertical: 8,
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
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.textMuted,
    },
    toggleTabTextActive: {
        color: COLORS.textPrimary,
        fontWeight: '700',
    },
    section: {
        marginTop: SPACING.cardGap,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.sm,
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
        fontSize: FONT_SIZES.xs,
        fontWeight: '700',
        letterSpacing: 0.5,
        color: COLORS.textMuted,
    },
    sectionBadge: {
        marginLeft: SPACING.sm,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 2,
        borderRadius: BORDER_RADIUS.sm,
    },
    sectionBadgeDanger: {
        backgroundColor: COLORS.dangerLight,
    },
    sectionBadgeEdge: {
        backgroundColor: COLORS.warningLight,
    },
    sectionBadgeSafe: {
        backgroundColor: COLORS.successLight,
    },
    sectionBadgeText: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    bottomPadding: {
        height: 100,
    },
});

export default SubjectsScreen;
