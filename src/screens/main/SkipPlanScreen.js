import React from 'react';
import CombinedSkipPlanner from '../../components/insights/CombinedSkipPlanner';

export default function SkipPlanScreen({ route, navigation }) {
    return <CombinedSkipPlanner navigation={navigation} initialSubjectId={route?.params?.subjectId} />;
}
