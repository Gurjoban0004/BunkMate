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
        Insights: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
        ),
        Admin: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
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
