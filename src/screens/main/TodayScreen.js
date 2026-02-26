import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useCallback, useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    RefreshControl,
    Modal,
    TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import { getGreeting } from '../../utils/greeting';
import { getTodayClasses, getCurrentClassIndex, calculateOverallPercentage } from '../../utils/attendance';
import { calculateOverallStreak } from '../../utils/streak';
import { getUnmarkedCount } from '../../utils/backlog';
import { getTodayKey, getTodayDayName } from '../../utils/dateHelpers';
import { getDayStatus } from '../../utils/planner';

// Components
import QuickStatsCard from '../../components/today/QuickStatsCard';
import StreakBanner from '../../components/today/StreakBanner';
import SectionHeader from '../../components/today/SectionHeader';
import ClassCard from '../../components/today/ClassCard';
import BacklogBanner from '../../components/today/BacklogBanner';
import EmptyDay from '../../components/today/EmptyDay';
import HolidayCard from '../../components/today/HolidayCard';
import AddExtraClassButton from '../../components/today/AddExtraClassButton';
import QuickAnswerCard from '../../components/planner/QuickAnswerCard';
import { showAlert } from '../../utils/alert';

const TodayScreen = ({ navigation }) => {
    const { state, dispatch } = useApp();
    const [refreshing, setRefreshing] = useState(false);
    const [showExtraModal, setShowExtraModal] = useState(false);
    const [selectedExtraSubject, setSelectedExtraSubject] = useState(null);

    // Get greeting
    const greeting = getGreeting(state.userName || 'there');

    // Get today's data
    const today = new Date();
    const dateString = today.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    });

    // Get classes
    const todayClasses = getTodayClasses(state);
    const currentClassIndex = getCurrentClassIndex(todayClasses);

    // Calculate stats
    const streak = calculateOverallStreak(state);
    const overallPercentage = calculateOverallPercentage(state);
    const classCount = todayClasses.length;

    // Check if today is holiday
    const todayKey = getTodayKey();
    const isHoliday = (state.holidays || []).includes(todayKey) ||
        state.attendanceRecords[todayKey]?._holiday;

    // Check for unmarked backlog
    const unmarkedCount = useMemo(() => getUnmarkedCount(state), [state]);

    // Quick Answer: can I skip today?
    const todayDayName = getTodayDayName();
    const todaySkipStatus = useMemo(() => getDayStatus(state, todayDayName, 75), [state, todayDayName]);

    // Pull to refresh
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 500);
    }, []);

    // Handlers
    const handleMarkAttendance = (subjectId, status, units) => {
        if (status === null) {
            dispatch({
                type: 'REMOVE_ATTENDANCE',
                payload: { date: todayKey, subjectId },
            });
        } else {
            dispatch({
                type: 'MARK_ATTENDANCE',
                payload: { date: todayKey, subjectId, status, units },
            });
        }
    };

    const handleHolidayPress = () => {
        showAlert(
            '🏖️ Mark as Holiday',
            'Mark today as a holiday? No classes will be counted.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Mark Holiday',
                    onPress: () => dispatch({ type: 'MARK_HOLIDAY', payload: todayKey }),
                },
            ]
        );
    };

    const handleBacklogPress = () => {
        navigation.navigate('PastAttendance');
    };

    const handleExtraClass = () => {
        setShowExtraModal(true);
    };

    const handleAddExtraSubject = (subjectId) => {
        const subject = state.subjects.find(s => s.id === subjectId);
        if (subject) {
            dispatch({
                type: 'MARK_ATTENDANCE',
                payload: {
                    date: todayKey,
                    subjectId: subjectId,
                    status: 'present',
                    units: 1,
                    isExtra: true,
                },
            });
            setShowExtraModal(false);
        }
    };

    // Categorize classes
    const categorizeClasses = () => {
        if (currentClassIndex === -1) {
            return { now: null, upcoming: todayClasses, done: [] };
        }

        const now = todayClasses[currentClassIndex];
        const upcoming = todayClasses.slice(currentClassIndex + 1);
        const done = todayClasses.slice(0, currentClassIndex);

        return { now, upcoming, done };
    };

    const { now, upcoming, done } = categorizeClasses();

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
                <View style={styles.header}>
                    <Text style={styles.greeting}>
                        {greeting.text} {greeting.emoji}
                    </Text>
                    <Text style={styles.date}>{dateString}</Text>
                </View>

                {/* Quick Answer Card */}
                {!isHoliday && todayClasses.length > 0 && (
                    <QuickAnswerCard
                        dayStatus={todaySkipStatus}
                        compact={true}
                        onPlannerPress={() => navigation.navigate('Planner')}
                    />
                )}

                {/* Backlog Banner (if any unmarked) */}
                {unmarkedCount > 0 && (
                    <BacklogBanner
                        count={unmarkedCount}
                        onPress={handleBacklogPress}
                    />
                )}

                {/* Quick Stats */}
                <QuickStatsCard
                    classCount={classCount}
                    streak={streak}
                    overallPercentage={overallPercentage}
                />

                {/* Streak Banner */}
                <StreakBanner streak={streak} />

                {/* Holiday State */}
                {isHoliday ? (
                    <HolidayCard onUndo={() => dispatch({ type: 'REMOVE_HOLIDAY', payload: todayKey })} />
                ) : (
                    <>
                        {/* Classes Section */}
                        <SectionHeader
                            title="Today's Classes"
                            classCount={classCount}
                            onHolidayPress={handleHolidayPress}
                        />

                        {/* Empty State */}
                        {classCount === 0 ? (
                            <EmptyDay />
                        ) : (
                            <>
                                {/* Current Class */}
                                {now && (
                                    <View style={styles.sectionContainer}>
                                        <View style={styles.nowBadge}>
                                            <Text style={styles.nowBadgeText}>⏰ NOW</Text>
                                        </View>
                                        <ClassCard
                                            classInfo={now}
                                            state={state}
                                            onMark={handleMarkAttendance}
                                            isCurrentClass={true}
                                        />
                                    </View>
                                )}

                                {/* Upcoming Classes */}
                                {upcoming.length > 0 && (
                                    <View style={styles.sectionContainer}>
                                        {currentClassIndex !== -1 && (
                                            <Text style={styles.sectionLabel}>UPCOMING</Text>
                                        )}
                                        {upcoming.map((classInfo, index) => (
                                            <ClassCard
                                                key={`${classInfo.subjectId}-${index}`}
                                                classInfo={classInfo}
                                                state={state}
                                                onMark={handleMarkAttendance}
                                                isCurrentClass={false}
                                            />
                                        ))}
                                    </View>
                                )}

                                {/* Done Classes (if any) */}
                                {done.length > 0 && (
                                    <View style={styles.sectionContainer}>
                                        <Text style={styles.sectionLabel}>EARLIER TODAY</Text>
                                        {done.map((classInfo, index) => (
                                            <ClassCard
                                                key={`${classInfo.subjectId}-done-${index}`}
                                                classInfo={classInfo}
                                                state={state}
                                                onMark={handleMarkAttendance}
                                                isCurrentClass={false}
                                            />
                                        ))}
                                    </View>
                                )}
                            </>
                        )}

                        {/* Add Extra Class */}
                        <AddExtraClassButton
                            onPress={handleExtraClass}
                        />
                    </>
                )}

                {/* Bottom Padding */}
                <View style={styles.bottomPadding} />
            </ScrollView>

            {/* Extra Class Modal */}
            <Modal
                visible={showExtraModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowExtraModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Add Extra Class</Text>
                        <Text style={styles.modalSubtitle}>Select a subject</Text>
                        <ScrollView style={styles.modalScroll}>
                            {state.subjects.map((subject) => (
                                <TouchableOpacity
                                    key={subject.id}
                                    style={styles.modalItem}
                                    onPress={() => handleAddExtraSubject(subject.id)}
                                >
                                    <View style={[styles.modalDot, { backgroundColor: subject.color }]} />
                                    <Text style={styles.modalItemText}>{subject.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity
                            style={styles.modalCancel}
                            onPress={() => setShowExtraModal(false)}
                        >
                            <Text style={styles.modalCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
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
        paddingTop: SPACING.md,
    },
    header: {
        paddingHorizontal: SPACING.lg,
        paddingBottom: SPACING.md,
    },
    greeting: {
        fontSize: FONT_SIZES.xl,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    date: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        marginTop: 4,
    },
    sectionContainer: {
        marginTop: SPACING.sm,
    },
    sectionLabel: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '600',
        color: COLORS.textMuted,
        letterSpacing: 0.5,
        paddingHorizontal: SPACING.lg,
        marginBottom: SPACING.xs,
    },
    nowBadge: {
        alignSelf: 'flex-start',
        backgroundColor: COLORS.primary,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.md,
        marginLeft: SPACING.lg,
        marginBottom: SPACING.xs,
    },
    nowBadgeText: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '700',
        color: COLORS.textOnPrimary,
    },
    bottomPadding: {
        height: 100,
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: COLORS.cardBackground,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: SPACING.lg,
        maxHeight: '60%',
    },
    modalTitle: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '700',
        color: COLORS.textPrimary,
        textAlign: 'center',
    },
    modalSubtitle: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginTop: SPACING.xs,
        marginBottom: SPACING.md,
    },
    modalScroll: {
        maxHeight: 300,
    },
    modalItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        marginBottom: SPACING.xs,
        backgroundColor: COLORS.inputBackground,
    },
    modalDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: SPACING.sm,
    },
    modalItemText: {
        fontSize: FONT_SIZES.md,
        color: COLORS.textPrimary,
        fontWeight: '500',
    },
    modalCancel: {
        marginTop: SPACING.md,
        paddingVertical: SPACING.sm,
        alignItems: 'center',
    },
    modalCancelText: {
        fontSize: FONT_SIZES.md,
        color: COLORS.textSecondary,
        fontWeight: '600',
    },
});

export default TodayScreen;
