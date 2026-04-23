import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
} from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import { getSubjectAttendance, calculateSkips } from '../../utils/attendance';
import { calculateGlobalStaleness } from '../../utils/erpFreshness';

// Components
import OverallStatsCard from '../../components/subjects/OverallStatsCard';
import SubjectRow from '../../components/subjects/SubjectRow';
import CalendarView from '../../components/subjects/CalendarView';
import TimetableGrid from '../../components/subjects/TimetableGrid';
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
            const skipInfo = calculateSkips(stats.attendedUnits, stats.totalUnits, target);

            return {
                ...subject,
                ...stats,
                skipInfo,
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
                    <Text style={styles.headerTitle}>Your Subjects</Text>
                </View>

                {/* Overall Stats Card */}
                <OverallStatsCard
                    stats={overallStats}
                    threshold={dangerThreshold}
                    staleness={staleness}
                    onBannerPress={() => setTransparencyVisible(true)}
                />

                {/* View Toggle */}
                <View style={styles.toggleContainer}>
                    <TouchableOpacity
                        style={[
                            styles.toggleButton,
                            viewMode === 'list' && styles.toggleButtonActive,
                        ]}
                        onPress={() => setViewMode('list')}
                    >
                        <Text style={[
                            styles.toggleText,
                            viewMode === 'list' && styles.toggleTextActive,
                        ]}>
                            List
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.toggleButton,
                            viewMode === 'calendar' && styles.toggleButtonActive,
                        ]}
                        onPress={() => setViewMode('calendar')}
                    >
                        <Text style={[
                            styles.toggleText,
                            viewMode === 'calendar' && styles.toggleTextActive,
                        ]}>
                            Calendar
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.toggleButton,
                            viewMode === 'timetable' && styles.toggleButtonActive,
                        ]}
                        onPress={() => setViewMode('timetable')}
                    >
                        <Text style={[
                            styles.toggleText,
                            viewMode === 'timetable' && styles.toggleTextActive,
                        ]}>
                            Timetable
                        </Text>
                    </TouchableOpacity>
                </View>

                {viewMode === 'list' ? (
                    <>
                        {/* Danger Section */}
                        {categorizedSubjects.danger.length > 0 && (
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <Text style={[styles.sectionTitle, styles.sectionTitleDanger]}>
                                        NEEDS ATTENTION
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
                                    <Text style={[styles.sectionTitle, styles.sectionTitleEdge]}>
                                        ON THE EDGE
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
                                    <Text style={[styles.sectionTitle, styles.sectionTitleSafe]}>
                                        ON TRACK
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
                ) : viewMode === 'calendar' ? (
                    <CalendarView state={state} />
                ) : (
                    <TimetableGrid
                        state={state}
                        onCellPress={(subject) => handleSubjectPress(subject)}
                    />
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
        paddingTop: 24,
    },
    headerContainer: {
        paddingHorizontal: SPACING.screenPadding,
        paddingBottom: 16,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: -0.5,
        color: COLORS.textPrimary,
    },
    toggleContainer: {
        flexDirection: 'row',
        marginHorizontal: SPACING.screenPadding,
        marginVertical: SPACING.md,
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: 4,
    },
    toggleButton: {
        flex: 1,
        paddingVertical: SPACING.sm,
        alignItems: 'center',
        borderRadius: BORDER_RADIUS.sm,
    },
    toggleButtonActive: {
        backgroundColor: COLORS.cardBackground,
        ...SHADOWS.small,
    },
    toggleText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '500',
        color: COLORS.textSecondary,
    },
    toggleTextActive: {
        color: COLORS.textPrimary,
        fontWeight: '600',
    },
    section: {
        marginTop: SPACING.md,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.sm,
    },
    sectionTitle: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    sectionTitleDanger: {
        color: COLORS.danger,
    },
    sectionTitleEdge: {
        color: COLORS.warning,
    },
    sectionTitleSafe: {
        color: COLORS.success,
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
