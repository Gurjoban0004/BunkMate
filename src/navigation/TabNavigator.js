import React, { useRef, Suspense } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Platform, Pressable, Animated, Easing } from 'react-native';
import TodayScreen from '../screens/main/TodayScreen';
import SubjectsScreen from '../screens/main/SubjectsScreen';
import SubjectDetailScreen from '../screens/main/SubjectDetailScreen';
import SubjectPlannerScreen from '../screens/main/SubjectPlannerScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import EditTimetableScreen from '../screens/main/EditTimetableScreen';
import EditSubjectsScreen from '../screens/main/EditSubjectsScreen';
import InsightsScreen from '../screens/main/InsightsScreen';
import ERPConnectScreen from '../screens/main/ERPConnectScreen';
import BrandLoader from '../components/common/BrandLoader';
import TabIcon from './TabIcon';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { COLORS } from '../theme/theme';
import { useApp } from '../context/AppContext';
import { isAdminUser } from '../services/adminService';

// The admin dashboard (and its SVG charts) is only ever loaded for an admin.
const AdminScreen = React.lazy(() => import('../screens/main/AdminScreen'));

const Tab = createBottomTabNavigator();
const TodayStack = createStackNavigator();
const SubjectsStack = createStackNavigator();
const InsightsStack = createStackNavigator();
const AdminStack = createStackNavigator();

// Screens reachable from every tab.
const sharedScreens = (Stack) => (
    <>
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="EditTimetable" component={EditTimetableScreen} />
        <Stack.Screen name="EditSubjects" component={EditSubjectsScreen} />
        <Stack.Screen name="ERPConnect" component={ERPConnectScreen} />
        <Stack.Screen name="SubjectDetail" component={SubjectDetailScreen} />
    </>
);

function TodayStackScreen() {
    return (
        <ErrorBoundary screen screenName="Today">
            <TodayStack.Navigator screenOptions={{ headerShown: false }}>
                <TodayStack.Screen name="TodayMain" component={TodayScreen} />
                <TodayStack.Screen name="Insights" component={InsightsScreen} />
                {sharedScreens(TodayStack)}
            </TodayStack.Navigator>
        </ErrorBoundary>
    );
}

function SubjectsStackScreen() {
    return (
        <ErrorBoundary screen screenName="Subjects">
            <SubjectsStack.Navigator screenOptions={{ headerShown: false }}>
                <SubjectsStack.Screen name="SubjectsList" component={SubjectsScreen} />
                <SubjectsStack.Screen name="SubjectPlanner" component={SubjectPlannerScreen} />
                {sharedScreens(SubjectsStack)}
            </SubjectsStack.Navigator>
        </ErrorBoundary>
    );
}

function InsightsStackScreen() {
    return (
        <ErrorBoundary screen screenName="Insights">
            <InsightsStack.Navigator screenOptions={{ headerShown: false }}>
                <InsightsStack.Screen name="InsightsMain" component={InsightsScreen} />
                {sharedScreens(InsightsStack)}
            </InsightsStack.Navigator>
        </ErrorBoundary>
    );
}

function LazyAdmin(props) {
    return (
        <Suspense fallback={<BrandLoader />}>
            <AdminScreen {...props} />
        </Suspense>
    );
}

function AdminStackScreen() {
    return (
        <ErrorBoundary screen screenName="Admin">
            <AdminStack.Navigator screenOptions={{ headerShown: false }}>
                <AdminStack.Screen name="AdminMain" component={LazyAdmin} />
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
            onPressIn={() => Animated.timing(scale, { toValue: 0.88, duration: 80, easing: Easing.out(Easing.quad), useNativeDriver: true }).start()}
            onPressOut={() => Animated.timing(scale, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()}
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
    const isAdmin = isAdminUser(state);

    return (
        <Tab.Navigator
            initialRouteName="Today"
            screenOptions={({ route }) => ({
                tabBarButton: (props) => <AnimatedTabButton {...props} />,
                tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
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
                tabBarLabelStyle: { fontWeight: '700', fontSize: 10, marginTop: 2, letterSpacing: 0.3 },
                headerShown: false,
            })}
        >
            <Tab.Screen name="Today" component={TodayStackScreen} />
            <Tab.Screen name="Subjects" component={SubjectsStackScreen} />
            <Tab.Screen name="Insights" component={InsightsStackScreen} />
            {isAdmin && <Tab.Screen name="Admin" component={AdminStackScreen} />}
        </Tab.Navigator>
    );
}
