import React, { useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../../../theme/theme';
import { useApp } from '../../../context/AppContext';
import { getSubjectPlannerData } from '../../../utils/planner/dataAdapter';
import FloatingBackButton from '../../../components/common/FloatingBackButton';

import StatusHeader from '../../../components/planner/SubjectDetail/StatusHeader';
import NextClassDecision from '../../../components/planner/SubjectDetail/NextClassDecision';
import WhatIfSimulator from '../../../components/planner/SubjectDetail/WhatIfSimulator';
import Next7DaysView from '../../../components/planner/SubjectDetail/Next7DaysView';
import RecoveryPaths from '../../../components/planner/SubjectDetail/RecoveryPaths';
import PatternsInsights from '../../../components/planner/SubjectDetail/PatternsInsights';

/**
 * Full-page subject detail view from the Planner.
 * Receives subjectId via route params.
 */
export default function PlannerSubjectDetail({ route }) {
    const { subjectId } = route.params;
    const { state } = useApp();

    const subjectData = useMemo(
        () => getSubjectPlannerData(subjectId, state),
        [subjectId, state]
    );

    if (!subjectData) return null;

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <FloatingBackButton />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <StatusHeader subjectData={subjectData} />
                <NextClassDecision subjectData={subjectData} />
                <WhatIfSimulator subjectData={subjectData} />
                <Next7DaysView subjectData={subjectData} />
                <RecoveryPaths subjectData={subjectData} />
                <PatternsInsights subjectData={subjectData} />

                <View style={{ height: SPACING.xxl }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        padding: SPACING.lg,
    },
});
