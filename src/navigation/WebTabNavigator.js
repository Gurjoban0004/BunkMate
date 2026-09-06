import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform, Animated } from 'react-native';
import useRouteTransition from '../hooks/useRouteTransition';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Screens
import TodayScreen from '../screens/main/TodayScreen';
import SubjectsScreen from '../screens/main/SubjectsScreen';
import SubjectDetailScreen from '../screens/main/SubjectDetailScreen';
import SubjectPlannerScreen from '../screens/main/SubjectPlannerScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import EditTimetableScreen from '../screens/main/EditTimetableScreen';
import EditSubjectsScreen from '../screens/main/EditSubjectsScreen';
import ERPConnectScreen from '../screens/main/ERPConnectScreen';
import InsightsScreen from '../screens/main/InsightsScreen';
import BrandLoader from '../components/common/BrandLoader';
import TabIcon from './TabIcon';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../theme/theme';
import { NavigationContext, NavigationRouteContext } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { isAdminUser } from '../services/adminService';

// The admin dashboard is only ever loaded for an admin.
const AdminScreen = React.lazy(() => import('../screens/main/AdminScreen'));

export default function WebTabNavigator() {
    const styles = getStyles();
    const insets = useSafeAreaInsets();
    const { state: appState } = useApp();
    const isAdmin = isAdminUser(appState);
    const [currentTab, setCurrentTab] = useState('Today');
    const [stacks, setStacks] = useState({
        Today: [{ name: 'TodayMain', params: {} }],
        Subjects: [{ name: 'SubjectsList', params: {} }],
        Insights: [{ name: 'InsightsMain', params: {} }],
        Admin: [{ name: 'AdminMain', params: {} }],
    });

    const activeStack = stacks[currentTab];
    const currentRoute = activeStack[activeStack.length - 1];
    const transitionStyle = useRouteTransition(`${currentTab}:${currentRoute.name}`);

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
                    const tab = ['Today', 'Subjects', 'Insights', 'Admin'].includes(state.tab) ? state.tab : 'Today';
                    setCurrentTab(tab);
                    setStacks(prev => {
                        const tabStack = prev[tab];
                        if (tabStack && state.index < tabStack.length) {
                            return {
                                ...prev,
                                [tab]: tabStack.slice(0, state.index + 1)
                            };
                        }
                        return prev;
                    });
                } else {
                    setCurrentTab('Today');
                    setStacks({
                        Today: [{ name: 'TodayMain', params: {} }],
                        Subjects: [{ name: 'SubjectsList', params: {} }],
                        Insights: [{ name: 'InsightsMain', params: {} }],
                        Admin: [{ name: 'AdminMain', params: {} }],
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
            if (['Today', 'Subjects', 'Insights', 'Admin'].includes(screenOrTabName)) {
                // Tapping the already-active tab pops its stack to root (native tab behavior)
                if (currentTabRef.current === screenOrTabName) {
                    setStacks(prev => {
                        if (prev[screenOrTabName].length <= 1) return prev;
                        const root = [prev[screenOrTabName][0]];
                        if (Platform.OS === 'web') {
                            window.history.pushState({ tab: screenOrTabName, index: 0 }, '', `?tab=${screenOrTabName}`);
                        }
                        return { ...prev, [screenOrTabName]: root };
                    });
                    return;
                }
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
            case 'SubjectsList': screen = <SubjectsScreen {...props} />; break;
            case 'SubjectDetail': screen = <SubjectDetailScreen {...props} />; break;
            case 'SubjectPlanner': screen = <SubjectPlannerScreen {...props} />; break;
            case 'Settings': screen = <SettingsScreen {...props} />; break;
            case 'EditTimetable': screen = <EditTimetableScreen {...props} />; break;
            case 'EditSubjects': screen = <EditSubjectsScreen {...props} />; break;
            case 'ERPConnect': screen = <ERPConnectScreen {...props} />; break;
            case 'InsightsMain': screen = <InsightsScreen {...props} />; break;
            case 'AdminMain': screen = <Suspense fallback={<BrandLoader />}><AdminScreen {...props} /></Suspense>; break;
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
            <Animated.View style={[styles.content, transitionStyle]}>
                {renderScreen()}
            </Animated.View>

            <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' && typeof window !== 'undefined' && window.navigator?.standalone ? 20 : 4) }]}>
                {['Today', 'Subjects', 'Insights', ...(isAdmin ? ['Admin'] : [])].map((tabName) => {
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
        ...TYPOGRAPHY.captionMedium,
        marginTop: 4,
        fontWeight: '500',
    },
});
