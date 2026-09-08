import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useCallback, useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { COLORS, SPACING, PAPER } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import { getGreeting } from '../../utils/greeting';
import { getTodayClasses, getCurrentClassIndex } from '../../utils/attendance';
import { getTodayKey, getTodayDayName, parseTimeToMinutes } from '../../utils/dateHelpers';
import { getDayStatus } from '../../utils/planner.js';
import { shortSubjectName } from '../../utils/subjectName';

import TodayScheduleBar from '../../components/today/TodayScheduleBar';
import SectionHeader from '../../components/today/SectionHeader';
import ClassCard from '../../components/today/ClassCard';
import ClassBento from '../../components/today/ClassBento';
import PaperHeader from '../../components/today/PaperHeader';
import RestDayView from '../../components/today/RestDayView';
import HolidayCard from '../../components/today/HolidayCard';
import DeletionWarningBanner from '../../components/today/DeletionWarningBanner';
import AnnouncementBanner from '../../components/today/AnnouncementBanner';
import ReconnectCard from '../../components/today/ReconnectCard';
import QuickAnswerCard from '../../components/planner/QuickAnswerCard';
import ErpWelcomeCard from '../../components/today/ErpWelcomeCard';
import { BannerHost } from '../../components/today/BannerSlot';
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
    // "Good evening, Gurjoban" is two lines on paper: the salutation, then the
    // name at a larger size. getGreeting still owns the wording.
    const [salutation, greetedName] = (() => {
        const text = greeting.text || '';
        const comma = text.lastIndexOf(', ');
        return comma === -1 ? [text, ''] : [`${text.slice(0, comma)},`, text.slice(comma + 2)];
    })();
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
            'Today’s classes will not be expected in our plans. Our attendance is unchanged.',
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
        ? 'Syncing with our college…'
        : state.isOnline === false ? 'Offline — showing what you had' : null;

    return (
        <SafeAreaView style={styles.container} edges={['left', 'right']}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
            >
                <PaperHeader
                    greeting={salutation}
                    name={greetedName}
                    dateString={dateString}
                    statusLine={statusLine}
                    initial={(state.userName || '?')[0].toUpperCase()}
                    onAvatarPress={() => navigation.navigate('Settings')}
                />

                {/* The schedule card rides up over the paper's bottom edge —
                    the seam in the replica that ties the two together. */}
                <View style={styles.content}>
                    <View style={styles.scheduleLift}>
                        <TodayScheduleBar
                            todayClasses={todayClasses}
                            attendanceRecords={state.attendanceRecords}
                            todayKey={todayKey}
                            currentTime={currentTime}
                            nextClassInfo={nextClassInfo}
                            subjects={state.subjects}
                        />
                    </View>
                </View>

                {/* One banner at a time — see BannerSlot. */}
                <BannerHost>
                    <DeletionWarningBanner />
                    <ReconnectCard />
                    <AnnouncementBanner />
                    <ErpWelcomeCard state={state} onDismiss={handleDismissWelcomeCard} />
                </BannerHost>

                <View style={styles.content}>
                    {isHoliday ? (
                        <HolidayCard onUndo={() => dispatch({ type: 'REMOVE_HOLIDAY', payload: todayKey })} />
                    ) : todayClasses.length === 0 ? (
                        <RestDayView state={state} dayName={todayDayName} navigation={navigation} />
                    ) : (
                        <>
                            <QuickAnswerCard dayStatus={todaySkipStatus} compact={true} />

                            <SectionHeader title="Today" classCount={todayClasses.length} onHolidayPress={handleHolidayPress} />

                            {/* The class happening now keeps the full card. Every
                                other class of the day is a bento tile — the same
                                facts, two to a row. */}
                            {now && (
                                <>
                                    <View style={styles.nowFlag}>
                                        <View style={styles.nowDot} />
                                        <Text style={styles.nowFlagText}>NOW</Text>
                                    </View>
                                    <ClassCard classInfo={now} state={state} isCurrentClass />
                                </>
                            )}

                            {upcoming.length > 0 && (
                                <>
                                    {(now || done.length > 0) && <Text style={styles.minorLabel}>UPCOMING</Text>}
                                    <View style={styles.bento}>
                                        {upcoming.map((c, i) => (
                                            <ClassBento
                                                key={`${c.subjectId}-${i}`}
                                                classInfo={c}
                                                state={state}
                                                // A lone trailing tile takes the
                                                // whole row rather than sitting
                                                // half-width against nothing.
                                                wide={upcoming.length % 2 === 1 && i === upcoming.length - 1}
                                                onPress={() => navigation.navigate('SubjectDetail', { subjectId: c.subjectId, subjectName: c.subjectName })}
                                            />
                                        ))}
                                    </View>
                                </>
                            )}

                            {done.length > 0 && (
                                <>
                                    <Text style={styles.minorLabel}>EARLIER TODAY</Text>
                                    <View style={styles.bento}>
                                        {done.map((c, i) => (
                                            <ClassBento
                                                key={`${c.subjectId}-done-${i}`}
                                                classInfo={c}
                                                state={state}
                                                variant="done"
                                                wide
                                                onPress={() => navigation.navigate('SubjectDetail', { subjectId: c.subjectId, subjectName: c.subjectName })}
                                            />
                                        ))}
                                    </View>
                                </>
                            )}
                        </>
                    )}
                </View>

                <View style={styles.bottomPadding} />
            </ScrollView>
        </SafeAreaView>
    );
};

const getStyles = () => StyleSheet.create({
    container: { flex: 1, backgroundColor: PAPER.background },
    scrollView: { flex: 1 },
    scrollContent: { paddingBottom: SPACING.xxl },

    // 20px gutter, as in the replica's `.content`.
    content: { paddingHorizontal: 20 },
    scheduleLift: { marginTop: -17 },

    nowFlag: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, marginBottom: 7, marginLeft: 2 },
    nowDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: PAPER.primary },
    nowFlagText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.55, color: PAPER.primary },

    minorLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.6, color: PAPER.muted, marginTop: 16, marginBottom: 8 },
    bento: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

    bottomPadding: { height: 100 },
});

export default TodayScreen;
