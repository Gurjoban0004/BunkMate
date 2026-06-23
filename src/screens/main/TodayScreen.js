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
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS, TYPOGRAPHY } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import { getGreeting } from '../../utils/greeting';
import { getTodayClasses, getCurrentClassIndex } from '../../utils/attendance';
import { calculateFreshness } from '../../utils/erpFreshness';
import { getUnmarkedCount } from '../../utils/backlog';
import { getTodayKey, getTodayDayName } from '../../utils/dateHelpers';
import { getDayStatus } from '../../utils/planner.js';
import { generateWeeklyReport } from '../../utils/insights';

// Components
import TodayScheduleBar from '../../components/today/TodayScheduleBar';
import SectionHeader from '../../components/today/SectionHeader';
import ClassCard from '../../components/today/ClassCard';
import BacklogBanner from '../../components/today/BacklogBanner';
import EmptyDay from '../../components/today/EmptyDay';
import HolidayCard from '../../components/today/HolidayCard';
import AddExtraClassButton from '../../components/today/AddExtraClassButton';
import DeletionWarningBanner from '../../components/today/DeletionWarningBanner';
import AnnouncementBanner from '../../components/today/AnnouncementBanner';
import QuickAnswerCard from '../../components/planner/QuickAnswerCard';
import WeeklyReportCard from '../../components/insights/WeeklyReportCard';
import ErpWelcomeCard from '../../components/today/ErpWelcomeCard';
import ProfileAvatar from '../../components/common/ProfileAvatar';
import {
    DisplayMedium,
    BodyMedium,
    BodySmall,
} from '../../components/common/Typography';
import { showAlert } from '../../utils/alert';

const TodayScreen = ({ navigation }) => {
    const styles = getStyles();
    const { state, dispatch, triggerErpSync, isErpSyncing } = useApp();
    const [refreshing, setRefreshing] = useState(false);
    const [showExtraModal, setShowExtraModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [selectedExtraSubject, setSelectedExtraSubject] = useState(null);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Get devDate logic if active
    React.useEffect(() => {
        setCurrentTime(state.devDate ? new Date(state.devDate) : new Date());
        const timer = setInterval(() => {
            setCurrentTime(state.devDate ? new Date(state.devDate) : new Date());
        }, 60000); // UI updates every minute
        return () => clearInterval(timer);
    }, [state.devDate]);



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

    // Compute ERP Freshness
    const freshnessMap = useMemo(() => calculateFreshness(state, todayClasses), [state, todayClasses]);

    // Calculate stats
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

    // Weekly Report — show Fri through Mon
    const weeklyReport = useMemo(() => generateWeeklyReport(state), [state.subjects, state.attendanceRecords, state.holidays, state.devDate]);
    const [showWeeklyReport, setShowWeeklyReport] = useState(true);
    const dayOfWeek = today.getDay();
    const showWeeklyReportToday = showWeeklyReport && (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0 || dayOfWeek === 1);

    const nextClassInfo = useMemo(() => {
        if (!todayClasses || todayClasses.length === 0) return null;
        const nowMins = currentTime.getHours() * 60 + currentTime.getMinutes();
        for (const c of todayClasses) {
            const [h, m] = c.startTime.split(':').map(Number);
            const startMins = h * 60 + m;
            if (startMins > nowMins) {
                const hour12 = h % 12 || 12;
                const ampm = h >= 12 ? 'PM' : 'AM';
                const mins = m > 0 ? `:${String(m).padStart(2, '0')}` : '';
                return `${c.subjectName.split(' ')[0]} begins at ${hour12}${mins} ${ampm}`;
            }
        }
        return null;
    }, [todayClasses, currentTime]);


    // Pull to refresh — also triggers ERP sync if connected
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        if (state.settings?.erpConnected && triggerErpSync) {
            triggerErpSync(true); // force = true, bypass 15-min cooldown
        }
        setTimeout(() => setRefreshing(false), 800);
    }, [state.settings?.erpConnected, triggerErpSync]);

    const handleDismissWelcomeCard = useCallback(() => {
        dispatch({ type: 'UPDATE_SETTINGS', payload: { erpWelcomeCardDismissed: true } });
    }, [dispatch]);

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
            'Mark as Holiday',
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

    const handleCancelClassPress = () => {
        setShowCancelModal(true);
    };

    const handleCancelClassConfirm = (subjectId, units) => {
        dispatch({
            type: 'MARK_ATTENDANCE',
            payload: {
                date: todayKey,
                subjectId,
                status: 'cancelled',
                units,
            },
        });
        setShowCancelModal(false);
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
        const now = currentTime;
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        if (todayClasses.length === 0) {
            return { now: null, upcoming: [], done: [] };
        }

        if (currentClassIndex !== -1) {
            // A class is actively in progress right now
            return {
                now: todayClasses[currentClassIndex],
                upcoming: todayClasses.slice(currentClassIndex + 1),
                done: todayClasses.slice(0, currentClassIndex),
            };
        }

        // No class in progress — partition by time
        // A class is "done" if its end time has passed
        // A class is "upcoming" if its start time hasn't been reached yet
        // A class is "now" if it started but getCurrentClassIndex missed it (edge case guard)
        const done = [];
        const upcoming = [];
        let inProgress = null;

        todayClasses.forEach(c => {
            const startMins = c.startTime.split(':').map(Number).reduce((h, m) => h * 60 + m);
            const endMins = c.endTime.split(':').map(Number).reduce((h, m) => h * 60 + m);

            if (currentMinutes >= endMins) {
                done.push(c);
            } else if (currentMinutes >= startMins && currentMinutes < endMins) {
                // In progress but not caught by getCurrentClassIndex — treat as "now"
                inProgress = c;
            } else {
                upcoming.push(c);
            }
        });

        return { now: inProgress, upcoming, done };
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
                    <View style={{ flex: 1 }}>
                        <DisplayMedium style={styles.greeting}>
                            {greeting.text}
                        </DisplayMedium>
                        <BodyMedium color="textSecondary" style={styles.date}>{dateString}</BodyMedium>
                        {isErpSyncing && (
                            <BodySmall color="textMuted" style={{ marginTop: 4 }}>
                                Syncing from portal...
                            </BodySmall>
                        )}
                    </View>
                </View>

                {/* Deletion Warning Banner */}
                <DeletionWarningBanner />

                {/* Global Admin Announcements */}
                <AnnouncementBanner />

                {/* ERP Welcome Card — shown once after first sync */}
                <ErpWelcomeCard
                    state={state}
                    onDismiss={handleDismissWelcomeCard}
                />

                {/* Today's Schedule Bar */}
                <TodayScheduleBar
                    todayClasses={todayClasses}
                    attendanceRecords={state.attendanceRecords}
                    todayKey={todayKey}
                    currentTime={currentTime}
                    nextClassInfo={nextClassInfo}
                />

                {/* Quick Answer Card */}
                {!isHoliday && todayClasses.length > 0 && (
                    <QuickAnswerCard
                        dayStatus={todaySkipStatus}
                        compact={true}
                    />
                )}

                {/* Weekly Report */}
                {showWeeklyReportToday && (
                    <WeeklyReportCard
                        report={weeklyReport}
                        onDismiss={() => setShowWeeklyReport(false)}
                    />
                )}

                {/* Backlog — shown below insights, not leading the screen */}
                {unmarkedCount > 0 && (
                    <BacklogBanner
                        count={unmarkedCount}
                        onPress={handleBacklogPress}
                    />
                )}

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
                                        freshnessData={freshnessMap[classInfo.subjectId]}
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
                            onCancelClassPress={handleCancelClassPress}
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
                                            freshnessData={freshnessMap[now.subjectId]}
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
                                                freshnessData={freshnessMap[classInfo.subjectId]}
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
                                                freshnessData={freshnessMap[classInfo.subjectId]}
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


                {/* Settings Footer */}
                <TouchableOpacity
                    style={styles.settingsFooter}
                    onPress={() => navigation.navigate('Settings')}
                    activeOpacity={0.7}
                >
                    <ProfileAvatar name={state.userName} size={24} onPress={() => navigation.navigate('Settings')} />
                    <Text style={styles.settingsFooterText}>Settings</Text>
                </TouchableOpacity>

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

            {/* Cancel Class Modal */}
            <Modal
                visible={showCancelModal}
                transparent={true}
                animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
                onRequestClose={() => setShowCancelModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Cancel Class</Text>
                        <Text style={styles.modalSubtitle}>Select a class from today</Text>
                        <ScrollView style={styles.modalScroll}>
                            {todayClasses.map((c, index) => (
                                <TouchableOpacity
                                    key={`cancel-${c.subjectId}-${index}`}
                                    style={styles.modalItem}
                                    onPress={() => handleCancelClassConfirm(c.subjectId, c.units)}
                                >
                                    <View style={[styles.modalDot, { backgroundColor: c.color }]} />
                                    <View>
                                        <Text style={styles.modalItemText}>{c.subjectName}</Text>
                                        <Text style={{fontSize: 12, color: COLORS.textSecondary}}>{c.startTime} - {c.endTime}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                            {todayClasses.length === 0 && (
                                <Text style={styles.modalSubtitle}>No classes scheduled today.</Text>
                            )}
                        </ScrollView>
                        <TouchableOpacity
                            style={styles.modalCancel}
                            onPress={() => setShowCancelModal(false)}
                        >
                            <Text style={styles.modalCancelText}>Close</Text>
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
        paddingBottom: SPACING.xxl,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.screenPadding,
        paddingBottom: 40,
    },
    setupDayCard: {
        marginHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.md,
        padding: SPACING.lg,
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.success,
    },
    setupDayTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: COLORS.successDark,
        marginBottom: SPACING.xs,
    },
    setupDayText: {
        fontSize: 12,
        fontWeight: '500',
        color: COLORS.textSecondary,
        lineHeight: 18,
    },
    greeting: {
        fontSize: 22,
        fontWeight: '800',
        color: COLORS.textPrimary,
        letterSpacing: -0.5,
    },
    date: {
        fontSize: 12,
        fontWeight: '500',
        color: COLORS.textSecondary,
        marginTop: 4,
        letterSpacing: 0.1,
    },
    sectionContainer: {
        marginTop: SPACING.sm,
    },
    sectionLabel: {
        fontSize: 9,
        fontWeight: '700',
        color: COLORS.textMuted,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        paddingHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.sm,
    },
    nowBadge: {
        alignSelf: 'flex-start',
        backgroundColor: COLORS.primary,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 3,
        borderRadius: BORDER_RADIUS.sm,
        marginLeft: SPACING.screenPadding,
        marginBottom: SPACING.sm,
    },
    nowBadgeText: {
        fontSize: 9,
        fontWeight: '700',
        color: COLORS.textOnPrimary,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    bottomPadding: {
        height: 100,
    },
    settingsFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: SPACING.xl,
        gap: SPACING.sm,
    },
    settingsFooterText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.textMuted,
        letterSpacing: 0.5,
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: COLORS.overlay,
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: COLORS.cardBackground,
        borderTopLeftRadius: BORDER_RADIUS.lg,
        borderTopRightRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        maxHeight: '60%',
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: COLORS.border,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.textPrimary,
        textAlign: 'center',
        letterSpacing: -0.3,
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
