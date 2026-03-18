import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';

import LoginScreen from '../screens/setup/LoginScreen';
import WelcomeScreen from '../screens/setup/WelcomeScreen';
import SubjectListScreen from '../screens/setup/SubjectListScreen';
import TimeSlotsScreen from '../screens/setup/TimeSlotsScreen';
import TimetableBuilderScreen from '../screens/setup/TimetableBuilderScreen';
import AttendanceStatsScreen from '../screens/setup/AttendanceStatsScreen';
import SetupCompleteScreen from '../screens/setup/SetupCompleteScreen';

import { COLORS } from '../theme/theme';
import { useApp } from '../context/AppContext';
import { NavigationContext, NavigationRouteContext } from '@react-navigation/native';

export default function WebNavigator() {
    const styles = getStyles();
    const { state } = useApp();
    const initialRoute = state.userId ? 'Welcome' : 'Login';
    const [history, setHistory] = useState([
        { name: initialRoute, params: {} }
    ]);

    const currentRoute = history[history.length - 1];
    // Ref so navigation callbacks always see current history without stale closure
    const historyRef = React.useRef(history);
    historyRef.current = history; // Update synchronously so canGoBack is accurate during child render

    useEffect(() => {
        if (Platform.OS === 'web') {
            const handlePopState = (event) => {
                const state = event.state;
                if (state && typeof state.index === 'number') {
                    setHistory(prev => {
                        if (state.index < prev.length) {
                            return prev.slice(0, state.index + 1);
                        }
                        return prev;
                    });
                } else {
                    // Fallback to initial route
                    setHistory([{ name: 'Welcome', params: {} }]);
                }
            };

            window.addEventListener('popstate', handlePopState);
            // Initialize base state
            window.history.replaceState({ index: 0 }, '', window.location.pathname);

            return () => window.removeEventListener('popstate', handlePopState);
        }
    }, []);

    const mockNavigation = useMemo(() => ({
        navigate: (screenName, params = {}) => {
            setHistory(prev => {
                const newStack = [...prev, { name: screenName, params }];
                if (Platform.OS === 'web') {
                    window.history.pushState({ index: newStack.length - 1 }, '', `?screen=${screenName}`);
                }
                return newStack;
            });
        },
        push: (screenName, params = {}) => {
            setHistory(prev => {
                const newStack = [...prev, { name: screenName, params }];
                if (Platform.OS === 'web') {
                    window.history.pushState({ index: newStack.length - 1 }, '', `?screen=${screenName}`);
                }
                return newStack;
            });
        },
        replace: (screenName, params = {}) => {
            setHistory(prev => {
                const newStack = [...prev.slice(0, -1), { name: screenName, params }];
                if (Platform.OS === 'web') {
                    window.history.replaceState({ index: newStack.length - 1 }, '', `?screen=${screenName}`);
                }
                return newStack;
            });
        },
        reset: (stateConfig) => {
            const routes = stateConfig.routes || [{ name: 'Welcome', params: {} }];
            setHistory(routes);
            if (Platform.OS === 'web') {
                window.history.pushState({ index: routes.length - 1 }, '', `?screen=${routes[routes.length - 1].name}`);
            }
        },
        goBack: () => {
            if (historyRef.current.length > 1) {
                setHistory(prev => prev.slice(0, -1));
                if (Platform.OS === 'web') window.history.back();
            }
        },
        canGoBack: () => historyRef.current.length > 1,
        setOptions: () => { }, // no-op
    }), [history.length]);

    const renderScreen = () => {
        const props = {
            navigation: mockNavigation,
            route: { params: currentRoute.params }
        };

        let screen;
        switch (currentRoute.name) {
            case 'Login': screen = <LoginScreen {...props} />; break;
            case 'Welcome': screen = <WelcomeScreen {...props} />; break;
            case 'TimeSlots': screen = <TimeSlotsScreen {...props} />; break;
            case 'SubjectList': screen = <SubjectListScreen {...props} />; break;
            case 'TimetableBuilder': screen = <TimetableBuilderScreen {...props} />; break;
            case 'AttendanceStats': screen = <AttendanceStatsScreen {...props} />; break;
            case 'SetupComplete': screen = <SetupCompleteScreen {...props} />; break;
            default: screen = <WelcomeScreen {...props} />; break;
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
            {renderScreen()}
        </View>
    );
}

const getStyles = () => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
});

