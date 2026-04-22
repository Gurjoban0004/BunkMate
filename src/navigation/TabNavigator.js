import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text, View, Platform } from 'react-native';
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
import EndGameScreen from '../screens/main/EndGameScreen';
import SyncFromPortalScreen from '../screens/main/SyncFromPortalScreen';
import ERPConnectScreen from '../screens/main/ERPConnectScreen';
import { useApp } from '../context/AppContext';
import { COLORS } from '../theme/theme';

const Tab = createBottomTabNavigator();
const SubjectsStack = createStackNavigator();
const TodayStack = createStackNavigator();
const PlannerStack = createStackNavigator();
const SettingsStack = createStackNavigator();
const EndGameStack = createStackNavigator();

function TodayStackScreen() {
    return (
        <TodayStack.Navigator
            screenOptions={{
                headerShown: false,
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
                headerShown: false,
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
                headerShown: false,
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
                headerShown: false,
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
            <SettingsStack.Screen
                name="EndGame"
                component={EndGameScreen}
                options={{ title: 'End Game Calculator' }}
            />
            <SettingsStack.Screen
                name="SyncFromPortal"
                component={SyncFromPortalScreen}
                options={{ title: 'Sync from Portal' }}
            />
            <SettingsStack.Screen
                name="ERPConnect"
                component={ERPConnectScreen}
                options={{ title: 'Connect ERP' }}
            />
        </SettingsStack.Navigator>
    );
}

function EndGameStackScreen() {
    return (
        <EndGameStack.Navigator
            screenOptions={{
                headerShown: false,
            }}
        >
            <EndGameStack.Screen
                name="EndGameMain"
                component={EndGameScreen}
            />
        </EndGameStack.Navigator>
    );
}

function TabIcon({ label, focused }) {
    const color = focused ? COLORS.primary : COLORS.textSecondary;
    const strokeWidth = focused ? 2 : 1.5;

    // SVG icons for modern look
    const icons = {
        Today: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
        ),
        Subjects: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
        ),
        Planner: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
        ),
        "End Game": (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"></path>
                <path d="M8.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"></path>
                <path d="M15.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"></path>
                <path d="M9 15a3 3 0 1 0 6 0"></path>
            </svg>
        ),
        Settings: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
        ),
    };

    return (
        <View style={{
            width: 24,
            height: 24,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: focused ? 1 : 0.7,
        }}>
            {icons[label]}
        </View>
    );
}

export default function TabNavigator() {
    const { state } = useApp();
    const initialRoute = state.settings?.landingPage === 'planner' ? 'Planner' : 'Today';

    return (
        <Tab.Navigator
            initialRouteName={initialRoute}
            screenOptions={({ route }) => ({
                tabBarIcon: ({ focused }) => (
                    <TabIcon label={route.name} focused={focused} />
                ),
                tabBarStyle: {
                    backgroundColor: COLORS.cardBackground,
                    borderTopColor: COLORS.border,
                    borderTopWidth: 1,
                    paddingTop: 6,
                    paddingBottom: Platform.OS === 'android' ? 8 : 4,
                    height: Platform.OS === 'android' ? 65 : 60,
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
            <Tab.Screen name="End Game" component={EndGameStackScreen} />
            <Tab.Screen name="Settings" component={SettingsStackScreen} />
        </Tab.Navigator>
    );
}
