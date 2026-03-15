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
    Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS, TYPOGRAPHY } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import { getGreeting } from '../../utils/greeting';
import { getTodayClasses, getCurrentClassIndex, calculateOverallPercentage } from '../../utils/attendance';
import { calculateOverallStreak } from '../../utils/streak';
import { getUnmarkedCount } from '../../utils/backlog';
import { getTodayKey, getTodayDayName, isPastTime } from '../../utils/dateHelpers';
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
import DeletionWarningBanner from '../../components/today/DeletionWarningBanner';
import QuickAnswerCard from '../../components/planner/QuickAnswerCard';
import {
    DisplayMedium,
    HeadingMedium,
    HeadingSmall,
    BodyMedium,
    BodySmall,
    CaptionMedium
} from '../../components/common/Typography';
import { showAlert } from '../../utils/alert';

const TodayScreen = ({ navigation }) => {
    const styles = getStyles();
    const { state, dispatch, runAutopilotCheck } = useApp();
    const [refreshing, setRefreshing] = useState(false);
    const [showExtraModal, setShowExtraModal] = useState(false);
    const [selectedExtraSubject, setSelectedExtraSubject] = useState(null);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Run autopilot check on mount or when state changes (debounced/throttled internally)
    React.useEffect(() => {
        if (state.settings?.autopilotEnabled) {
            runAutopilotCheck();
        }
    }, [state.settings?.autopilotEnabled]);

    // Get devDate logic if active
    React.useEffect(() => {
        setCurrentTime(state.devDate ? new Date(state.devDate) : new Date());
        const timer = setInterval(() => {
            setCurrentTime(state.devDate ? new Date(state.devDate) : new Date());
        }, 60000); // UI updates every minute
        return () => clearInterval(timer);
    }, [state.devDate]);

    // Autopilot settings
    const autopilotEnabled = state.settings?.autopilotEnabled || false;
    const autopilotReview = state.autopilotReview;
    const autopilotDiscoveryDismissed = state.autopilotDiscoveryDismissed;

    // Get greeting
    const greeting = getGreeting(state.userName || 'there', state.devDate);

    // Get today's data
    const today = state.devDate ? new Date(state.devDate) : new Date();
    const dateString = today.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    });

    // Get today key for records
    const todayKey = getTodayKey(state.devDate);

    // Get classes
    const todayClasses = getTodayClasses(state, state.devDate);
    const currentClassIndex = getCurrentClassIndex(todayClasses, state.devDate);

    // Calculate stats
    const streak = calculateOverallStreak(state);
    const overallPercentage = calculateOverallPercentage(state);
    const classCount = todayClasses.length;

    // Check if today is holiday
    const isHoliday = (state.holidays || []).includes(todayKey) ||
        state.attendanceRecords[todayKey]?._holiday;

    // Check if this is a setup day (today < trackingStartDate)
    const isSetupDay = state.trackingStartDate && todayKey < state.trackingStartDate;

    // Check for unmarked backlog
    const unmarkedCount = useMemo(() => getUnmarkedCount(state), [state]);

    // Quick Answer: can I skip today?
    const todayDayName = getTodayDayName(state.devDate);
    const dangerThreshold = state.settings?.dangerThreshold || 75;
    const todaySkipStatus = useMemo(() => getDayStatus(state, todayDayName, dangerThreshold), [state, todayDayName, dangerThreshold]);

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
            const now = currentTime;
            const currentMinutes = now.getHours() * 60 + now.getMinutes();

            if (todayClasses.length === 0) {
                return { now: null, upcoming: [], done: [] };
            }

            // Partition into done (end time passed) and upcoming (start time not yet reached)
            const done = todayClasses.filter(c => {
                const [eh, em] = c.endTime.split(':').map(Number);
                return currentMinutes >= eh * 60 + em;
            });
            const upcoming = todayClasses.filter(c => {
                const [sh, sm] = c.startTime.split(':').map(Number);
                return currentMinutes < sh * 60 + sm;
            });

            return { now: null, upcoming, done };
        }

        const now = todayClasses[currentClassIndex];
        const upcoming = todayClasses.slice(currentClassIndex + 1);
        const done = todayClasses.slice(0, currentClassIndex);

        return { now, upcoming, done };
    };

    const { now, upcoming, done } = categorizeClasses();

    // ─── AUTOPILOT UI COMPONENTS ──────────────────────────────────────

    const DiscoveryBanner = () => {
        if (autopilotEnabled || autopilotDiscoveryDismissed) return null;

        return (
            <View style={styles.discoveryCard}>
                <View style={styles.discoveryContent}>
                    <Text style={styles.discoveryEmoji}>🤖</Text>
                    <View style={styles.discoveryTextContainer}>
                        <HeadingSmall style={styles.discoveryTitle}>Meet Autopilot</HeadingSmall>
                        <BodySmall style={styles.discoverySubtitle}>
                            Forget marking classes? Let the app do it automatically every night.
                        </BodySmall>
                    </View>
                </View>
                <View style={styles.discoveryActions}>
                    <TouchableOpacity
                        style={styles.discoveryDismissBtn}
                        onPress={() => dispatch({ type: 'DISMISS_AUTOPILOT_DISCOVERY' })}
                    >
                        <CaptionMedium>Maybe Later</CaptionMedium>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.discoveryEnableBtn}
                        onPress={() => navigation.navigate('Settings')}
                    >
                        <CaptionMedium color="textOnPrimary">Setup Now</CaptionMedium>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const ReviewCard = () => {
        if (!autopilotReview || autopilotReview.dismissed) return null;

        return (
            <View style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                    <HeadingSmall style={styles.reviewTitle}>🤖 Autopilot Ran</HeadingSmall>
                    <BodySmall style={styles.reviewSubtitle}>
                        Automatically marked {autopilotReview.count} missing class{autopilotReview.count > 1 ? 'es' : ''} for {autopilotReview.date}.
                    </BodySmall>
                </View>
                <View style={styles.reviewActions}>
                    <TouchableOpacity
                        style={styles.reviewDismissBtn}
                        onPress={() => dispatch({ type: 'DISMISS_AUTOPILOT_REVIEW' })}
                    >
                        <CaptionMedium>Dismiss</CaptionMedium>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.reviewViewBtn}
                        onPress={() => {
                            dispatch({ type: 'DISMISS_AUTOPILOT_REVIEW' });
                            navigation.navigate('PastAttendance');
                        }}
                    >
                        <CaptionMedium color="textOnPrimary">Review Classes</CaptionMedium>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const format12Hour = (time24) => {
        const [h, m] = time24.split(':');
        let hours = parseInt(h, 10);
        const ampm = hours >= 12 ? 'pm' : 'am';
        hours = hours % 12 || 12;
        return `${hours}:${m}${ampm}`;
    };

    const AutopilotIndicator = () => {
        if (!autopilotEnabled) return null;
        const triggerTime = state.settings?.autopilotTime || '20:00';

        return (
            <View style={styles.indicatorContainer}>
                <Text style={styles.indicatorText}>
                    🤖 Autopilot runs at {format12Hour(triggerTime)} today
                </Text>
            </View>
        );
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
                <View style={styles.header}>
                    <DisplayMedium style={styles.greeting}>
                        {greeting.text} {greeting.emoji}
                    </DisplayMedium>
                    <BodyMedium color="textSecondary" style={styles.date}>{dateString}</BodyMedium>
                </View>

                {/* Deletion Warning Banner */}
                <DeletionWarningBanner />

                {/* Autopilot Discovery or Review */}
                {autopilotReview && !autopilotReview.dismissed ? (
                    <ReviewCard />
                ) : (
                    <>
                        <DiscoveryBanner />
                        {unmarkedCount > 0 && (
                            <BacklogBanner
                                count={unmarkedCount}
                                onPress={handleBacklogPress}
                            />
                        )}
                    </>
                )}

                {/* Quick Answer Card */}
                {!isHoliday && todayClasses.length > 0 && (
                    <QuickAnswerCard
                        dayStatus={todaySkipStatus}
                        compact={true}
                        onPlannerPress={() => navigation.navigate('Planner')}
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
                ) : isSetupDay ? (
                    <>
                        <View style={styles.setupDayCard}>
                            <Text style={styles.setupDayTitle}>Setup Complete!</Text>
                            <Text style={styles.setupDayText}>
                                Today's attendance was included in your initial numbers.{'\n'}
                                Daily tracking starts tomorrow!
                            </Text>
                        </View>

                        <SectionHeader
                            title="Today's Classes (Already Counted)"
                            classCount={classCount}
                            hideHolidayButton={true}
                        />

                        {/* Empty State */}
                        {classCount === 0 ? (
                            <EmptyDay />
                        ) : (
                            <View style={styles.sectionContainer}>
                                {todayClasses.map((classInfo, index) => (
                                    <ClassCard
                                        key={`setup-${classInfo.subjectId}-${index}`}
                                        classInfo={classInfo}
                                        state={state}
                                        onMark={() => { }}
                                        isCurrentClass={false}
                                        isPreCounted={true}
                                    />
                                ))}
                            </View>
                        )}
                    </>
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
                                            <Text style={styles.nowBadgeText}>NOW</Text>
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

                <AutopilotIndicator />

                {/* Bottom Padding */}
                <View style={styles.bottomPadding} />
            </ScrollView>

            {/* Extra Class Modal */}
            <Modal
                visible={showExtraModal}
                transparent={true}
                animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
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
        paddingBottom: SPACING.xl,
    },
    header: {
        paddingHorizontal: SPACING.screenPadding,
        paddingBottom: SPACING.lg,
    },
    setupDayCard: {
        marginHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.md,
        padding: SPACING.lg,
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,


        borderLeftWidth: 4,
        borderLeftColor: COLORS.success,
    },
    setupDayTitle: {
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
        color: COLORS.successDark,
        marginBottom: SPACING.xs,
    },
    setupDayText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        lineHeight: 20,
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
        marginTop: SPACING.md,
    },
    sectionLabel: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '600',
        color: COLORS.textMuted,
        letterSpacing: 0.5,
        paddingHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.sm,
    },
    nowBadge: {
        alignSelf: 'flex-start',
        backgroundColor: COLORS.primary,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.md,
        marginLeft: SPACING.screenPadding,
        marginBottom: SPACING.sm,
    },
    nowBadgeText: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '700',
        color: COLORS.textOnPrimary,
    },
    bottomPadding: {
        height: 100,
    },
    // ─── AUTOPILOT STYLES ─────────────────────────────────
    discoveryCard: {
        backgroundColor: COLORS.cardBackground,
        marginHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        ...SHADOWS.small,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.primary,
    },
    discoveryContent: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    discoveryEmoji: {
        fontSize: 32,
        marginRight: SPACING.sm,
    },
    discoveryTextContainer: {
        flex: 1,
    },
    discoveryTitle: {
        ...TYPOGRAPHY.headerSmall,
        color: COLORS.textPrimary,
        marginBottom: 2,
    },
    discoverySubtitle: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
        lineHeight: 18,
    },
    discoveryActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: SPACING.sm,
    },
    discoveryDismissBtn: {
        paddingHorizontal: SPACING.md,
        paddingVertical: 8,
        borderRadius: BORDER_RADIUS.md,
        backgroundColor: COLORS.inputBackground,
    },
    discoveryDismissText: {
        ...TYPOGRAPHY.button,
        color: COLORS.textSecondary,
    },
    discoveryEnableBtn: {
        paddingHorizontal: SPACING.md,
        paddingVertical: 8,
        borderRadius: BORDER_RADIUS.md,
        backgroundColor: COLORS.primary,
    },
    discoveryEnableText: {
        ...TYPOGRAPHY.button,
        color: COLORS.textOnPrimary,
    },
    reviewCard: {
        backgroundColor: COLORS.primaryLight,
        marginHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
    },
    reviewHeader: {
        marginBottom: SPACING.md,
    },
    reviewTitle: {
        ...TYPOGRAPHY.headerSmall,
        color: COLORS.primary,
        marginBottom: 4,
    },
    reviewSubtitle: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
    },
    reviewActions: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    reviewDismissBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: BORDER_RADIUS.md,
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.5)',
    },
    reviewDismissText: {
        ...TYPOGRAPHY.button,
        color: COLORS.textSecondary,
    },
    reviewViewBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: BORDER_RADIUS.md,
        alignItems: 'center',
        backgroundColor: COLORS.primary,
    },
    reviewViewText: {
        ...TYPOGRAPHY.button,
        color: COLORS.textOnPrimary,
    },
    indicatorContainer: {
        marginHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.md,
        alignItems: 'center',
    },
    indicatorText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: COLORS.overlay,
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
