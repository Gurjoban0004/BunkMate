import React from 'react';
import { AccessibilityInfo, Keyboard } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import PresenceTabBar from '../PresenceTabBar.ios';

jest.mock('../../../context/AppContext', () => ({ useApp: () => ({ state: { settings: { theme: 'light' } } }) }));
jest.mock('expo-blur', () => ({ BlurView: require('react-native').View }));

let keyboardListeners;
beforeEach(() => {
    window.setTimeout = global.setTimeout;
    window.clearTimeout = global.clearTimeout;
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockResolvedValue(true);
    keyboardListeners = {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation((name, fn) => {
        keyboardListeners[name] = fn;
        return { remove: jest.fn() };
    });
});
afterEach(() => jest.restoreAllMocks());

function setup(prevented = false) {
    const state = { index: 0, routes: ['Today', 'Subjects', 'Insights'].map((name) => ({ name, key: name })) };
    const descriptors = Object.fromEntries(state.routes.map((route) => [route.key, { options: {} }]));
    const navigation = { navigate: jest.fn(), emit: jest.fn(() => ({ defaultPrevented: prevented })) };
    return { navigation, screen: render(<PresenceTabBar state={state} descriptors={descriptors} navigation={navigation} insets={{ bottom: 34, left: 0, right: 0 }} />) };
}

test('routes through the existing navigator and retains tabPress events on repeated taps', async () => {
    const { navigation, screen } = setup();
    await act(async () => {});
    fireEvent.press(screen.getByLabelText('Subjects'));
    expect(navigation.navigate).toHaveBeenCalledWith('Subjects', undefined);
    fireEvent.press(screen.getByLabelText('Today'));
    expect(navigation.navigate).toHaveBeenCalledTimes(1);
    expect(navigation.emit).toHaveBeenLastCalledWith({ type: 'tabPress', target: 'Today', canPreventDefault: true });
});
test('honors prevented navigation events', async () => {
    const { navigation, screen } = setup(true);
    await act(async () => {});
    fireEvent.press(screen.getByLabelText('Insights'));
    expect(navigation.navigate).not.toHaveBeenCalled();
});
test('hides the tab controls while the keyboard is open and restores them afterward', async () => {
    const { screen } = setup();
    await act(async () => {});
    act(() => keyboardListeners.keyboardWillShow());
    expect(screen.queryByLabelText('Today')).toBeNull();
    act(() => keyboardListeners.keyboardWillHide());
    expect(screen.getByLabelText('Today')).toBeTruthy();
});
