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
test('subject detail restores its simulator and opens the dedicated calendar', () => {
    const parent = { navigate: jest.fn() }, before = JSON.stringify(mockState);
    const navigate = jest.fn(), page = screen({ getParent: () => parent, navigate });
    expect(page.queryByText('Next class')).toBe(null);
    expect(page.getByText('Skip / Attend simulator')).toBeTruthy();
    expect(page.queryByText('Attendance Impact & Recovery')).toBeNull();
    fireEvent.press(page.getByLabelText('Add one simulated class'));
    expect(page.getByText('89.1%')).toBeTruthy();
    fireEvent.press(page.getByLabelText('Simulate attending classes'));
    fireEvent.press(page.getByLabelText('Add one simulated class'));
    expect(page.getByText('90.1%')).toBeTruthy();
    fireEvent.press(page.getByLabelText('Plan specific classes on a calendar'));
    expect(navigate).toHaveBeenCalledWith('SubjectPlanner', { subjectId: 'a', subjectName: 'Algorithms', initialMode: 'attend' });
    fireEvent.press(page.getByLabelText('Reset simulation'));
    expect(page.getAllByText('90.0%')).toHaveLength(2);
    expect(page.queryByText('What if I skip today?')).toBe(null);
    fireEvent.press(page.getByLabelText('Open weekly skip calendar for Algorithms'));
    expect(page.getByText('Weekly skip calendar')).toBeTruthy();
    expect(navigate).toHaveBeenCalledWith('SkipPlan', { subjectId: 'a' });
    expect(JSON.stringify(mockState)).toBe(before);
});
test('the web shortcut opens Plan with the same subject', () => {
    Platform.OS = 'web';
    const navigation = { navigate: jest.fn() }, page = screen(navigation);
    fireEvent.press(page.getByLabelText('Open weekly skip calendar for Algorithms'));
    expect(navigation.navigate).toHaveBeenCalledWith('SkipPlan', { subjectId: 'a' });
});
