import React from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useApp } from '../context/AppContext';

// Native Navigators
import SetupNavigator from './SetupNavigator';
import TabNavigator from './TabNavigator';

// Web Navigators
import WebNavigator from './WebNavigator';
import WebTabNavigator from './WebTabNavigator';

export default function AppNavigator() {
    const { state } = useApp();

    if (Platform.OS === 'web') {
        // Completely bypass React Navigation's wrapper architectures on Web
        return state.setupComplete ? <WebTabNavigator /> : <WebNavigator />;
    }

    return (
        <NavigationContainer>
            {state.setupComplete ? <TabNavigator /> : <SetupNavigator />}
        </NavigationContainer>
    );
}
