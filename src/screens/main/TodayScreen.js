import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useCallback, useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import { getGreeting } from '../../utils/greeting';
import { getTodayClasses, getCurrentClassIndex } from '../../utils/attendance';
import { getTodayKey, getTodayDayName, parseTimeToMinutes } from '../../utils/dateHelpers';
import { getDayStatus } from '../../utils/planner.js';
import { shortSubjectName } from '../../utils/subjectName';

import TodayScheduleBar from '../../components/today/TodayScheduleBar';
import SectionHeader from '../../components/today/SectionHeader';
import ClassCard from '../../components/today/ClassCard';
import RestDayView from '../../components/today/RestDayView';
import HolidayCard from '../../components/today/HolidayCard';
import DeletionWarningBanner from '../../components/today/DeletionWarningBanner';
import AnnouncementBanner from '../../components/today/AnnouncementBanner';
import ReconnectCard from '../../components/today/ReconnectCard';
import QuickAnswerCard from '../../components/planner/QuickAnswerCard';
import ErpWelcomeCard from '../../components/today/ErpWelcomeCard';
import { BannerHost } from '../../components/today/BannerSlot';
import ProfileAvatar from '../../components/common/ProfileAvatar';
import { DisplayMedium, BodyMedium, BodySmall } from '../../components/common/Typography';
import { showAlert } from '../../utils/alert';

const TodayScreen = ({ navigation }) => {
    const styles = getStyles();
    const { state, dispatch, triggerErpSync, isErpSyncing } = useApp();
    const [refreshing, setRefreshing] = useState(false);
    const [currentTime, setCurrentTime] = useState(() => (state.devDate ? new Date(state.devDate) : new Date()));

    useEffect(() => {
        setCurrentTime(state.devDate ? new Date(state.devDate) : new Date());
        const timer = setInterval(() => setCurrentTime(state.devDate ? new Date(state.devDate) : new Date()), 60000);
        return () => clearInterval(timer);
    }, [state.devDate]);

    const greeting = getGreeting(state.userName || 'there', state.devDate);
    const today = state.devDate ? new Date(state.devDate) : new Date();
    const dateString = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const todayKey = getTodayKey(state.devDate);
    const todayDayName = getTodayDayName(state.devDate);

    const todayClasses = useMemo(() => getTodayClasses(state, state.devDate), [state]);
    const currentClassIndex = getCurrentClassIndex(todayClasses, state.devDate);
    const isHoliday = (state.holidays || []).includes(todayKey) || !!state.attendanceRecords[todayKey]?._holiday;

    const dangerThreshold = state.settings?.dangerThreshold || 75;
    const todaySkipStatus = useMemo(() => getDayStatus(state, todayDayName, dangerThreshold), [state, todayDayName, dangerThreshold]);

    const nextClassInfo = useMemo(() => {
        const nowMins = currentTime.getHours() * 60 + currentTime.getMinutes();
        for (const c of todayClasses) {
            const startMins = parseTimeToMinutes(c.startTime);
            if (startMins > nowMins) {
                const [h, m] = c.startTime.split(':').map(Number);
                const hour12 = h % 12 || 12;
                const mins = m > 0 ? `:${String(m).padStart(2, '0')}` : '';
                return `${shortSubjectName(c.subjectName)} at ${hour12}${mins} ${h >= 12 ? 'PM' : 'AM'}`;
            }
        }
        return null;
    }, [todayClasses, currentTime]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        if (state.settings?.erpConnected && triggerErpSync) triggerErpSync(true);
        setTimeout(() => setRefreshing(false), 800);
    }, [state.settings?.erpConnected, triggerErpSync]);

    const handleDismissWelcomeCard = useCallback(() => {
        dispatch({ type: 'UPDATE_SETTINGS', payload: { erpWelcomeCardDismissed: true } });
    }, [dispatch]);

    const handleHolidayPress = () => {
        showAlert(
            'Holiday today?',
            'Today’s classes will not be expected in your plans. Your attendance is unchanged.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Mark holiday', onPress: () => dispatch({ type: 'MARK_HOLIDAY', payload: todayKey }) },
            ]
        );
    };

    // Now / upcoming / earlier, by the clock.
    const { now, upcoming, done } = useMemo(() => {
        if (todayClasses.length === 0) return { now: null, upcoming: [], done: [] };
        if (currentClassIndex !== -1) {
            return {
                now: todayClasses[currentClassIndex],
                upcoming: todayClasses.slice(currentClassIndex + 1),
                done: todayClasses.slice(0, currentClassIndex),
            };
        }
        const nowMins = currentTime.getHours() * 60 + currentTime.getMinutes();
        const doneList = [];
        const upcomingList = [];
        todayClasses.forEach((c) => {
            if (nowMins >= parseTimeToMinutes(c.endTime)) doneList.push(c);
            else upcomingList.push(c);
        });
        return { now: null, upcoming: upcomingList, done: doneList };
    }, [todayClasses, currentClassIndex, currentTime]);

    const statusLine = isErpSyncing
        ? 'Syncing with your college…'
        : state.isOnline === false ? 'Offline — showing what you had' : null;

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
            >
                <View style={styles.header}>
                    <View style={{ flex: 1 }}>
                        <DisplayMedium style={styles.greeting}>{greeting.text}</DisplayMedium>
                        <BodyMedium color="textSecondary" style={styles.date}>{dateString}</BodyMedium>
                        {statusLine && <BodySmall color="textMuted" style={{ marginTop: 4 }}>{statusLine}</BodySmall>}
                    </View>
                </View>

                <TodayScheduleBar
                    todayClasses={todayClasses}
                    attendanceRecords={state.attendanceRecords}
                    todayKey={todayKey}
                    currentTime={currentTime}
                    nextClassInfo={nextClassInfo}
                />

                {/* One banner at a time — see BannerSlot. */}
                <BannerHost>
                    <DeletionWarningBanner />
                    <ReconnectCard />
                    <AnnouncementBanner />
                    <ErpWelcomeCard state={state} onDismiss={handleDismissWelcomeCard} />
                </BannerHost>

                {isHoliday ? (
                    <HolidayCard onUndo={() => dispatch({ type: 'REMOVE_HOLIDAY', payload: todayKey })} />
                ) : todayClasses.length === 0 ? (
                    <RestDayView state={state} dayName={todayDayName} navigation={navigation} />
                ) : (
                    <>
                        <QuickAnswerCard dayStatus={todaySkipStatus} compact={true} />

                        <SectionHeader title="Today" classCount={todayClasses.length} onHolidayPress={handleHolidayPress} />

                        {now && (
                            <View style={styles.sectionContainer}>
                                <View style={styles.nowBadge}><Text style={styles.nowBadgeText}>NOW</Text></View>
                                <ClassCard classInfo={now} state={state} isCurrentClass />
                            </View>
                        )}
                        {upcoming.length > 0 && (
                            <View style={styles.sectionContainer}>
                                {(now || done.length > 0) && <Text style={styles.sectionLabel}>UPCOMING</Text>}
                                {upcoming.map((c, i) => <ClassCard key={`${c.subjectId}-${i}`} classInfo={c} state={state} />)}
                            </View>
                        )}
                        {done.length > 0 && (
                            <View style={styles.sectionContainer}>
                                <Text style={styles.sectionLabel}>EARLIER TODAY</Text>
                                {done.map((c, i) => <ClassCard key={`${c.subjectId}-done-${i}`} classInfo={c} state={state} />)}
                            </View>
                        )}
                    </>
                )}

                <TouchableOpacity
                    style={styles.settingsFooter}
                    onPress={() => navigation.navigate('Settings')}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Open settings"
                >
                    <ProfileAvatar name={state.userName} size={24} onPress={() => navigation.navigate('Settings')} />
                    <Text style={styles.settingsFooterText}>Settings</Text>
                </TouchableOpacity>

                <View style={styles.bottomPadding} />
            </ScrollView>
        </SafeAreaView>
    );
};

const getStyles = () => StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    scrollView: { flex: 1 },
    scrollContent: { paddingTop: SPACING.lg, paddingBottom: SPACING.xxl },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.screenPadding, paddingBottom: 40 },
    greeting: { fontWeight: '700', fontSize: 22, color: COLORS.textPrimary, letterSpacing: -0.5 },
    date: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4, letterSpacing: 0.1 },
    sectionContainer: { marginTop: SPACING.sm },
    sectionLabel: {
        ...TYPOGRAPHY.micro, color: COLORS.textMuted,
        paddingHorizontal: SPACING.screenPadding, marginBottom: SPACING.sm,
    },
    nowBadge: {
        alignSelf: 'flex-start', backgroundColor: COLORS.primary, paddingHorizontal: SPACING.sm, paddingVertical: 3,
        borderRadius: BORDER_RADIUS.sm, marginLeft: SPACING.screenPadding, marginBottom: SPACING.sm,
    },
    nowBadgeText: { ...TYPOGRAPHY.micro, color: COLORS.textOnPrimary },
    bottomPadding: { height: 100 },
    settingsFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: SPACING.xl, gap: SPACING.sm },
    settingsFooterText: { ...TYPOGRAPHY.labelSmall, color: COLORS.textMuted, letterSpacing: 0.5 },
});

export default TodayScreen;
