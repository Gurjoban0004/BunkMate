import React from 'react';
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
            }}
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
