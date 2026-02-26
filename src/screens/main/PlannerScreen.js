import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZES } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import { getTodayDayName } from '../../utils/dateHelpers';
import {
    getDayStatus,
    getWeekPlan,
    getPriorityList,
    getQuickWins,
} from '../../utils/planner';

// Components
import ModeToggle from '../../components/planner/ModeToggle';
import QuickAnswerCard from '../../components/planner/QuickAnswerCard';
import WeekCalendar from '../../components/planner/WeekCalendar';
import DayDetailSheet from '../../components/planner/DayDetailSheet';
import EndGameButton from '../../components/planner/EndGameButton';
import StatusSummary from '../../components/planner/StatusSummary';
import PriorityList from '../../components/planner/PriorityList';
import QuickWins from '../../components/planner/QuickWins';
import CalculatorView from '../../components/calculator/CalculatorView';

const THRESHOLD = 75;

const PlannerScreen = ({ navigation }) => {
    const { state } = useApp();

    // Smart default: auto-select recovery if any subject below threshold
    const priorityList = useMemo(() => getPriorityList(state, THRESHOLD), [state]);
    const hasLowSubjects = priorityList.some((s) => s.priority === 'critical');

    const [activeMode, setActiveMode] = useState(hasLowSubjects ? 'recovery' : 'bunk');
    const [selectedDay, setSelectedDay] = useState(null);
    const [dayDetailVisible, setDayDetailVisible] = useState(false);

    // Bunk mode data
    const todayDayName = getTodayDayName();
    const todayStatus = useMemo(() => getDayStatus(state, todayDayName, THRESHOLD), [state, todayDayName]);
    const weekPlan = useMemo(() => getWeekPlan(state, THRESHOLD), [state]);

    // Recovery mode data
    const quickWins = useMemo(() => getQuickWins(state, THRESHOLD), [state]);

    // Day detail data
    const selectedDayData = useMemo(() => {
        if (!selectedDay) return null;
        const dayInfo = weekPlan.find((d) => d.dayName === selectedDay);
        return dayInfo || null;
    }, [selectedDay, weekPlan]);

    const handleDayPress = (dayName) => {
        setSelectedDay(dayName);
        setDayDetailVisible(true);
    };

    const handleRecoveryPress = (subject) => {
        navigation.navigate('RecoveryPlan', {
            subjectId: subject.id,
            subjectName: subject.name,
            threshold: THRESHOLD,
        });
    };

    const handleEndGamePress = () => {
        navigation.navigate('EndGame');
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Planner</Text>
                    <Text style={styles.headerEmoji}>🎯</Text>
                </View>

                {/* Mode Toggle */}
                <ModeToggle activeMode={activeMode} onModeChange={setActiveMode} />

                {/* Bunk Mode */}
                {activeMode === 'bunk' && (
                    <>
                        {/* Quick Answer */}
                        <QuickAnswerCard dayStatus={todayStatus} />

                        {/* Week Calendar */}
                        <WeekCalendar
                            weekPlan={weekPlan}
                            selectedDay={selectedDay}
                            onDayPress={handleDayPress}
                        />

                        {/* End Game Button */}
                        <EndGameButton onPress={handleEndGamePress} />
                    </>
                )}

                {/* Recovery Mode */}
                {activeMode === 'recovery' && (
                    <>
                        {/* Status Summary */}
                        <StatusSummary
                            priorityList={priorityList}
                            threshold={THRESHOLD}
                            onBunkModePress={() => setActiveMode('bunk')}
                        />

                        {/* Priority List */}
                        <PriorityList
                            priorityList={priorityList}
                            threshold={THRESHOLD}
                            onRecoveryPress={handleRecoveryPress}
                        />

                        {/* Quick Wins */}
                        <QuickWins quickWins={quickWins} />
                    </>
                )}

                {/* Calculator Mode */}
                {activeMode === 'calculator' && (
                    <CalculatorView navigation={navigation} />
                )}

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Day Detail Sheet */}
            <DayDetailSheet
                visible={dayDetailVisible}
                dayData={selectedDayData}
                onClose={() => setDayDetailVisible(false)}
            />
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
});

export default PlannerScreen;
