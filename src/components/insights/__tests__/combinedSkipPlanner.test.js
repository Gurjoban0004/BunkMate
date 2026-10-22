import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import CombinedSkipPlanner from '../CombinedSkipPlanner';
let mockState;
const mockDispatch = jest.fn();
jest.mock('../../../context/AppContext', () => ({ useApp: () => ({ state: mockState, dispatch: mockDispatch }) }));
const page = () => render(<SafeAreaInsetsContext.Provider value={{ top: 47, bottom: 0, left: 0, right: 0 }}><CombinedSkipPlanner /></SafeAreaInsetsContext.Provider>);
beforeEach(() => {
    window.setTimeout = global.setTimeout; window.clearTimeout = global.clearTimeout; mockDispatch.mockClear();
    mockState = { subjects: [{ id: 'a', name: 'Algorithms', initialAttended: 90, initialTotal: 100, target: 75 }],
        timetable: { Monday: [{ subjectId: 'a', slotId: '1' }, { subjectId: 'a', slotId: '2' }] },
        timeSlots: [{ id: '1', start: '09:00', end: '10:00' }, { id: '2', start: '10:00', end: '11:00' }],
        settings: { skipPlan: { pairsPerWeek: 2, weeks: 4 } }, holidays: [], attendanceRecords: {}, latestErpDate: '2026-10-11', devDate: '2026-10-12T08:00:00' };
});
test('month-first calendar hides configuration after setup; preferences reopen on demand', () => {
    const screen = page();
    expect(screen.getByLabelText('Show month calendar').props.accessibilityState.selected).toBe(true);
    expect(screen.queryByLabelText('Skip pairs per week')).toBe(null);
    fireEvent.press(screen.getByLabelText('Edit plan preferences'));
    fireEvent.changeText(screen.getByLabelText('Skip pairs per week'), '3');
    fireEvent.press(screen.getByLabelText('Save balanced weekly plan'));
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'UPDATE_SETTINGS', payload: { skipPlan: { pairsPerWeek: 3, weeks: 4, skipIds: null } } });
});
test('one-time setup validates integers and persists preferences without attendance', () => {
    mockState.settings = {};
    const before = JSON.stringify(mockState), screen = page();
    fireEvent.changeText(screen.getByLabelText('Skip pairs per week'), '1.5');
    expect(screen.getByLabelText('Save balanced weekly plan').props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(screen.getByLabelText('Skip pairs per week'), '2');
    fireEvent.press(screen.getByLabelText('Save balanced weekly plan'));
    expect(JSON.stringify(mockState)).toBe(before);
    expect(mockDispatch.mock.calls[0][0].payload).toEqual({ skipPlan: { pairsPerWeek: 2, weeks: 4, skipIds: null } });
});
test('setup stepper supports zero and custom goals, and saves the selected horizon', () => {
    mockState.settings = {};
    const screen = page();
    fireEvent.press(screen.getByLabelText('Decrease weekly skip goal'));
    fireEvent.press(screen.getByLabelText('Decrease weekly skip goal'));
    expect(screen.getByLabelText('Skip pairs per week').props.value).toBe('0');
    expect(screen.getByLabelText('Decrease weekly skip goal').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByLabelText('Increase weekly skip goal'));
    expect(screen.getByLabelText('Skip pairs per week').props.value).toBe('1');
    fireEvent.changeText(screen.getByLabelText('Skip pairs per week'), '7');
    fireEvent.press(screen.getByLabelText('Plan 8 weeks'));
    fireEvent.press(screen.getByLabelText('Save balanced weekly plan'));
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'UPDATE_SETTINGS', payload: { skipPlan: { pairsPerWeek: 7, weeks: 8, skipIds: null } } });
});
test('a class tap stores only hypothetical choices and instantly updates after shared state changes', () => {
    const screen = page(), label = 'Skip Algorithms on 2026-10-12 at 09:00, 1 full pairs';
    const before = JSON.stringify(mockState.attendanceRecords);
    fireEvent.press(screen.getByLabelText(label));
    const preferences = mockDispatch.mock.calls[0][0].payload.skipPlan;
    mockState = { ...mockState, settings: { ...mockState.settings, skipPlan: preferences } };
    screen.rerender(<SafeAreaInsetsContext.Provider value={{ top: 47, bottom: 0, left: 0, right: 0 }}><CombinedSkipPlanner /></SafeAreaInsetsContext.Provider>);
    expect(screen.getByLabelText(label).props.accessibilityState.checked).toBe(false);
    fireEvent.press(screen.getByLabelText('View all subject projections and recovery'));
    expect(screen.getByText('Recorded 90/100 · projected 92/108 lectures')).toBeTruthy();
    fireEvent.press(screen.getByText('Rebuild a balanced plan'));
    expect(mockDispatch.mock.calls.at(-1)[0].payload.skipPlan).toEqual({ pairsPerWeek: 2, weeks: 4, skipIds: null });
    expect(JSON.stringify(mockState.attendanceRecords)).toBe(before);
});
test('subject selection happens in the details panel and leaves the calendar compact', () => {
    mockState.subjects.push({ id: 'b', name: 'Networks', initialAttended: 20, initialTotal: 22, target: 80 });
    const screen = page();
    fireEvent.press(screen.getByLabelText('View all subject projections and recovery'));
    expect(screen.getByLabelText('Focus calendar on Networks')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Focus calendar on Networks'));
    expect(screen.getByText('No classes for this subject.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Show all subjects'));
    expect(screen.getByLabelText('Skip Algorithms on 2026-10-12 at 09:00, 1 full pairs')).toBeTruthy();
});

test('attend all and undo only change plan preferences', () => {
    const before = JSON.stringify(mockState.attendanceRecords), screen = page();
    fireEvent.press(screen.getByText('Attend all'));
    const next = mockDispatch.mock.calls.at(-1)[0];
    expect(next.payload.skipPlan.skipIds).toEqual([]);
    mockState = { ...mockState, settings: { ...mockState.settings, skipPlan: next.payload.skipPlan } };
    screen.rerender(<SafeAreaInsetsContext.Provider value={{ top: 47, bottom: 0, left: 0, right: 0 }}><CombinedSkipPlanner /></SafeAreaInsetsContext.Provider>);
    expect(screen.getByText('90.2% after this class')).toBeTruthy();
    fireEvent.press(screen.getByText('Undo change'));
    expect(mockDispatch.mock.calls.at(-1)[0].payload.skipPlan).toEqual({ pairsPerWeek: 2, weeks: 4 });
    expect(JSON.stringify(mockState.attendanceRecords)).toBe(before);
});
