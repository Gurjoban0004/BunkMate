import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';

// Import Screens
import WelcomeScreen from '../screens/setup/WelcomeScreen';
import NameScreen from '../screens/setup/NameScreen';
import TimeSlotsScreen from '../screens/setup/TimeSlotsScreen';
import TimetableBuilderScreen from '../screens/setup/TimetableBuilderScreen';
import ExistingAttendanceScreen from '../screens/setup/ExistingAttendanceScreen';
import TeacherNamesScreen from '../screens/setup/TeacherNamesScreen';
import SetupCompleteScreen from '../screens/setup/SetupCompleteScreen';

import WebHeader from './WebHeader';
import { COLORS } from '../theme/theme';

export default function WebNavigator() {
    const [history, setHistory] = useState([
        { name: 'Welcome', params: {} }
    ]);

    const currentRoute = history[history.length - 1];

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
            if (Platform.OS === 'web' && history.length > 1) {
                window.history.back();
            } else {
                setHistory(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
            }
        },
        setOptions: () => { }, // no-op
    }), [history.length]);

    const handleBack = useCallback(() => mockNavigation.goBack(), [mockNavigation]);

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
            <WebHeader
                title={currentRoute.name.replace(/([A-Z])/g, ' $1').trim()}
                canGoBack={history.length > 1}
                onGoBack={handleBack}
            />
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
