import React, { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform, AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from './src/context/AppContext';
import AppNavigator from './src/navigation/AppNavigator';
import { applyTheme } from './src/theme/theme';
import { DEV_MODE, SKIP_SETUP, MOCK_SCENARIO } from './src/dev/config';
import ErrorBoundary from './src/components/common/ErrorBoundary';
import BrandLoader from './src/components/common/BrandLoader';
import { AlertProvider, useAlert } from './src/context/AlertContext';
import { setGlobalWebAlert } from './src/utils/alert';
import ReconnectSheet from './src/components/erp/ReconnectSheet';
import ResearchPrompt from './src/components/research/ResearchPrompt';
import { syncDailyPlanNotifications, cancelAllReminders, checkSmartAlerts } from './src/utils/notifications';
import { getSubjectAttendance } from './src/utils/attendance';

// Dev tooling (time travel, mock scenarios, date-fns) is only compiled into
// development builds. A production export drops the whole branch.
const DevModePanel = __DEV__ ? require('./src/dev/DevModePanel').default : null;

// ─── Web: disable react-native-screens ───────────────────────────────────────
// react-native-screens leaves ghost overlay divs in the DOM during navigation
// transitions that swallow taps. Plain Views on web avoid it entirely.
if (Platform.OS === 'web') {
    const { enableScreens } = require('react-native-screens');
    enableScreens(false);

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch((err) => {
                console.warn('Service worker registration failed:', err);
            });
        });
    }

    if (!document.querySelector('link[rel="manifest"]')) {
        const link = document.createElement('link');
        link.rel = 'manifest';
        link.href = '/manifest.json';
        document.head.appendChild(link);
    }

    const style = document.createElement('style');
    style.textContent = `
        /* Global font. The blanket star selector + !important is deliberate:
           RN Web emits its own font-family class on every Text, TextInput and
           nav label, and this is the one rule that outranks all of them.
           Icons are SVG, so nothing here breaks glyphs. */
        * {
            font-family: 'Times New Roman', Times, serif !important;
        }
        html, body {
            overscroll-behavior-y: none;
            touch-action: pan-y;
        }
        /* RN Web sets user-select:none globally; Safari treats that as
           "do not focus". Inputs must behave like normal web fields. */
        input, textarea, [contenteditable] {
            -webkit-user-select: text !important;
            user-select: text !important;
            pointer-events: auto !important;
            font-size: max(16px, 1em) !important;
        }
        #root, #root > div {
            pointer-events: auto !important;
        }
        input:focus, textarea:focus {
            outline: none;
        }
    `;
    document.head.appendChild(style);
}

function AppContent() {
    const { state, dispatch, isLoading, erpLastSynced } = useApp();
    const [devReady, setDevReady] = useState(!DEV_MODE || !SKIP_SETUP);

    const currentTheme = state?.settings?.theme || 'light';
    const currentPalette = state?.settings?.uiPalette || 'chalkpad';
    applyTheme(currentTheme, currentPalette);

    useEffect(() => {
        if (DEV_MODE && SKIP_SETUP && !isLoading && !devReady) {
            if (!state.setupComplete) {
                const { MOCK_SCENARIOS } = require('./src/dev/mockData/mockScenarios');
                const mockData = MOCK_SCENARIOS[MOCK_SCENARIO] || MOCK_SCENARIOS.NORMAL;
                dispatch({ type: 'LOAD_STATE', payload: { ...mockData, userId: 'DEV-MODE', isAuthenticated: true } });
            }
            setDevReady(true);
        } else if (!DEV_MODE || !SKIP_SETUP) {
            if (!devReady) setDevReady(true);
        }
    }, [isLoading, state.setupComplete, devReady]); // DEV_MODE, SKIP_SETUP are constants; dispatch is stable

    // ── Android: the morning plan, as real notifications ──────────────
    // One per day for the next week, each written from the timetable and the
    // college's current numbers. Re-planned whenever those change or the app
    // comes to the foreground, so the text is never stale.
    const reminderOn = !!state?.settings?.notificationEnabled;
    const reminderTime = state?.settings?.notificationTime || '07:30';
    const stateRef = useRef(state);
    useEffect(() => { stateRef.current = state; }, [state]);
    const planTimerRef = useRef(null);
    const replan = () => {
        if (Platform.OS !== 'android') return;
        clearTimeout(planTimerRef.current);
        planTimerRef.current = setTimeout(() => {
            const s = stateRef.current;
            if (!s.setupComplete) return;
            (s.settings?.notificationEnabled ? syncDailyPlanNotifications(s) : cancelAllReminders())
                .catch(() => { /* notifications are non-critical */ });
        }, 1500);
    };
    useEffect(() => {
        if (Platform.OS !== 'android' || isLoading) return undefined;
        replan();
        const sub = AppState.addEventListener('change', (next) => { if (next === 'active') replan(); });
        return () => { sub.remove(); clearTimeout(planTimerRef.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoading, state.setupComplete, reminderOn, reminderTime, erpLastSynced, state.timetableMeta?.fetchedAt]);

    // ── Android: warn the moment a subject crosses the line ───────────
    useEffect(() => {
        if (Platform.OS !== 'android' || !erpLastSynced || !state.settings?.smartAlertsEnabled) return;
        checkSmartAlerts(stateRef.current, dispatch, getSubjectAttendance).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [erpLastSynced]);

    if (isLoading || !devReady) {
        return <BrandLoader />;
    }

    return (
        <>
            <StatusBar style={currentTheme === 'dark' ? 'light' : 'dark'} />
            <AppNavigator key={currentTheme} />
            <ReconnectSheet />
            <ResearchPrompt />
            {DevModePanel ? <DevModePanel /> : null}
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
