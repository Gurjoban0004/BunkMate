import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text } from 'react-native';
import TodayScreen from '../screens/main/TodayScreen';
import SubjectsScreen from '../screens/main/SubjectsScreen';
import SubjectDetailScreen from '../screens/main/SubjectDetailScreen';
import PlannerScreen from '../screens/main/PlannerScreen';
import RecoveryPlanScreen from '../screens/main/RecoveryPlanScreen';
import EndGameScreen from '../screens/main/EndGameScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import EditTimetableScreen from '../screens/main/EditTimetableScreen';
import EditSubjectsScreen from '../screens/main/EditSubjectsScreen';
import PastAttendanceScreen from '../screens/main/PastAttendanceScreen';
import WeeklySummaryScreen from '../screens/main/WeeklySummaryScreen';
import { COLORS } from '../theme/theme';

const Tab = createBottomTabNavigator();
const SubjectsStack = createStackNavigator();
const TodayStack = createStackNavigator();
const PlannerStack = createStackNavigator();
const SettingsStack = createStackNavigator();

function TodayStackScreen() {
    return (
        <TodayStack.Navigator
            screenOptions={{
                headerStyle: { backgroundColor: COLORS.background },
                headerTintColor: COLORS.textPrimary,
                headerShadowVisible: false,
                headerBackTitleVisible: false,
            }}
        >
            <TodayStack.Screen
                name="TodayMain"
                component={TodayScreen}
                options={{ headerShown: false }}
            />
            <TodayStack.Screen
                name="PastAttendance"
                component={PastAttendanceScreen}
                options={{ title: 'Mark Past Attendance' }}
            />
            <TodayStack.Screen
                name="WeeklySummary"
                component={WeeklySummaryScreen}
                options={{ title: 'Weekly Summary' }}
            />
        </TodayStack.Navigator>
    );
}

function SubjectsStackScreen() {
    return (
        <SubjectsStack.Navigator
            screenOptions={{
                headerStyle: { backgroundColor: COLORS.background },
                headerTintColor: COLORS.textPrimary,
                headerShadowVisible: false,
                headerBackTitleVisible: false,
            }}
        >
            <SubjectsStack.Screen
                name="SubjectsList"
                component={SubjectsScreen}
                options={{ headerShown: false }}
            />
            <SubjectsStack.Screen
                name="SubjectDetail"
                component={SubjectDetailScreen}
                options={({ route }) => ({
                    title: route.params?.subjectName || 'Subject',
                })}
            />
        </SubjectsStack.Navigator>
    );
}

function PlannerStackScreen() {
    return (
        <PlannerStack.Navigator
            screenOptions={{
                headerStyle: { backgroundColor: COLORS.background },
                headerTintColor: COLORS.textPrimary,
                headerShadowVisible: false,
                headerBackTitleVisible: false,
            }}
        >
            <PlannerStack.Screen
                name="PlannerMain"
                component={PlannerScreen}
                options={{ headerShown: false }}
            />
            <PlannerStack.Screen
                name="RecoveryPlan"
                component={RecoveryPlanScreen}
                options={{ title: 'Recovery Plan' }}
            />
            <PlannerStack.Screen
                name="EndGame"
                component={EndGameScreen}
                options={{ title: 'Minimum Effort' }}
            />
        </PlannerStack.Navigator>
    );
}

function SettingsStackScreen() {
    return (
        <SettingsStack.Navigator
            screenOptions={{
                headerStyle: { backgroundColor: COLORS.background },
                headerTintColor: COLORS.textPrimary,
                headerShadowVisible: false,
                headerBackTitleVisible: false,
            }}
        >
            <SettingsStack.Screen
                name="SettingsMain"
                component={SettingsScreen}
                options={{ headerShown: false }}
            />
            <SettingsStack.Screen
                name="EditTimetable"
                component={EditTimetableScreen}
                options={{ title: 'Edit Timetable' }}
            />
            <SettingsStack.Screen
                name="EditSubjects"
                component={EditSubjectsScreen}
                options={{ title: 'Edit Subjects' }}
            />
        </SettingsStack.Navigator>
    );
}

function TabIcon({ label, focused }) {
    const icons = {
        Today: '📅',
        Subjects: '📚',
        Planner: '🎯',
        Settings: '⚙️',
    };
    return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{icons[label]}</Text>;
}

export default function TabNavigator() {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                tabBarIcon: ({ focused }) => (
                    <TabIcon label={route.name} focused={focused} />
                ),
                tabBarStyle: {
                    backgroundColor: COLORS.cardBackground,
                    borderTopColor: COLORS.border,
                    paddingTop: 4,
                },
                tabBarActiveTintColor: COLORS.primary,
                tabBarInactiveTintColor: COLORS.textSecondary,
                headerShown: false,
            })}
        >
            <Tab.Screen name="Today" component={TodayStackScreen} />
            <Tab.Screen
                name="Subjects"
                component={SubjectsStackScreen}
                options={{ title: 'Subjects' }}
            />
            <Tab.Screen
                name="Planner"
                component={PlannerStackScreen}
                options={{ title: 'Planner' }}
            />
            <Tab.Screen name="Settings" component={SettingsStackScreen} />
        </Tab.Navigator>
    );
}
