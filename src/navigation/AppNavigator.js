import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import SetupNavigator from './SetupNavigator';
import TabNavigator from './TabNavigator';

export default function AppNavigator() {
    const { state } = useApp();

    return (
        <NavigationContainer>
            {state.setupComplete ? <TabNavigator /> : <SetupNavigator />}
        </NavigationContainer>
    );
}
