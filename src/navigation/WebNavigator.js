import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';

// Import Screens
import WelcomeScreen from '../screens/setup/WelcomeScreen';
import NameScreen from '../screens/setup/NameScreen';
import TimeSlotsScreen from '../screens/setup/TimeSlotsScreen';
import TimetableBuilderScreen from '../screens/setup/TimetableBuilderScreen';
import ExistingAttendanceScreen from '../screens/setup/ExistingAttendanceScreen';
import TeacherNamesScreen from '../screens/setup/TeacherNamesScreen';
import SetupCompleteScreen from '../screens/setup/SetupCompleteScreen';

import { COLORS } from '../theme/theme';

export default function WebNavigator() {
    // 1. Manage history stack
    const [history, setHistory] = useState([
        { name: 'Welcome', params: {} }
    ]);

    // Current active screen is always top of the stack
    const currentRoute = history[history.length - 1];

    // 2. Mock Navigation Object for child screens
    const mockNavigation = {
        navigate: (screenName, params = {}) => {
            setHistory(prev => [...prev, { name: screenName, params }]);
        },
        goBack: () => {
            setHistory(prev => {
                if (prev.length > 1) {
                    return prev.slice(0, -1);
                }
                return prev;
            });
        },
        setOptions: () => {
            // No-op for web header updates
        },
    };

    // Helper to render the actual screen component with the mock nav/route props
    const renderScreen = () => {
        const props = {
            navigation: mockNavigation,
            route: { params: currentRoute.params }
        };

        switch (currentRoute.name) {
            case 'Welcome': return <WelcomeScreen {...props} />;
            case 'Name': return <NameScreen {...props} />;
            case 'TimeSlots': return <TimeSlotsScreen {...props} />;
            case 'TimetableBuilder': return <TimetableBuilderScreen {...props} />;
            case 'ExistingAttendance': return <ExistingAttendanceScreen {...props} />;
            case 'TeacherNames': return <TeacherNamesScreen {...props} />;
            case 'SetupComplete': return <SetupCompleteScreen {...props} />;
            default: return <WelcomeScreen {...props} />;
        }
    };

    return (
        <View style={styles.container}>
            {renderScreen()}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
});
