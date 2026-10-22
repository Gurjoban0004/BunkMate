import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import SubjectPlannerScreen from '../SubjectPlannerScreen';
let mockState;
jest.mock('../../../context/AppContext', () => ({ useApp: () => ({ state: mockState }) }));
jest.mock('../../../components/common/ScreenHeader', () => () => null);
beforeEach(() => {
    window.setTimeout = global.setTimeout; window.clearTimeout = global.clearTimeout;
    mockState = { subjects: [{ id: 'a', name: 'Algorithms', initialAttended: 78, initialTotal: 100, target: 75 }],
        timeSlots: [{ id: '1', start: '09:00', end: '10:00' }, { id: '2', start: '10:00', end: '11:00' }, { id: '3', start: '13:00', end: '14:00' }],
        timetable: { Tuesday: [{ subjectId: 'a', slotId: '1' }, { subjectId: 'a', slotId: '2' }, { subjectId: 'a', slotId: '3' }] },
        attendanceRecords: {}, holidays: [], devDate: '2026-10-12T07:00:00', settings: { semesterEndDate: '2026-10-28' } };
});
const screen = () => render(<SafeAreaInsetsContext.Provider value={{ top: 0, bottom: 0, left: 0, right: 0 }}><SubjectPlannerScreen route={{ params: { subjectId: 'a' } }} /></SafeAreaInsetsContext.Provider>);

test('safe selection uses actual class lengths and individual removal preserves the other class that day', () => {
    const before = JSON.stringify(mockState), page = screen();
    fireEvent.press(page.getByText('Select safe skips'));
    expect(page.getByText('75.7%')).toBeTruthy(); // 78 / (100 + 2 + 1)
    fireEvent.press(page.getByLabelText('Remove 2026-10-13 09:00'));
    expect(page.getByText('77.2%')).toBeTruthy(); // only the 1-period class remains
    expect(page.getByLabelText('Remove 2026-10-13 13:00')).toBeTruthy();
    expect(JSON.stringify(mockState)).toBe(before);
});

test('attend selection stops at the goal and clear returns to recorded totals', () => {
    mockState.subjects[0].initialAttended = 74;
    const page = screen();
    fireEvent.press(page.getByText('Plan attendance'));
    fireEvent.press(page.getByText('Select to reach target'));
    expect(page.getByText('75.2%')).toBeTruthy(); // (74 + 5) / (100 + 5)
    fireEvent.press(page.getByText('Clear selection'));
    expect(page.getAllByText('74.0%')).toHaveLength(2);
});

test('losing a subject during a sync does not change the hook order', () => {
    const page = screen();
    mockState = { ...mockState, subjects: [] };
    page.rerender(<SafeAreaInsetsContext.Provider value={{ top: 0, bottom: 0, left: 0, right: 0 }}><SubjectPlannerScreen route={{ params: { subjectId: 'a' } }} /></SafeAreaInsetsContext.Provider>);
    expect(page.getByText('Subject not found')).toBeTruthy();
});

test('makes it clear when the target cannot be recovered before semester end', () => {
    mockState.subjects[0].initialAttended = 70;
    mockState.settings.semesterEndDate = '2026-10-13';
    const page = screen();
    fireEvent.press(page.getByText('Plan attendance'));
    fireEvent.press(page.getByText('Select to reach target'));
    expect(page.getByText(/Attending every class in this window still leaves you below 75%/)).toBeTruthy();
});

test('attend guidance uses the next unselected class rather than the longest class', () => {
    const page = screen();
    fireEvent.press(page.getByText('Plan attendance'));
    fireEvent.press(page.getByLabelText('Tue 13, toggle all classes'));
    fireEvent.press(page.getByLabelText('Remove 2026-10-13 13:00'));
    expect(page.getByText(/The next unselected class adds about 0.2 percentage points/)).toBeTruthy();
});
