import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import TabScrollView from '../TabScrollView';

const originalOS = Platform.OS;
beforeEach(() => { window.setTimeout = global.setTimeout; window.clearTimeout = global.clearTimeout; });
afterEach(() => { Platform.OS = originalOS; });

function content(platform, height) {
    Platform.OS = platform;
    const screen = render(<BottomTabBarHeightContext.Provider value={height}>
        <TabScrollView testID="page-scroll" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }} />
    </BottomTabBarHeightContext.Provider>);
    return StyleSheet.flatten(screen.getByTestId('page-scroll').props.contentContainerStyle);
}

test('web clearance stays inside the scroll content and follows the capsule token', () => {
    expect(content('web', 0)).toMatchObject({ paddingHorizontal: 20, paddingBottom: 'calc(var(--ios-tabbar-reserved, 0px) + 32px)' });
});
test('iOS last content clears the measured overlay, including its single bottom inset', () => {
    expect(content('ios', 98).paddingBottom).toBe(130);
});
test('Android keeps its existing page spacing and normal tab layout', () => {
    expect(content('android', 65).paddingBottom).toBe(32);
});
