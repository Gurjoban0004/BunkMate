import React from 'react';
import { Platform, View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { COLORS } from '../theme/theme';

// Native Navigators
import SetupNavigator from './SetupNavigator';
import TabNavigator from './TabNavigator';

// Web Navigators
import WebNavigator from './WebNavigator';
import WebTabNavigator from './WebTabNavigator';

export default function AppNavigator() {
    const { state, isLoading } = useApp();

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    if (Platform.OS === 'web') {
        // Completely bypass React Navigation's wrapper architectures on Web
        if (!state.isAuthenticated) return <WebNavigator />;
        return state.setupComplete ? <WebTabNavigator /> : <WebNavigator />;
    }

    return (
        <NavigationContainer>
            {state.isAuthenticated && state.setupComplete ? <TabNavigator /> : <SetupNavigator />}
        </NavigationContainer>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
