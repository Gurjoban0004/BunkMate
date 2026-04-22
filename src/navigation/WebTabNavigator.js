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
import ERPConnectScreen from '../screens/main/ERPConnectScreen';

import { useApp } from '../context/AppContext';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../theme/theme';
import { NavigationContext, NavigationRouteContext } from '@react-navigation/native';

function TabIcon({ label, focused }) {
    const color = focused ? COLORS.primary : COLORS.textSecondary;
    const strokeWidth = focused ? 2 : 1.5;

    const icons = {
        Today: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
        ),
        Subjects: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
        ),
        Planner: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
        ),
        Settings: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
        ),
    };

    return (
        <View style={{ width: 24, height: 24, opacity: focused ? 1 : 0.7 }}>
            {icons[label]}
        </View>
    );
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

    // Refs so navigation callbacks always see current values without stale closures
    const stacksRef = React.useRef(stacks);
    const currentTabRef = React.useRef(currentTab);
    stacksRef.current = stacks; // Update synchronously
    currentTabRef.current = currentTab; // Update synchronously

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
                    window.history.pushState({ tab: screenOrTabName, index: stacksRef.current[screenOrTabName].length - 1 }, '', `?tab=${screenOrTabName}`);
                }
            } else {
                setStacks(prev => {
                    const tab = currentTabRef.current;
                    const newStack = [...prev[tab], { name: screenOrTabName, params }];
                    if (Platform.OS === 'web') {
                        window.history.pushState({ tab, index: newStack.length - 1 }, '', `?tab=${tab}&screen=${screenOrTabName}`);
                    }
                    return { ...prev, [tab]: newStack };
                });
            }
        },
        push: (screenOrTabName, params = {}) => {
            setStacks(prev => {
                const tab = currentTabRef.current;
                const newStack = [...prev[tab], { name: screenOrTabName, params }];
                if (Platform.OS === 'web') {
                    window.history.pushState({ tab, index: newStack.length - 1 }, '', `?tab=${tab}&screen=${screenOrTabName}`);
                }
                return { ...prev, [tab]: newStack };
            });
        },
        replace: (screenName, params = {}) => {
            setStacks(prev => {
                const tab = currentTabRef.current;
                const newStack = [...prev[tab].slice(0, -1), { name: screenName, params }];
                if (Platform.OS === 'web') {
                    window.history.replaceState({ tab, index: newStack.length - 1 }, '', `?tab=${tab}&screen=${screenName}`);
                }
                return { ...prev, [tab]: newStack };
            });
        },
        reset: (stateConfig) => {
            setStacks(prev => {
                const tab = currentTabRef.current;
                const routes = stateConfig.routes || [{ name: 'TodayMain', params: {} }];
                if (Platform.OS === 'web') {
                    window.history.pushState({ tab, index: routes.length - 1 }, '', `?tab=${tab}&screen=${routes[routes.length - 1].name}`);
                }
                return { ...prev, [tab]: routes };
            });
        },
        goBack: () => {
            setStacks(prev => {
                const tab = currentTabRef.current;
                const currentTabStack = prev[tab];
                if (currentTabStack.length > 1) {
                    const newStack = currentTabStack.slice(0, -1);
                    if (Platform.OS === 'web') {
                        const previousRoute = newStack[newStack.length - 1];
                        window.history.replaceState(
                            { tab, index: newStack.length - 1 },
                            '',
                            `?tab=${tab}&screen=${previousRoute.name}`
                        );
                    }
                    return { ...prev, [tab]: newStack };
                }
                return prev;
            });
        },
        canGoBack: () => stacksRef.current[currentTabRef.current].length > 1,
        setOptions: () => { }, // no-op
    }), []); // stable reference — uses refs internally

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
            case 'ERPConnect': screen = <ERPConnectScreen {...props} />; break;
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

            <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' && typeof window !== 'undefined' && window.navigator?.standalone ? 20 : 4) }]}>
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
