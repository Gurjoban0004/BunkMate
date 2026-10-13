import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import WebTabNavigator from '../WebTabNavigator';

jest.mock('../../screens/main/TodayScreen', () => {
    const { Text, TouchableOpacity } = require('react-native');
    return ({ navigation }) => <TouchableOpacity accessibilityLabel="Weekly plan" onPress={() => navigation.navigate('Insights', { section: 'plan' })}><Text>Today</Text></TouchableOpacity>;
});
jest.mock('../../screens/main/SkipPlanScreen', () => {
    const { Text } = require('react-native');
    return ({ route }) => <Text>{`Combined plan${route.params.subjectId ? ` for ${route.params.subjectId}` : ''}`}</Text>;
});
jest.mock('../../screens/main/InsightsScreen', () => {
    const { Text } = require('react-native');
    return ({ route }) => <Text>{route.params.section === 'plan' ? `Combined plan${route.params.subjectId ? ` for ${route.params.subjectId}` : ''}` : 'Overview'}</Text>;
});
jest.mock('../../screens/main/SubjectsScreen', () => () => null);
jest.mock('../../screens/main/SubjectDetailScreen', () => () => null);
jest.mock('../../screens/main/SubjectPlannerScreen', () => () => null);
jest.mock('../../screens/main/SettingsScreen', () => () => null);
jest.mock('../../screens/main/EditTimetableScreen', () => () => null);
jest.mock('../../screens/main/EditSubjectsScreen', () => () => null);
jest.mock('../../screens/main/ERPConnectScreen', () => () => null);
jest.mock('../../components/ios/PresenceTabBar', () => () => null);
jest.mock('../../hooks/useRouteTransition', () => () => ({}));
jest.mock('../../context/AppContext', () => ({ useApp: () => ({ state: {} }) }));
jest.mock('../../services/adminService', () => ({ isAdminUser: () => false }));
jest.mock('../../services/usage', () => ({ trackScreen: jest.fn() }));
jest.mock('../AdminTab', () => ({ ADMIN_AVAILABLE: false }), { virtual: true });

beforeEach(() => {
    window.location = { pathname: '/', search: '?tab=Today' };
    window.history = { replaceState: jest.fn(), pushState: jest.fn() };
    window.setTimeout = global.setTimeout;
    window.clearTimeout = global.clearTimeout;
});
const renderNavigator = () => render(<SafeAreaInsetsContext.Provider value={{ top: 0, bottom: 0, left: 0, right: 0 }}><WebTabNavigator /></SafeAreaInsetsContext.Provider>);
test('Today shortcut switches the main tab and opens Plan with a reloadable URL', () => {
    const screen = renderNavigator();
    fireEvent.press(screen.getByLabelText('Weekly plan'));
    expect(screen.getByText('Combined plan')).toBeTruthy();
    expect(window.history.pushState).toHaveBeenCalledWith({ tab: 'Insights', index: 1 }, '', '?tab=Insights&screen=SkipPlan');
});
test('a Plan URL restores the chosen Insights section', () => {
    window.location.search = '?tab=Insights&section=plan';
    expect(renderNavigator().getByText('Combined plan')).toBeTruthy();
});
test('a subject calendar URL keeps the originating subject focused after reload', () => {
    window.location.search = '?tab=Insights&section=plan&subject=algorithms';
    expect(renderNavigator().getByText('Combined plan for algorithms')).toBeTruthy();
});

test.each(['Today', 'Subjects'])('a dedicated calendar URL restores on the originating %s tab', (tab) => {
    window.location.search = `?tab=${tab}&screen=SkipPlan&subject=algorithms`;
    expect(renderNavigator().getByText('Combined plan for algorithms')).toBeTruthy();
});
