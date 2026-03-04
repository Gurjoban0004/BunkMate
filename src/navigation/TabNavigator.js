import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text, View } from 'react-native';
import TodayScreen from '../screens/main/TodayScreen';
import SubjectsScreen from '../screens/main/SubjectsScreen';
import SubjectDetailScreen from '../screens/main/SubjectDetailScreen';
import PlannerScreen from '../screens/main/PlannerScreen';
import PlannerSubjectDetail from '../screens/main/PlannerScreen/PlannerSubjectDetail';
import SettingsScreen from '../screens/main/SettingsScreen';
import EditTimetableScreen from '../screens/main/EditTimetableScreen';
import EditSubjectsScreen from '../screens/main/EditSubjectsScreen';
import PastAttendanceScreen from '../screens/main/PastAttendanceScreen';
import AttendanceStatsScreen from '../screens/setup/AttendanceStatsScreen';
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
                name="PlannerSubjectDetail"
                component={PlannerSubjectDetail}
                options={({ route }) => ({
                    title: route.params?.subjectName || 'Subject',
                })}
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
            <SettingsStack.Screen
                name="PastAttendance"
                component={PastAttendanceScreen}
                options={{ title: 'Mark Past Attendance' }}
            />
            <SettingsStack.Screen
                name="AttendanceStats"
                component={AttendanceStatsScreen}
                options={{ title: 'Log Past Attendance' }}
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
    return (
        <View style={{
            backgroundColor: focused ? COLORS.primaryLight : 'transparent',
            paddingHorizontal: focused ? 16 : 0,
            paddingVertical: focused ? 6 : 0,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
        }}>
            <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{icons[label]}</Text>
        </View>
    );
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
                    borderTopWidth: 1,
                    paddingTop: 6,
                    paddingBottom: 4,
                    height: 60,
                    shadowColor: COLORS.shadow,
                    shadowOffset: { width: 0, height: -2 },
                    shadowOpacity: 0.06,
                    shadowRadius: 8,
                    elevation: 8,
                },
                tabBarActiveTintColor: COLORS.primary,
                tabBarInactiveTintColor: COLORS.textMuted,
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '600',
                    marginTop: 2,
                },
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
