import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { View, StyleSheet, Platform, Animated } from 'react-native';
import useRouteTransition from '../hooks/useRouteTransition';
import PresenceTabBar from '../components/ios/PresenceTabBar';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import { allowedWebTab, initialWebTab } from './webTabRouting';

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
import { COLORS } from '../theme/theme';
import { NavigationContext, NavigationRouteContext } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { isAdminUser } from '../services/adminService';
import { trackScreen } from '../services/usage';

// Web only — AdminTab.native.js is an empty stub, so the panel is not in the APK.
import { ADMIN_AVAILABLE, AdminScreen } from './AdminTab';

export default function WebTabNavigator() {
    const styles = getStyles();
    const insets = useSafeAreaInsets();
    const { state: appState } = useApp();
    const isAdmin = ADMIN_AVAILABLE && isAdminUser(appState);
    const [currentTab, setCurrentTab] = useState(() => initialWebTab(window.location.search, isAdmin));
    const [stacks, setStacks] = useState({
        Today: [{ name: 'TodayMain', params: {} }],
        Subjects: [{ name: 'SubjectsList', params: {} }],
        Insights: [{ name: 'InsightsMain', params: {} }],
        Admin: [{ name: 'AdminMain', params: {} }],
    });

    const activeStack = stacks[currentTab];
    const currentRoute = activeStack[activeStack.length - 1];
    const transitionStyle = useRouteTransition(`${currentTab}:${currentRoute.name}`);
    useEffect(() => { trackScreen(currentRoute.name); }, [currentTab, currentRoute.name]);

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
                    const tab = allowedWebTab(state.tab, isAdmin);
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
            const tab = initialWebTab(window.location.search, isAdmin);
            const params = new URLSearchParams(window.location.search);
            params.set('tab', tab);
            window.history.replaceState({ tab, index: 0 }, '', `${window.location.pathname}?${params}`);

            return () => window.removeEventListener('popstate', handlePopState);
        }
    }, [isAdmin]);

    useEffect(() => {
        if (!isAdmin && currentTab === 'Admin') setCurrentTab('Today');
    }, [isAdmin, currentTab]);

    const mockNavigation = useMemo(() => ({
        navigate: (screenOrTabName, params = {}) => {
            if (['Today', 'Subjects', 'Insights', 'Admin'].includes(screenOrTabName)) {
                if (allowedWebTab(screenOrTabName, isAdmin) !== screenOrTabName) return;
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
    }), [isAdmin]); // stack refs stay live; admin capability follows authenticated state

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
            case 'AdminMain': screen = isAdmin && AdminScreen ? <Suspense fallback={<BrandLoader />}><AdminScreen {...props} /></Suspense> : <TodayScreen {...props} />; break;
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
                <SafeAreaInsetsContext.Provider value={{ ...insets, bottom: 0 }}>
                    {renderScreen()}
                </SafeAreaInsetsContext.Provider>
            </Animated.View>

            <PresenceTabBar tabs={['Today', 'Subjects', 'Insights', ...(isAdmin ? ['Admin'] : [])]} activeTab={currentTab} onSelect={(tab) => mockNavigation.navigate(tab)} />
        </View>
    );
}

const getStyles = () => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        minHeight: 0,
    },
    content: {
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        position: 'relative',
        zIndex: 1,
    },
});
