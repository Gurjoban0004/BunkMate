import React, { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { MaintenanceGate, UpdateGate, RevokedGate } from '../components/common/GateOverlay';
import BrandLoader from '../components/common/BrandLoader';
import { getAdminConfig, isAdminRollNumber, isUserRevoked } from '../services/adminService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Native Navigators
import SetupNavigator from './SetupNavigator';
import TabNavigator from './TabNavigator';

// Web Navigators
import WebNavigator from './WebNavigator';
import WebTabNavigator from './WebTabNavigator';

const APP_VERSION = '2.0.0';

function compareVersions(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if ((pa[i] || 0) < (pb[i] || 0)) return -1;
        if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    }
    return 0;
}

export default function AppNavigator() {
    const { state, isLoading } = useApp();
    const [gate, setGate] = useState(null);
    const [gateChecked, setGateChecked] = useState(false);

    useEffect(() => {
        if (!isLoading && state.isAuthenticated) {
            checkGates();
        } else if (!isLoading) {
            setGateChecked(true);
        }
    }, [isLoading, state.isAuthenticated, state.erpRollNumber]);

    const checkGates = async () => {
        const isAdmin = isAdminRollNumber(state.erpRollNumber);

        try {
            let config;
            try {
                config = await getAdminConfig();
                if (config.minVersion) await AsyncStorage.setItem('cached_min_version', config.minVersion);
            } catch (e) {
                const cached = await AsyncStorage.getItem('cached_min_version');
                config = { minVersion: cached || APP_VERSION, maintenanceMode: false };
            }

            if (config.maintenanceMode && !isAdmin) {
                setGate(<MaintenanceGate message={config.maintenanceMessage} />);
                setGateChecked(true);
                return;
            }

            if (config.minVersion && compareVersions(APP_VERSION, config.minVersion) < 0 && !isAdmin) {
                setGate(<UpdateGate minVersion={config.minVersion} updateUrl={config.updateUrl} />);
                setGateChecked(true);
                return;
            }

            if (state.erpRollNumber && !isAdmin) {
                const revocation = await isUserRevoked(state.erpRollNumber);
                if (revocation) {
                    setGate(<RevokedGate reason={revocation.reason} />);
                    setGateChecked(true);
                    return;
                }
            }
        } catch (e) { /* ignore */ }

        setGate(null);
        setGateChecked(true);
    };

    if (isLoading || !gateChecked) {
        // Same mark App.js shows while fonts load, so boot is one continuous
        // image instead of a brand splash cutting to a bare spinner.
        return <BrandLoader />;
    }

    // Live server verdict wins over the launch-time check — a user revoked while the
    // app is open is gated on their next sync, not on their next relaunch.
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
