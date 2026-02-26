import React from 'react';
import { Platform } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import WelcomeScreen from '../screens/setup/WelcomeScreen';
import NameScreen from '../screens/setup/NameScreen';
import TimeSlotsScreen from '../screens/setup/TimeSlotsScreen';
import TimetableBuilderScreen from '../screens/setup/TimetableBuilderScreen';
import ExistingAttendanceScreen from '../screens/setup/ExistingAttendanceScreen';
import TeacherNamesScreen from '../screens/setup/TeacherNamesScreen';
import SetupCompleteScreen from '../screens/setup/SetupCompleteScreen';
import { COLORS } from '../theme/theme';

const Stack = createStackNavigator();

export default function SetupNavigator() {
    return (
        <Stack.Navigator
            screenOptions={{
                headerStyle: { backgroundColor: COLORS.background },
                headerTintColor: COLORS.textPrimary,
                headerShadowVisible: false,
                headerBackTitleVisible: false,
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
                name="Name"
                component={NameScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="TimeSlots"
                component={TimeSlotsScreen}
                options={{ title: 'Time Slots' }}
            />
            <Stack.Screen
                name="TimetableBuilder"
                component={TimetableBuilderScreen}
                options={{ title: 'Build Timetable' }}
            />
            <Stack.Screen
                name="ExistingAttendance"
                component={ExistingAttendanceScreen}
                options={{ title: 'Current Attendance' }}
            />
            <Stack.Screen
                name="TeacherNames"
                component={TeacherNamesScreen}
                options={{ title: 'Teacher Names' }}
            />
            <Stack.Screen
                name="SetupComplete"
                component={SetupCompleteScreen}
                options={{ headerShown: false }}
            />
        </Stack.Navigator>
    );
}
