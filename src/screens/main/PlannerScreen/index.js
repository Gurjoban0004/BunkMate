import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
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
    const { state } = useApp();
    const [activeMode, setActiveMode] = useState('skip');

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
        paddingTop: SPACING.xl,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        marginBottom: SPACING.sm,
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
