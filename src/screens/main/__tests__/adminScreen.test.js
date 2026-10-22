import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import AdminScreen from '../AdminScreen';
import { fetchUserRoster } from '../../../services/adminApi';
jest.mock('../../../context/AppContext', () => ({ useApp: () => ({ state: { userName: 'Test Admin' } }) }));
jest.mock('../../../services/adminService', () => ({ getAdminConfig: async () => ({}), getActiveAnnouncements: async () => [] }));
jest.mock('../../../services/adminApi', () => ({
    fetchUserRoster: jest.fn(), getRevokedUsers: async () => [{ rollNumber: 'r2' }],
    fetchLive: async () => null, fetchDaily: async () => null,
    fetchUsage: async () => null, fetchLoginEvents: async () => null,
}));
const users = [
    { rollNumber: 'r1', studentName: 'Anya', batchGroup: 'G4', inCloud: true, erpConnected: true, overallAttendancePct: 90, belowGoal: 0, lastActive: 2 },
    { rollNumber: 'r2', studentName: 'Bilal', batchGroup: 'G2', inCloud: true, erpConnected: false, overallAttendancePct: 65, belowGoal: 2, lastActive: 1 },
];
beforeEach(() => {
    window.setTimeout = global.setTimeout; window.clearTimeout = global.clearTimeout;
    fetchUserRoster.mockReset().mockResolvedValue({ users, unfinished: {} });
});
const screen = () => render(<SafeAreaInsetsContext.Provider value={{ top: 0, bottom: 0, left: 0, right: 0 }}><AdminScreen /></SafeAreaInsetsContext.Provider>);

test('student filters combine with search and counts without mutating the roster', async () => {
    const page = screen();
    fireEvent.press(page.getByText('Students'));
    await act(async () => {});
    expect(page.getByText('2 of 2 students')).toBeTruthy();
    fireEvent.press(page.getByLabelText('Filter students: Below goal'));
    expect(page.getByText('1 of 2 students')).toBeTruthy();
    expect(page.getByText('Bilal')).toBeTruthy();
    expect(page.queryByText('Anya')).toBeNull();
    fireEvent.changeText(page.getByLabelText('Search students'), 'G4');
    expect(page.getByText('0 of 2 students')).toBeTruthy();
    fireEvent.press(page.getByLabelText('Filter students: Everyone'));
    expect(page.getByText('Anya')).toBeTruthy();
    expect(users.map((user) => user.rollNumber)).toEqual(['r1', 'r2']);
});

test('a failed refresh retains the last roster and offers retry', async () => {
    const page = screen();
    fireEvent.press(page.getByText('Students'));
    await act(async () => {});
    expect(page.getByText('Anya')).toBeTruthy();
    fetchUserRoster.mockRejectedValueOnce(new Error('Network unavailable'));
    fireEvent.press(page.getByLabelText('Refresh admin panels'));
    await act(async () => {});
    expect(page.getByText('Network unavailable')).toBeTruthy();
    expect(page.getByText('Anya')).toBeTruthy();
    expect(page.getByText('Retry')).toBeTruthy();
});
