import React from 'react';
import { Platform } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { useApp } from '../context/AppContext';
import WelcomeScreen from '../screens/setup/WelcomeScreen';
import LoginScreen from '../screens/setup/LoginScreen';
import ERPSetupScreen from '../screens/setup/ERPSetupScreen';
import SetupCompleteScreen from '../screens/setup/SetupCompleteScreen';
import { COLORS } from '../theme/theme';

const Stack = createStackNavigator();

export default function SetupNavigator() {
    const { state } = useApp();
    // Always start on Welcome — it has both Login (ERP) and manual setup options
    const initialRoute = 'Welcome';

    return (
        <Stack.Navigator
            initialRouteName={initialRoute}
            screenOptions={{
                headerStyle: { 
                    backgroundColor: COLORS.background,
                    elevation: 0,
                    shadowOpacity: 0,
                    borderBottomWidth: 0,
                },
                headerTintColor: COLORS.primary,
                headerShadowVisible: false,
                headerBackTitleVisible: false,
                headerTitleStyle: {
                    fontSize: 18,
                    fontWeight: '600',
                },
                headerLeftContainerStyle: {
                    paddingLeft: 8,
                },
                headerTitleAlign: 'center',
                // ─── Web fix ───────────────────────────────────────────────
                // On web, the default card-based transition leaves animating
                // overlay divs in the DOM that have no pointer-events style.
                // These invisible divs sit on top of the current screen and
                // swallow every tap/click — including on your text inputs.
                //
                // Disabling the animation entirely prevents those overlay divs
                // from ever being created, so touches reach your inputs normally.
                ...(Platform.OS === 'web' && {
                    animationEnabled: false,
                    // cardStyle prevents the screen wrapper div from clipping
                    // or creating a new stacking context that blocks events
                    cardStyle: {
                        backgroundColor: COLORS.background,
                        // These two are the critical ones:
                        // Without flex:1 the card div collapses and a sibling
                        // overlay div ends up covering it in z-order
                        flex: 1,
                        // Explicit overflow visible ensures no child input
                        // gets clipped by the card container
                        overflow: 'visible',
                        // Force pointer events on the card itself
                        pointerEvents: 'auto',
                    },
                }),
            }}
            detachInactiveScreens={Platform.OS === 'web'}
        >
            <Stack.Screen
                name="Welcome"
                component={WelcomeScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="ERPSetup"
                component={ERPSetupScreen}
                options={{ headerShown: false }}
            />

            <Stack.Screen
                name="SetupComplete"
                component={SetupCompleteScreen}
                options={{ headerShown: false }}
            />
        </Stack.Navigator>
    );
}
