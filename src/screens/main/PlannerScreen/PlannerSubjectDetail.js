import React, { useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../../../theme/theme';
import { useApp } from '../../../context/AppContext';
import { getSubjectPlannerData } from '../../../utils/planner/dataAdapter';
import { simulateAttendance } from '../../../utils/planner/attendanceCalculations';
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
    const { subjectId, initialMode = 'skip' } = route.params;
    const { state } = useApp();

    const subjectData = useMemo(
        () => getSubjectPlannerData(subjectId, state),
        [subjectId, state]
    );

    const [simulationOffset, setSimulationOffset] = React.useState(0);

    const simulatedSubjectData = useMemo(() => {
        if (!subjectData) return null;
        if (simulationOffset === 0) return subjectData;

        const sim = simulateAttendance(subjectData.attended, subjectData.total, simulationOffset);
        return {
            ...subjectData,
            attended: sim.attended,
            total: sim.total,
            percentage: sim.percentage
        };
    }, [subjectData, simulationOffset]);

    if (!subjectData) return null;

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <FloatingBackButton />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <StatusHeader subjectData={simulatedSubjectData} />

                {initialMode === 'skip' ? (
                    <>
                        <NextClassDecision subjectData={simulatedSubjectData} />
                        <WhatIfSimulator
                            subjectData={subjectData}
                            simulatedSubjectData={simulatedSubjectData}
                            initialMode={initialMode}
                            simulationOffset={simulationOffset}
                            setSimulationOffset={setSimulationOffset}
                        />
                        <Next7DaysView subjectData={simulatedSubjectData} />
                        <RecoveryPaths subjectData={simulatedSubjectData} />
                    </>
                ) : (
                    <>
                        <RecoveryPaths subjectData={simulatedSubjectData} />
                        <WhatIfSimulator
                            subjectData={subjectData}
                            simulatedSubjectData={simulatedSubjectData}
                            initialMode={initialMode}
                            simulationOffset={simulationOffset}
                            setSimulationOffset={setSimulationOffset}
                        />
                        <NextClassDecision subjectData={simulatedSubjectData} />
                        <Next7DaysView subjectData={simulatedSubjectData} />
                    </>
                )}

                <PatternsInsights subjectData={simulatedSubjectData} />

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
