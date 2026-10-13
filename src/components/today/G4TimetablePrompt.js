import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useApp } from '../../context/AppContext';
import { COLORS, PAPER, SERIF_FONT } from '../../theme/theme';
import { suppliedG4Timetable, isG4PortalGroup } from '../../utils/cohortTimetable';
import { useBannerSlot } from './BannerSlot';

export default function G4TimetablePrompt({ allowDismiss = true }) {
    const { state, dispatch, triggerErpSync } = useApp();
    const group = state.timetableMeta?.group;
    const eligible = !state.settings?.academicCohort && (!allowDismiss || !state.settings?.cohortPromptDismissed) && (!group || isG4PortalGroup(group));
    const visible = useBannerSlot(4, eligible);
    if (!visible) return null;
    const mapped = suppliedG4Timetable(state.subjects || []);
    const button = { minHeight: 48, padding: 10, justifyContent: 'center' };
    const text = { fontFamily: SERIF_FONT, fontSize: 15, color: PAPER.apricotInk };
    return <View style={{ margin: 20, padding: 12, borderRadius: 12, backgroundColor: PAPER.lavender }}>
        <Text style={{ ...text, fontWeight: '700' }}>Are you in CSE · Semester 5 · G4?</Text>
        <Text style={{ ...text, fontSize: 13, marginTop: 4 }}>{mapped ? 'Use the Oct 6 timetable. A changed Chalkpad grid will replace it.' : 'Sync your subjects first to match the G4 timetable.'}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={mapped ? 'Confirm CSE semester 5 G4 timetable' : 'Sync subjects for G4 timetable'} onPress={() => mapped ? dispatch({ type: 'ACTIVATE_G4_TIMETABLE', payload: { branch: 'CSE', semester: 5, group: 'G4' } }) : triggerErpSync?.(true)} style={button}><Text style={{ ...text, fontWeight: '700' }}>{mapped ? 'Yes, use it' : 'Sync subjects'}</Text></TouchableOpacity>
            {allowDismiss && <TouchableOpacity accessibilityRole="button" onPress={() => dispatch({ type: 'UPDATE_SETTINGS', payload: { cohortPromptDismissed: true } })} style={button}><Text style={text}>Another section</Text></TouchableOpacity>}
        </View>
    </View>;
}
