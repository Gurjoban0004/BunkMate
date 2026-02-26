import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Screens
import TodayScreen from '../screens/main/TodayScreen';
import SubjectsScreen from '../screens/main/SubjectsScreen';
import SubjectDetailScreen from '../screens/main/SubjectDetailScreen';
import PlannerScreen from '../screens/main/PlannerScreen';
import RecoveryPlanScreen from '../screens/main/RecoveryPlanScreen';
import EndGameScreen from '../screens/main/EndGameScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import EditTimetableScreen from '../screens/main/EditTimetableScreen';
import EditSubjectsScreen from '../screens/main/EditSubjectsScreen';
import PastAttendanceScreen from '../screens/main/PastAttendanceScreen';
import WeeklySummaryScreen from '../screens/main/WeeklySummaryScreen';

import { COLORS, TYPOGRAPHY } from '../theme/theme';

function TabIcon({ label, focused }) {
    const icons = {
        Today: '📅',
        Subjects: '📚',
        Planner: '🎯',
        Settings: '⚙️',
    };
    return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{icons[label]}</Text>;
}

export default function WebTabNavigator() {
    const insets = useSafeAreaInsets();

    // 1. Manage active tab
    const [currentTab, setCurrentTab] = useState('Today');

    // 2. Manage history stack for EACH tab independently
    const [stacks, setStacks] = useState({
        Today: [{ name: 'TodayMain', params: {} }],
        Subjects: [{ name: 'SubjectsList', params: {} }],
        Planner: [{ name: 'PlannerMain', params: {} }],
        Settings: [{ name: 'SettingsMain', params: {} }],
    });

    const activeStack = stacks[currentTab];
    const currentRoute = activeStack[activeStack.length - 1];

    // 3. Mock Navigation Object
    const mockNavigation = {
        navigate: (screenOrTabName, params = {}) => {
            // Check if jumping to a different tab directly
            if (['Today', 'Subjects', 'Planner', 'Settings'].includes(screenOrTabName)) {
                setCurrentTab(screenOrTabName);
                // Also reset that tab's stack optionally, or let it maintain state
            } else {
                // Otherwise push to current tab's stack
                setStacks(prev => ({
                    ...prev,
                    [currentTab]: [...prev[currentTab], { name: screenOrTabName, params }]
                }));
            }
        },
        goBack: () => {
            setStacks(prev => {
                const currentTabStack = prev[currentTab];
                if (currentTabStack.length > 1) {
                    return {
                        ...prev,
                        [currentTab]: currentTabStack.slice(0, -1)
                    };
                }
                return prev;
            });
        },
        setOptions: () => { }, // no-op
    };

    // Helper to render the exact screen component
    const renderScreen = () => {
        const props = {
            navigation: mockNavigation,
            route: { params: currentRoute.params }
        };

        switch (currentRoute.name) {
            // Today Stack
            case 'TodayMain': return <TodayScreen {...props} />;
            case 'PastAttendance': return <PastAttendanceScreen {...props} />;
            case 'WeeklySummary': return <WeeklySummaryScreen {...props} />;

            // Subjects Stack
            case 'SubjectsList': return <SubjectsScreen {...props} />;
            case 'SubjectDetail': return <SubjectDetailScreen {...props} />;

            // Planner Stack
            case 'PlannerMain': return <PlannerScreen {...props} />;
            case 'RecoveryPlan': return <RecoveryPlanScreen {...props} />;
            case 'EndGame': return <EndGameScreen {...props} />;

            // Settings Stack
            case 'SettingsMain': return <SettingsScreen {...props} />;
            case 'EditTimetable': return <EditTimetableScreen {...props} />;
            case 'EditSubjects': return <EditSubjectsScreen {...props} />;
            // Settings also re-uses PastAttendance, which is fine!

            default: return <TodayScreen {...props} />;
        }
    };

    return (
        <View style={styles.container}>
            {/* Main Screen Content */}
            <View style={styles.content}>
                {renderScreen()}
            </View>

            {/* Custom Bottom Tab Bar */}
            <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 4) }]}>
                {['Today', 'Subjects', 'Planner', 'Settings'].map((tabName) => {
                    const focused = currentTab === tabName;
                    return (
                        <TouchableOpacity
                            key={tabName}
                            style={styles.tabItem}
                            onPress={() => setCurrentTab(tabName)}
                            activeOpacity={0.7}
                        >
                            <TabIcon label={tabName} focused={focused} />
                            <Text style={[
                                styles.tabLabel,
                                { color: focused ? COLORS.primary : COLORS.textSecondary }
                            ]}>
                                {tabName}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    content: {
        flex: 1,
        // Optional relative positioning for safety
        position: 'relative',
        zIndex: 1,
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: COLORS.cardBackground,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        paddingTop: 8,
        // zIndex ensures tabs stay above web content
        zIndex: 100,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
    },
    tabLabel: {
        ...TYPOGRAPHY.caption,
        marginTop: 4,
        fontWeight: '500',
    },
});
