import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from './src/context/AppContext';
import AppNavigator from './src/navigation/AppNavigator';
import { COLORS } from './src/theme/theme';
import { DEV_MODE, SKIP_SETUP, MOCK_SCENARIO } from './src/dev/config';
import DevMenu from './src/dev/DevMenu';
import ErrorBoundary from './src/components/common/ErrorBoundary';
import { AlertProvider, useAlert } from './src/context/AlertContext';
import { setGlobalWebAlert } from './src/utils/alert';

// ─── Web: Disable react-native-screens on web ─────────────────────────────────
// react-native-screens injects ScreenContainer divs that leave ghost overlay
// divs in the DOM during/after navigation transitions. These overlays have no
// pointer-events style set, so they sit invisibly on top of your current screen
// and swallow every tap and click — including on text inputs.
//
// Calling enableScreens(false) before any navigation renders forces
// @react-navigation/stack to use plain View-based rendering on web,
// completely bypassing the broken ScreenContainer behavior.
if (Platform.OS === 'web') {
    // Dynamically import so it doesn't affect native bundles at all
    const { enableScreens } = require('react-native-screens');
    enableScreens(false);
}

if (Platform.OS === 'web') {
    const style = document.createElement('style');
    style.textContent = `
        /* ── Core input fix ───────────────────────────────────────────────
           React Native Web sets user-select:none globally. Safari uses this
           as a signal to reject focus on tapped elements. We override just
           for inputs so they behave like normal web text fields.           */
        input, textarea, [contenteditable] {
            -webkit-user-select: text !important;
            user-select: text !important;
            pointer-events: auto !important;
            /* Prevent iOS Safari from zooming on focus (font-size < 16px) */
            font-size: max(16px, 1em) !important;
        }

        /* ── Safari Hit-Testing Fix ───────────────────────────────────────
           iOS Safari can sometimes miscalculate the touch targets of elements
           nested inside flex-grow containers that are themselves inside
           absolute-positioned navigation cards. We force the main app
           container to be hit-testable and ensure no invisible overlays
           are created by the bundler/runtime. */
        #root, #root > div {
            pointer-events: auto !important;
        }

        /* ── Focus outline ────────────────────────────────────────────────
           Remove only from inputs, NOT from everything (*) — blanket
           outline:none on * can confuse WebKit's internal focus routing   */
        input:focus, textarea:focus {
            outline: none;
        }
    `;
    document.head.appendChild(style);
}

function AppContent() {
    const { state, dispatch, isLoading } = useApp();
    const [devReady, setDevReady] = useState(!DEV_MODE || !SKIP_SETUP);

    useEffect(() => {
        if (DEV_MODE && SKIP_SETUP && !isLoading && !devReady) {
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

function AlertGlobalConnector({ children }) {
    const { showAlert } = useAlert();
    useEffect(() => {
        setGlobalWebAlert(showAlert);
    }, [showAlert]);
    return children;
}

export default function App() {
    return (
        <SafeAreaProvider>
            <ErrorBoundary>
                <AppProvider>
                    <AlertProvider>
                        <AlertGlobalConnector>
                            <AppContent />
                        </AlertGlobalConnector>
                    </AlertProvider>
                </AppProvider>
            </ErrorBoundary>
        </SafeAreaProvider>
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
