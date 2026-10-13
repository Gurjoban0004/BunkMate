import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import CombinedSkipPlanner from '../CombinedSkipPlanner';
let mockState;
jest.mock('../../../context/AppContext', () => ({ useApp: () => ({ state: mockState }) }));
beforeEach(() => {
    window.setTimeout = global.setTimeout; window.clearTimeout = global.clearTimeout;
    mockState = { subjects: [{ id: 'a', name: 'Algorithms', initialAttended: 90, initialTotal: 100, target: 75 }],
        timetable: { Monday: [{ subjectId: 'a', slotId: '1' }, { subjectId: 'a', slotId: '2' }] },
        timeSlots: [{ id: '1', start: '09:00', end: '10:00' }, { id: '2', start: '10:00', end: '11:00' }],
        settings: {}, holidays: [], attendanceRecords: {}, latestErpDate: '2026-10-11', devDate: '2026-10-11T20:00:00' };
});
test('a calendar class tap updates exact projections immediately and Auto plan restores the choices', () => {
    const original = JSON.stringify(mockState), screen = render(<CombinedSkipPlanner />);
    const tile = screen.getByLabelText('Skip Algorithms on 2026-10-12 at 09:00, 1 full pairs');
    expect(tile.props.accessibilityState.checked).toBe(true);
    fireEvent.press(tile);
    expect(screen.getByLabelText('Skip Algorithms on 2026-10-12 at 09:00, 1 full pairs').props.accessibilityState.checked).toBe(false);
    fireEvent.press(screen.getByText('Numbers & recovery'));
    expect(screen.getByText('Recorded 90/100 · projected 92/108 lectures')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Generate balanced auto plan'));
    expect(screen.getByText('Recorded 90/100 · projected 90/108 lectures')).toBeTruthy();
    expect(JSON.stringify(mockState)).toBe(original);
});
test('month navigation selects real classes; empty days remain selectable, custom fractions pause the preview', () => {
    const screen = render(<CombinedSkipPlanner />);
    fireEvent.press(screen.getByLabelText('Show month calendar'));
    fireEvent.press(screen.getByLabelText('Oct 19, 1 scheduled classes, 1 skip pairs'));
    expect(screen.getByLabelText('Skip Algorithms on 2026-10-19 at 09:00, 1 full pairs')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Oct 20, 0 scheduled classes, 0 skip pairs'));
    expect(screen.getByText('No timetable classes on this day.')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Skip pairs per week'), '1.5');
    expect(screen.getByText('Use a whole number, 0 or more.')).toBeTruthy();
    expect(screen.getByLabelText('Generate balanced auto plan').props.accessibilityState.disabled).toBe(true);
});
test('unsafe manual skips are visibly flagged and sync recalculates using the new register', () => {
    mockState.subjects[0].initialAttended = 76;
    const screen = render(<CombinedSkipPlanner />);
    fireEvent.press(screen.getByLabelText('Skip Algorithms on 2026-10-12 at 09:00, 1 full pairs'));
    expect(screen.getByText('1 subject needs attention')).toBeTruthy();
    mockState = { ...mockState, subjects: [{ ...mockState.subjects[0], initialAttended: 50 }] };
    screen.rerender(<CombinedSkipPlanner />);
    expect(screen.getByLabelText('Skip Algorithms on 2026-10-12 at 09:00, 1 full pairs').props.accessibilityState.checked).toBe(false);
    expect(screen.getByLabelText('Skip pairs per week').props.value).toBe('2');
});
test('subject entry focuses its timetable without removing other subjects from the balance list', () => {
    mockState.subjects.push({ id: 'b', name: 'Networks', initialAttended: 20, initialTotal: 22, target: 80 });
    const screen = render(<CombinedSkipPlanner initialSubjectId="b" />);
    expect(screen.getByText('No classes for this subject on this day.')).toBeTruthy();
    expect(screen.getByLabelText('Focus calendar on Algorithms')).toBeTruthy();
    expect(screen.getByLabelText('Focus calendar on Networks').props.accessibilityState.selected).toBe(true);
    fireEvent.press(screen.getByLabelText('Show all subjects'));
    expect(screen.getByLabelText('Skip Algorithms on 2026-10-12 at 09:00, 1 full pairs')).toBeTruthy();
});
test('toggling the initially focused class keeps that date selected, and month-to-week preserves the chosen date', () => {
    mockState.timetable.Wednesday = mockState.timetable.Monday;
    mockState.timetable.Friday = mockState.timetable.Monday;
    const screen = render(<CombinedSkipPlanner />);
    const tile = screen.getAllByRole('checkbox')[0], label = tile.props.accessibilityLabel;
    fireEvent.press(tile);
    expect(screen.getByLabelText(label).props.accessibilityState.checked).toBe(false);
    fireEvent.press(screen.getByLabelText('Show month calendar'));
    fireEvent.press(screen.getByLabelText('Oct 21, 1 scheduled classes, 1 skip pairs'));
    fireEvent.press(screen.getByLabelText('Show week calendar'));
    expect(screen.getByText('Oct 19 — Oct 25')).toBeTruthy();
    expect(screen.getByLabelText('Skip Algorithms on 2026-10-21 at 09:00, 1 full pairs')).toBeTruthy();
});
