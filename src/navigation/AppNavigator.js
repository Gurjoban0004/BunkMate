import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { MaintenanceGate, UpdateGate, RevokedGate } from '../components/common/GateOverlay';
import BrandLoader from '../components/common/BrandLoader';
import { getAdminConfig, isAdminUser } from '../services/adminService';
import { APP_VERSION } from '../config/version';
import AsyncStorage from '@react-native-async-storage/async-storage';

import SetupNavigator from './SetupNavigator';
import TabNavigator from './TabNavigator';
import WebNavigator from './WebNavigator';
import WebTabNavigator from './WebTabNavigator';

function compareVersions(a, b) {
    const pa = String(a).split('.').map(Number);
    const pb = String(b).split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if ((pa[i] || 0) < (pb[i] || 0)) return -1;
        if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    }
    return 0;
}

export default function AppNavigator() {
    const { state, isLoading } = useApp();
    const [gate, setGate] = useState(null);
    const isAdmin = isAdminUser(state);
    const isAdminRef = useRef(isAdmin);
    useEffect(() => { isAdminRef.current = isAdmin; }, [isAdmin]);

    // Maintenance and version gates are checked in the background — after
    // first paint, and again whenever the app comes to the foreground — so a
    // slow config read never delays the screen. Revocation is NOT decided here:
    // the server checks it on every sync and AppContext turns that verdict
    // into state.accessRevoked.
    const checkGates = useCallback(async () => {
        let config;
        try {
            config = await getAdminConfig();
            if (config.minVersion) await AsyncStorage.setItem('cached_min_version', config.minVersion);
        } catch {
            const cached = await AsyncStorage.getItem('cached_min_version').catch(() => null);
            config = { minVersion: cached || APP_VERSION, maintenanceMode: false };
        }
        if (isAdminRef.current) { setGate(null); return; }
        if (config.maintenanceMode) {
            setGate(<MaintenanceGate message={config.maintenanceMessage} />);
        } else if (config.minVersion && compareVersions(APP_VERSION, config.minVersion) < 0) {
            setGate(<UpdateGate minVersion={config.minVersion} updateUrl={config.updateUrl} />);
        } else {
            setGate(null);
        }
    }, []);

    useEffect(() => {
        if (isLoading || !state.isAuthenticated) return undefined;
        checkGates();
        const sub = AppState.addEventListener('change', (next) => { if (next === 'active') checkGates(); });
        return () => sub.remove();
    }, [isLoading, state.isAuthenticated, isAdmin, checkGates]);

    if (isLoading) return <BrandLoader />;

    // The server's verdict wins over anything cached.
    if (state.accessRevoked) return <RevokedGate reason={state.accessRevoked.reason} />;
    if (gate) return gate;

    if (Platform.OS === 'web') {
        if (!state.isAuthenticated) return <WebNavigator />;
        return state.setupComplete ? <WebTabNavigator /> : <WebNavigator />;
    }

    return (
        <NavigationContainer>
            {state.isAuthenticated && state.setupComplete ? <TabNavigator /> : <SetupNavigator />}
        </NavigationContainer>
    );
}
