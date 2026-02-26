import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { AppProvider, useApp } from './src/context/AppContext';
import AppNavigator from './src/navigation/AppNavigator';
import { COLORS } from './src/theme/theme';
import { DEV_MODE, SKIP_SETUP, MOCK_SCENARIO } from './src/dev/config';
import DevMenu from './src/dev/DevMenu';
import ErrorBoundary from './src/components/common/ErrorBoundary';

function AppContent() {
    const { state, dispatch, isLoading } = useApp();
    const [devReady, setDevReady] = useState(!DEV_MODE || !SKIP_SETUP);

    // In dev mode with SKIP_SETUP, load mock data after the initial state loads
    useEffect(() => {
        if (DEV_MODE && SKIP_SETUP && !isLoading && !devReady) {
            // Only load mock data if there's no existing saved data
            if (!state.setupComplete) {
                const { MOCK_SCENARIOS } = require('./src/dev/mockData');
                const mockData = MOCK_SCENARIOS[MOCK_SCENARIO] || MOCK_SCENARIOS.NORMAL;
                dispatch({ type: 'LOAD_STATE', payload: mockData });
            }
            setDevReady(true);
        } else if (!DEV_MODE || !SKIP_SETUP) {
            setDevReady(true);
        }
    }, [isLoading]);

    if (isLoading || !devReady) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    const handleLoadScenario = (scenarioData) => {
        dispatch({ type: 'LOAD_STATE', payload: scenarioData });
    };

    const handleClearData = () => {
        dispatch({ type: 'RESET_STATE' });
    };

    return (
        <>
            <StatusBar style="dark" />
            <AppNavigator />
            <DevMenu
                onLoadScenario={handleLoadScenario}
                onClearData={handleClearData}
            />
        </>
    );
}

export default function App() {
    return (
        <ErrorBoundary>
            <AppProvider>
                <AppContent />
            </AppProvider>
        </ErrorBoundary>
    );
}

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
    },
});
