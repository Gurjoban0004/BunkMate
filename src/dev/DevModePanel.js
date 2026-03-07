import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import PlannerDevTools from './PlannerDevTools';
import { DEV_MODE, DEV_MODE_CONFIG } from './config';
import { useApp } from '../context/AppContext';
import { MOCK_SCENARIOS } from './mockData/mockScenarios';
import { COLORS, SHADOWS } from '../theme/theme';

export default function DevModePanel() {
    const styles = getStyles();
    const { state, dispatch } = useApp();
    const [isOpen, setIsOpen] = useState(false);

    if (!DEV_MODE || !DEV_MODE_CONFIG.showDevPanel) {
        return null;
    }

    const handleLoadScenario = (scenarioData) => {
        if (scenarioData._triggerAutopilot) {
            runAutopilotCheck();
            return;
        }
        dispatch({ type: 'LOAD_STATE', payload: scenarioData });
    };

    const handleUpdateSubject = (subjectId, updates) => {
        dispatch({ type: 'UPDATE_SUBJECT', payload: { id: subjectId, ...updates } });
    };

    const handleChangeDate = (newDate) => {
        dispatch({ type: 'SET_DEV_DATE', payload: newDate });
    };

    const handleClearData = () => {
        dispatch({ type: 'RESET_STATE' });
    };

    // We fall back to the real new Date() if no devDate is set
    const activeDate = state.devDate || new Date();

    return (
        <>
            <TouchableOpacity
                style={styles.floatingButton}
                onPress={() => setIsOpen(true)}
                activeOpacity={0.8}
            >
                <Text style={styles.floatingButtonText}>🔧</Text>
            </TouchableOpacity>

            <PlannerDevTools
                subjects={state.subjects}
                timetable={state.timetable}
                records={state.attendanceRecords}
                onLoadScenario={handleLoadScenario}
                onUpdateSubject={handleUpdateSubject}
                onUpdateRecords={(recordsUpdate) => {
                    // To simplify, if we replace history, we can just merge or re-load it
                    dispatch({ type: 'LOAD_STATE', payload: { ...state, attendanceRecords: recordsUpdate } });
                }}
                onClearData={handleClearData}
                currentDate={activeDate}
                onChangeDate={handleChangeDate}
                isVisible={isOpen}
                onClose={() => setIsOpen(false)}
                scenarios={MOCK_SCENARIOS}
            />
        </>
    );
}

const getStyles = () => StyleSheet.create({
    floatingButton: {
        position: 'absolute',
        bottom: 80,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: COLORS.danger,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        ...SHADOWS.large,
    },
    floatingButtonText: {
        fontSize: 24,
    },
});
