import React, { useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SPACING } from '../../../theme/theme';
import SectionHeader from '../../../components/planner/shared/SectionHeader';
import TodaySubjectCard from '../../../components/planner/SkipMode/TodaySubjectCard';
import OtherSubjectCard from '../../../components/planner/SkipMode/OtherSubjectCard';
import { getTodaysClasses } from '../../../utils/planner/scheduleProcessor';
import { determineStatus } from '../../../utils/planner/attendanceCalculations';

/**
 * Skip? mode view — shows today's classes expanded with skip/attend impact,
 * and other subjects collapsed below.
 */
export default function SkipModeView({ subjects, onSubjectPress }) {
    const todayClasses = useMemo(() => getTodaysClasses(subjects), [subjects]);

    const { todaySubjects, otherSubjects } = useMemo(() => {
        const todayIds = new Set(todayClasses.map(c => c.subject.id));
        const today = todayClasses
            .map(c => c.subject)
            .sort((a, b) => {
                // Sort by priority: danger first, then warning, then safe
                const statusA = determineStatus(a.percentage, a.target);
                const statusB = determineStatus(b.percentage, b.target);
                const priority = { danger: 0, warning: 1, safe: 2 };
                return (priority[statusA] || 2) - (priority[statusB] || 2);
            });

        const others = subjects
            .filter(s => !todayIds.has(s.id))
            .sort((a, b) => a.percentage - b.percentage); // Lowest % first

        return { todaySubjects: today, otherSubjects: others };
    }, [subjects, todayClasses]);

    return (
        <View style={styles.container}>
            {/* TODAY Section */}
            {todaySubjects.length > 0 && (
                <>
                    <SectionHeader title="TODAY" count={todaySubjects.length} />
                    {todaySubjects.map(subject => (
                        <TodaySubjectCard
                            key={subject.id}
                            subjectData={subject}
                            onPress={() => onSubjectPress(subject)}
                        />
                    ))}
                </>
            )}

            {/* OTHER SUBJECTS Section */}
            {otherSubjects.length > 0 && (
                <>
                    <SectionHeader title="OTHER SUBJECTS" count={otherSubjects.length} />
                    {otherSubjects.map(subject => (
                        <OtherSubjectCard
                            key={subject.id}
                            subjectData={subject}
                            onPress={() => onSubjectPress(subject)}
                        />
                    ))}
                </>
            )}

            <View style={{ height: SPACING.lg }} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
