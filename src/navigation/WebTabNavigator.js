import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Screens
import TodayScreen from '../screens/main/TodayScreen';
import SubjectsScreen from '../screens/main/SubjectsScreen';
import SubjectDetailScreen from '../screens/main/SubjectDetailScreen';
import PlannerScreen from '../screens/main/PlannerScreen';
import PlannerSubjectDetail from '../screens/main/PlannerScreen/PlannerSubjectDetail';
import SettingsScreen from '../screens/main/SettingsScreen';
import EditTimetableScreen from '../screens/main/EditTimetableScreen';
import EditSubjectsScreen from '../screens/main/EditSubjectsScreen';
import PastAttendanceScreen from '../screens/main/PastAttendanceScreen';
import AttendanceStatsScreen from '../screens/setup/AttendanceStatsScreen';
import WeeklySummaryScreen from '../screens/main/WeeklySummaryScreen';
import SyncFromPortalScreen from '../screens/main/SyncFromPortalScreen';


import { useApp } from '../context/AppContext';
import { COLORS, TYPOGRAPHY } from '../theme/theme';
import { NavigationContext, NavigationRouteContext } from '@react-navigation/native';

function TabIcon({ label, focused }) {
    const styles = getStyles();
    const icons = {
        Today: '📅',
        Subjects: '📚',
        Planner: '🎯',
        Settings: '⚙️',
    };
    return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{icons[label]}</Text>;
}

export default function WebTabNavigator() {
    const styles = getStyles();
    const insets = useSafeAreaInsets();
    const { state } = useApp();

    const defaultTab = state.settings?.landingPage === 'planner' ? 'Planner' : 'Today';

    const [currentTab, setCurrentTab] = useState(defaultTab);
    const [stacks, setStacks] = useState({
        Today: [{ name: 'TodayMain', params: {} }],
        Subjects: [{ name: 'SubjectsList', params: {} }],
        Planner: [{ name: 'PlannerMain', params: {} }],
        Settings: [{ name: 'SettingsMain', params: {} }],
    });

    const activeStack = stacks[currentTab];
    const currentRoute = activeStack[activeStack.length - 1];

    useEffect(() => {
        if (Platform.OS === 'web') {
            const handlePopState = (event) => {
                const state = event.state;
                if (state && state.tab && typeof state.index === 'number') {
                    setCurrentTab(state.tab);
                    setStacks(prev => {
                        const tabStack = prev[state.tab];
                        if (state.index < tabStack.length) {
                            return {
                                ...prev,
                                [state.tab]: tabStack.slice(0, state.index + 1)
                            };
                        }
                        return prev;
                    });
                } else {
                    setCurrentTab('Today');
                    setStacks({
                        Today: [{ name: 'TodayMain', params: {} }],
                        Subjects: [{ name: 'SubjectsList', params: {} }],
                        Planner: [{ name: 'PlannerMain', params: {} }],
                        Settings: [{ name: 'SettingsMain', params: {} }],
                    });
                }
            };

            window.addEventListener('popstate', handlePopState);
            window.history.replaceState({ tab: 'Today', index: 0 }, '', window.location.pathname);

            return () => window.removeEventListener('popstate', handlePopState);
        }
    }, []);

    const mockNavigation = useMemo(() => ({
        navigate: (screenOrTabName, params = {}) => {
            if (['Today', 'Subjects', 'Planner', 'Settings'].includes(screenOrTabName)) {
                setCurrentTab(screenOrTabName);
                if (Platform.OS === 'web') {
                    window.history.pushState({ tab: screenOrTabName, index: stacks[screenOrTabName].length - 1 }, '', `?tab=${screenOrTabName}`);
                }
            } else {
                setStacks(prev => {
                    const newStack = [...prev[currentTab], { name: screenOrTabName, params }];
                    if (Platform.OS === 'web') {
                        window.history.pushState({ tab: currentTab, index: newStack.length - 1 }, '', `?tab=${currentTab}&screen=${screenOrTabName}`);
                    }
                    return { ...prev, [currentTab]: newStack };
                });
            }
        },
        push: (screenOrTabName, params = {}) => {
            setStacks(prev => {
                const newStack = [...prev[currentTab], { name: screenOrTabName, params }];
                if (Platform.OS === 'web') {
                    window.history.pushState({ tab: currentTab, index: newStack.length - 1 }, '', `?tab=${currentTab}&screen=${screenOrTabName}`);
                }
                return { ...prev, [currentTab]: newStack };
            });
        },
        replace: (screenName, params = {}) => {
            setStacks(prev => {
                const newStack = [...prev[currentTab].slice(0, -1), { name: screenName, params }];
                if (Platform.OS === 'web') {
                    window.history.replaceState({ tab: currentTab, index: newStack.length - 1 }, '', `?tab=${currentTab}&screen=${screenName}`);
                }
                return { ...prev, [currentTab]: newStack };
            });
        },
        reset: (stateConfig) => {
            // Simplified reset handling for custom web navigator
            setStacks(prev => {
                const routes = stateConfig.routes || [{ name: 'TodayMain', params: {} }];
                if (Platform.OS === 'web') {
                    window.history.pushState({ tab: currentTab, index: routes.length - 1 }, '', `?tab=${currentTab}&screen=${routes[routes.length - 1].name}`);
                }
                return { ...prev, [currentTab]: routes };
            });
        },
        goBack: () => {
            setStacks(prev => {
                const currentTabStack = prev[currentTab];
                if (currentTabStack.length > 1) {
                    const newStack = currentTabStack.slice(0, -1);
                    if (Platform.OS === 'web') {
                        const previousRoute = newStack[newStack.length - 1];
                        // Use pushState here so we don't mess up browser history too badly,
                        // or better yet, just replaceState so the URL matches current visual state
                        window.history.replaceState(
                            { tab: currentTab, index: newStack.length - 1 },
                            '',
                            `?tab=${currentTab}&screen=${previousRoute.name}`
                        );
                    }
                    return { ...prev, [currentTab]: newStack };
                }
                return prev;
            });
        },
        canGoBack: () => stacks[currentTab].length > 1,
        setOptions: () => { }, // no-op
    }), [currentTab, stacks]);

    const renderScreen = () => {
        const props = {
            navigation: mockNavigation,
            route: { params: currentRoute.params }
        };

        let screen;
        switch (currentRoute.name) {
            case 'TodayMain': screen = <TodayScreen {...props} />; break;
            case 'PastAttendance': screen = <PastAttendanceScreen {...props} />; break;
            case 'WeeklySummary': screen = <WeeklySummaryScreen {...props} />; break;
            case 'SubjectsList': screen = <SubjectsScreen {...props} />; break;
            case 'SubjectDetail': screen = <SubjectDetailScreen {...props} />; break;
            case 'PlannerMain': screen = <PlannerScreen {...props} />; break;
            case 'PlannerSubjectDetail': screen = <PlannerSubjectDetail {...props} />; break;
            case 'SettingsMain': screen = <SettingsScreen {...props} />; break;
            case 'EditTimetable': screen = <EditTimetableScreen {...props} />; break;
            case 'EditSubjects': screen = <EditSubjectsScreen {...props} />; break;
            case 'AttendanceStats': screen = <AttendanceStatsScreen {...props} />; break;
            case 'SyncFromPortal': screen = <SyncFromPortalScreen {...props} />; break;
            default: screen = <TodayScreen {...props} />; break;
        }

        return (
            <NavigationContext.Provider value={mockNavigation}>
                <NavigationRouteContext.Provider value={props.route}>
                    {screen}
                </NavigationRouteContext.Provider>
            </NavigationContext.Provider>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                {renderScreen()}
            </View>

            <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 4) }]}>
                {['Today', 'Subjects', 'Planner', 'Settings'].map((tabName) => {
                    const focused = currentTab === tabName;
                    return (
                        <TouchableOpacity
                            key={tabName}
                            style={styles.tabItem}
                            onPress={() => mockNavigation.navigate(tabName)}
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

const getStyles = () => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    content: {
        flex: 1,
        position: 'relative',
        zIndex: 1,
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: COLORS.cardBackground,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        paddingTop: 8,
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
