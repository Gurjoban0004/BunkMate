import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZES } from '../../../theme/theme';
import { useApp } from '../../../context/AppContext';
import { getAllSubjectsPlannerData } from '../../../utils/planner/dataAdapter';
import { hasClassesToday } from '../../../utils/planner/scheduleProcessor';

import DateHeader from '../../../components/planner/shared/DateHeader';
import PlannerModeToggle from '../../../components/planner/PlannerModeToggle';
import SkipModeView from './SkipModeView';
import FixModeView from './FixModeView';
import NoClassesTodayView from './NoClassesTodayView';

/**
 * Main Planner screen — container that switches between modes.
 * Shows NoClassesTodayView on days without classes,
 * otherwise shows Skip? / Fix toggle with corresponding views.
 */
const PlannerScreen = ({ navigation }) => {
    const styles = getStyles();
    const { state, triggerErpSync, isErpSyncing } = useApp();
    const [activeMode, setActiveMode] = useState('skip');
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        if (state.settings?.erpConnected && triggerErpSync) {
            triggerErpSync(true);
        }
        setTimeout(() => setRefreshing(false), 800);
    }, [state.settings?.erpConnected, triggerErpSync]);

    // Get all subjects in planner format
    const subjects = useMemo(
        () => getAllSubjectsPlannerData(state),
        [state]
    );

    // Use devDate if available, otherwise real today
    const activeDate = useMemo(() => state.devDate ? new Date(state.devDate) : new Date(), [state.devDate]);

    // Check if there are classes today
    const classesToday = useMemo(
        () => hasClassesToday(subjects, activeDate),
        [subjects, activeDate]
    );

    const handleSubjectPress = (subject) => {
        navigation.navigate('PlannerSubjectDetail', {
            subjectId: subject.id,
            subjectName: subject.name,
            initialMode: activeMode,
        });
    };

    const plannerSubtitle = activeMode === 'skip'
        ? 'Can you miss class without regret?'
        : 'What needs attention to recover?';

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
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.headerTitle}>Planner</Text>
                        <Text style={styles.headerSubtitle}>{plannerSubtitle}</Text>
                    </View>
                    <View style={styles.headerPill}>
                        <Text style={styles.headerPillText}>{activeMode === 'skip' ? 'Skip' : 'Fix'}</Text>
                    </View>
                </View>

                {/* Date */}
                <DateHeader date={activeDate} />

                {/* Mode Toggle Always Visible */}
                <PlannerModeToggle
                    activeMode={activeMode}
                    onModeChange={setActiveMode}
                />

                {/* Mode Views */}
                {activeMode === 'skip' && (
                    !classesToday ? (
                        <NoClassesTodayView
                            subjects={subjects}
                            onSubjectPress={handleSubjectPress}
                        />
                    ) : (
                        <SkipModeView
                            subjects={subjects}
                            onSubjectPress={handleSubjectPress}
                            activeDate={activeDate}
                        />
                    )
                )}

                {activeMode === 'fix' && (
                    <FixModeView
                        subjects={subjects}
                        onSubjectPress={handleSubjectPress}
                        defaultTarget={state.settings?.dangerThreshold || 75}
                    />
                )}

                <View style={{ height: 100 }} />
            </ScrollView>
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
        paddingTop: SPACING.sm,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        paddingTop: SPACING.xs,
        marginBottom: SPACING.md,
    },
    headerLeft: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: '800',
        letterSpacing: 0,
        color: COLORS.textPrimary,
    },
    headerSubtitle: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        marginTop: 4,
    },
    headerPill: {
        backgroundColor: COLORS.primaryLight,
        borderRadius: 999,
        paddingHorizontal: SPACING.md,
        paddingVertical: 7,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
    },
    headerPillText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '700',
        color: COLORS.primaryDark,
    },
});

export default PlannerScreen;
