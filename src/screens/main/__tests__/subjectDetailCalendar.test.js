import React from 'react';
import { Platform } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import SubjectDetailScreen from '../SubjectDetailScreen';
const mockState = { subjects: [{ id: 'a', name: 'Algorithms', initialAttended: 90, initialTotal: 100, target: 75 }],
    timetable: {}, timeSlots: [], attendanceRecords: {}, holidays: [], settings: {}, latestErpDate: '2026-10-11' };
jest.mock('../../../context/AppContext', () => ({ useApp: () => ({ state: mockState }) }));
jest.mock('../../../components/common/ScreenHeader', () => () => null);
const nativeOS = Platform.OS;
beforeEach(() => { window.setTimeout = global.setTimeout; window.clearTimeout = global.clearTimeout; });
afterEach(() => { Platform.OS = nativeOS; });
function screen(navigation) {
    return render(<SafeAreaInsetsContext.Provider value={{ top: 0, bottom: 0, left: 0, right: 0 }}><SubjectDetailScreen route={{ params: { subjectId: 'a' } }} navigation={navigation} /></SafeAreaInsetsContext.Provider>);
}
test('subject detail has recorded attendance and one native Insights shortcut instead of simulators', () => {
    const parent = { navigate: jest.fn() }, before = JSON.stringify(mockState);
    const page = screen({ getParent: () => parent, navigate: jest.fn() });
    expect(page.queryByText('Next class')).toBe(null);
    expect(page.queryByText('Attend preview')).toBe(null);
    expect(page.queryByText('What if I skip today?')).toBe(null);
    fireEvent.press(page.getByLabelText('Open Insights calendar for Algorithms'));
    expect(parent.navigate).toHaveBeenCalledWith('Insights', { screen: 'InsightsMain', params: { section: 'plan', subjectId: 'a' } });
    expect(JSON.stringify(mockState)).toBe(before);
});
test('the web shortcut opens Plan with the same subject', () => {
    Platform.OS = 'web';
    const navigation = { navigate: jest.fn() }, page = screen(navigation);
    fireEvent.press(page.getByLabelText('Open Insights calendar for Algorithms'));
    expect(navigation.navigate).toHaveBeenCalledWith('Insights', { section: 'plan', subjectId: 'a' });
});
