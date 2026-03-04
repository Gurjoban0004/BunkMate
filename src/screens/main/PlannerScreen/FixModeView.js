import React, { useState, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { SPACING } from '../../../theme/theme';
import SectionHeader from '../../../components/planner/shared/SectionHeader';
import TargetSelector from '../../../components/planner/FixMode/TargetSelector';
import OverviewCard from '../../../components/planner/FixMode/OverviewCard';
import NeedsWorkCard from '../../../components/planner/FixMode/NeedsWorkCard';
import OnTrackCard from '../../../components/planner/FixMode/OnTrackCard';
import { determineStatus } from '../../../utils/planner/attendanceCalculations';

/**
 * Fix mode view — target selector, overview, needs-work and on-track lists.
 */
export default function FixModeView({ subjects, onSubjectPress }) {
    const [target, setTarget] = useState(75);

    const { needsWork, onTrack } = useMemo(() => {
        const nw = [];
        const ot = [];

        subjects.forEach(subject => {
            const status = determineStatus(subject.percentage, target);
            if (status === 'danger' || status === 'warning') {
                nw.push(subject);
            } else {
                ot.push(subject);
            }
        });

        // Sort needs-work by percentage ascending (worst first)
        nw.sort((a, b) => a.percentage - b.percentage);
        // Sort on-track by percentage descending (best first)
        ot.sort((a, b) => b.percentage - a.percentage);

        return { needsWork: nw, onTrack: ot };
    }, [subjects, target]);

    return (
        <View style={styles.container}>
            <TargetSelector value={target} onChange={setTarget} />

            <OverviewCard
                needsWorkCount={needsWork.length}
                onTrackCount={onTrack.length}
                target={target}
            />

            {/* Needs Work Section */}
            {needsWork.length > 0 && (
                <>
                    <SectionHeader title="NEEDS WORK" count={needsWork.length} />
                    {needsWork.map(subject => (
                        <NeedsWorkCard
                            key={subject.id}
                            subjectData={subject}
                            target={target}
                            onPress={() => onSubjectPress(subject)}
                        />
                    ))}
                </>
            )}

            {/* On Track Section */}
            {onTrack.length > 0 && (
                <>
                    <SectionHeader title="ON TRACK" count={onTrack.length} />
                    {onTrack.map(subject => (
                        <OnTrackCard
                            key={subject.id}
                            subjectData={subject}
                            target={target}
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
