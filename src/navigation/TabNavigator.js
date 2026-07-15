import React, { useRef } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text, View, Platform, Pressable, Animated, Easing } from 'react-native';
import TodayScreen from '../screens/main/TodayScreen';
import SubjectsScreen from '../screens/main/SubjectsScreen';
import SubjectDetailScreen from '../screens/main/SubjectDetailScreen';
import SubjectPlannerScreen from '../screens/main/SubjectPlannerScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import EditTimetableScreen from '../screens/main/EditTimetableScreen';
import EditSubjectsScreen from '../screens/main/EditSubjectsScreen';
import PastAttendanceScreen from '../screens/main/PastAttendanceScreen';
import WeeklySummaryScreen from '../screens/main/WeeklySummaryScreen';
import InsightsScreen from '../screens/main/InsightsScreen';
import SyncFromPortalScreen from '../screens/main/SyncFromPortalScreen';
import ERPConnectScreen from '../screens/main/ERPConnectScreen';
import AdminScreen from '../screens/main/AdminScreen';
import TabIcon from './TabIcon';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { COLORS } from '../theme/theme';
import { useApp } from '../context/AppContext';
import { isAdminRollNumber } from '../services/adminService';

const Tab = createBottomTabNavigator();
const TodayStack = createStackNavigator();
const SubjectsStack = createStackNavigator();
const InsightsStack = createStackNavigator();
const AdminStack = createStackNavigator();

function TodayStackScreen() {
    return (
        <ErrorBoundary screen screenName="Today">
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
            <TodayStack.Screen
                name="Insights"
                component={InsightsScreen}
                options={{ title: 'Insights' }}
            />
            <TodayStack.Screen
                name="Settings"
                component={SettingsScreen}
                options={{ title: 'Settings' }}
            />
            <TodayStack.Screen name="EditTimetable" component={EditTimetableScreen} options={{ title: 'Edit Timetable' }} />
            <TodayStack.Screen name="EditSubjects" component={EditSubjectsScreen} options={{ title: 'Edit Subjects' }} />
            <TodayStack.Screen name="SyncFromPortal" component={SyncFromPortalScreen} options={{ title: 'Sync from Portal' }} />
            <TodayStack.Screen name="ERPConnect" component={ERPConnectScreen} options={{ title: 'Connect ERP' }} />
        </TodayStack.Navigator>
        </ErrorBoundary>
    );
}

function SubjectsStackScreen() {
    return (
        <ErrorBoundary screen screenName="Subjects">
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
            <SubjectsStack.Screen
                name="SubjectPlanner"
                component={SubjectPlannerScreen}
                options={({ route }) => ({
                    title: route.params?.subjectName || 'Plan classes',
                })}
            />
            <SubjectsStack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
            <SubjectsStack.Screen name="EditTimetable" component={EditTimetableScreen} options={{ title: 'Edit Timetable' }} />
            <SubjectsStack.Screen name="EditSubjects" component={EditSubjectsScreen} options={{ title: 'Edit Subjects' }} />
            <SubjectsStack.Screen name="SyncFromPortal" component={SyncFromPortalScreen} options={{ title: 'Sync from Portal' }} />
            <SubjectsStack.Screen name="ERPConnect" component={ERPConnectScreen} options={{ title: 'Connect ERP' }} />
        </SubjectsStack.Navigator>
        </ErrorBoundary>
    );
}

function InsightsStackScreen() {
    return (
        <ErrorBoundary screen screenName="Insights">
        <InsightsStack.Navigator screenOptions={{ headerShown: false }}>
            <InsightsStack.Screen name="InsightsMain" component={InsightsScreen} />
            <InsightsStack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
            <InsightsStack.Screen name="EditTimetable" component={EditTimetableScreen} options={{ title: 'Edit Timetable' }} />
            <InsightsStack.Screen name="EditSubjects" component={EditSubjectsScreen} options={{ title: 'Edit Subjects' }} />
            <InsightsStack.Screen name="SyncFromPortal" component={SyncFromPortalScreen} options={{ title: 'Sync from Portal' }} />
            <InsightsStack.Screen name="ERPConnect" component={ERPConnectScreen} options={{ title: 'Connect ERP' }} />
        </InsightsStack.Navigator>
        </ErrorBoundary>
    );
}

function AdminStackScreen() {
    return (
        <ErrorBoundary screen screenName="Admin">
        <AdminStack.Navigator screenOptions={{ headerShown: false }}>
            <AdminStack.Screen name="AdminMain" component={AdminScreen} />
        </AdminStack.Navigator>
        </ErrorBoundary>
    );
}

function AnimatedTabButton({ children, style, onPress, onLongPress, ...rest }) {
    const scale = useRef(new Animated.Value(1)).current;
    return (
        <Pressable
            onPress={onPress}
            onLongPress={onLongPress}
            onPressIn={() =>
                Animated.timing(scale, { toValue: 0.88, duration: 80, easing: Easing.out(Easing.quad), useNativeDriver: true }).start()
            }
            onPressOut={() =>
                Animated.timing(scale, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
            }
            style={style}
            {...rest}
        >
            <Animated.View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', transform: [{ scale }] }}>
                {children}
            </Animated.View>
        </Pressable>
    );
}

export default function TabNavigator() {
    const { state } = useApp();
    const isAdmin = isAdminRollNumber(state.erpRollNumber);

    return (
        <Tab.Navigator
            initialRouteName="Today"
            screenOptions={({ route }) => ({
                tabBarButton: (props) => <AnimatedTabButton {...props} />,
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
                    elevation: 0,
                },
                tabBarActiveTintColor: COLORS.primary,
                tabBarInactiveTintColor: COLORS.textMuted,
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: '700',
                    marginTop: 2,
                    letterSpacing: 0.3,
                },
                headerShown: false,
            })}
        >
            <Tab.Screen name="Today" component={TodayStackScreen} />
            <Tab.Screen name="Subjects" component={SubjectsStackScreen} options={{ title: 'Subjects' }} />
            <Tab.Screen name="Insights" component={InsightsStackScreen} />
            {isAdmin && <Tab.Screen name="Admin" component={AdminStackScreen} />}
        </Tab.Navigator>
    );
}
