import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, Platform, Animated } from 'react-native';
import useRouteTransition from '../hooks/useRouteTransition';

import ERPSetupScreen from '../screens/setup/ERPSetupScreen';


import { COLORS } from '../theme/theme';
import { useApp } from '../context/AppContext';
import { NavigationContext, NavigationRouteContext } from '@react-navigation/native';

export default function WebNavigator() {
    const styles = getStyles();
    const { state } = useApp();
    // Straight to sign-in — see SetupNavigator for why Welcome is no longer first.
    const initialRoute = 'ERPSetup';
    const [history, setHistory] = useState([
        { name: initialRoute, params: {} }
    ]);

    const currentRoute = history[history.length - 1];
    const transitionStyle = useRouteTransition(currentRoute.name);
    // Ref so navigation callbacks always see current history without stale closure
    const historyRef = React.useRef(history);
    historyRef.current = history; // Update synchronously so canGoBack is accurate during child render

    useEffect(() => {
        if (Platform.OS === 'web') {
            const handlePopState = (event) => {
                const popState = event.state;
                if (popState && typeof popState.index === 'number') {
                    setHistory(prev => {
                        if (popState.index < prev.length) {
                            return prev.slice(0, popState.index + 1);
                        }
                        return prev;
                    });
                } else {
                    // Fallback to initial route
                    setHistory([{ name: initialRoute, params: {} }]);
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
                // BUG-15 fix: skip if already on this screen
                if (prev[prev.length - 1]?.name === screenName) return prev;
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
            const routes = stateConfig.routes || [{ name: initialRoute, params: {} }];
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
    }), []); // BUG-05 fix: stable reference, uses setHistory functional updates

    const renderScreen = () => {
        const props = {
            navigation: mockNavigation,
            route: { params: currentRoute.params }
        };

        // Setup is a single screen now, but the history/navigation shim around
        // it is still what the web build uses instead of a real stack.
        const screen = <ERPSetupScreen {...props} />;

        return (
            <NavigationContext.Provider value={mockNavigation}>
                <NavigationRouteContext.Provider value={props.route}>
                    {screen}
                </NavigationRouteContext.Provider>
            </NavigationContext.Provider>
        );
    };

    return (
        <Animated.View style={[styles.container, transitionStyle]}>
            {renderScreen()}
        </Animated.View>
    );
}

const getStyles = () => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
});

