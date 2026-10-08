import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import AttendanceImpactCard from '../AttendanceImpactCard';
import WhatIfSimulator from '../../planner/SubjectDetail/WhatIfSimulator';

let mockAppState;
jest.mock('../../../context/AppContext', () => ({ useApp: () => ({ state: mockAppState }) }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));

beforeEach(() => {
    // The project's network setup supplies a minimal window, without browser timers.
    window.setTimeout = global.setTimeout;
    window.clearTimeout = global.clearTimeout;
    mockAppState = {
        subjects: [
            { id: 'math', name: 'Math', initialAttended: 50, initialTotal: 60, target: 85 },
            { id: 'physics', name: 'Physics', initialAttended: 44, initialTotal: 54, target: 75 },
        ],
        settings: {}, attendanceRecords: {}, holidays: [], devDate: '2026-10-08T12:00:00',
        timeSlots: [{ id: 'p1', start: '09:00', end: '11:00' }, { id: 'p2', start: '13:00', end: '15:00' }],
        timetable: { Thursday: [{ slotId: 'p1', subjectId: 'math' }, { slotId: 'p2', subjectId: 'physics' }] },
    };
});

test('previews combined skip pairs and resets without changing attendance state', () => {
    const before = JSON.stringify(mockAppState);
    const screen = render(<AttendanceImpactCard />);
    expect(screen.getByText('Current: 94 / 114 = 82.46%')).toBeTruthy();
    expect(screen.getByText('94 / 116 = 81.03%')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Add one pair to combined attendance'));
    expect(screen.getByText('94 / 118 = 79.66%')).toBeTruthy();
    fireEvent.press(screen.getByText('Reset preview'));
    expect(screen.getByText('94 / 114 = 82.46%')).toBeTruthy();
    expect(JSON.stringify(mockAppState)).toBe(before);
});

test('lets students select exactly which of today’s classes to skip', () => {
    const screen = render(<AttendanceImpactCard />);
    fireEvent.press(screen.getByText('Skip today’s classes'));
    expect(screen.getByText('94 / 118 = 79.66%')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Skip Physics, 1 - 3 PM, pair 1'));
    expect(screen.getByText('94 / 116 = 81.03%')).toBeTruthy();
    expect(screen.getByText('44 / 54 (81.48%) → 44 / 54 (81.48%)')).toBeTruthy();
    expect(screen.getByText('50 / 60 (83.33%) → 50 / 62 (80.65%)')).toBeTruthy();
});

test('the Insights shortcut opens today’s timetable scenario immediately', () => {
    const screen = render(<AttendanceImpactCard initialMode="today" />);
    expect(screen.getByText('94 / 118 = 79.66%')).toBeTruthy();
    expect(screen.getByLabelText('Skip Math, 9 - 11 AM, pair 1')).toBeTruthy();
});

test('subject details default to that subject and retain combined recovery', () => {
    const screen = render(<AttendanceImpactCard subjectId="math" />);
    expect(screen.getByLabelText('Add one pair to Math')).toBeTruthy();
    expect(screen.queryByLabelText('Add one pair to Physics')).toBeNull();
    expect(screen.getByText('94 / 116 = 81.03%')).toBeTruthy();
    expect(screen.getByText('Math: 50 / 62 = 80.65%')).toBeTruthy();
    expect(screen.getByText('85% requirement: 9 pairs · 18 lectures')).toBeTruthy();
});

test('a sync updates the baseline without losing the hypothetical selection', () => {
    const screen = render(<AttendanceImpactCard />);
    mockAppState = { ...mockAppState, subjects: mockAppState.subjects.map((s) => s.id === 'math' ? { ...s, initialAttended: 52, initialTotal: 62 } : s) };
    screen.rerender(<AttendanceImpactCard />);
    expect(screen.getByText('Current: 96 / 116 = 82.76%')).toBeTruthy();
    expect(screen.getByText('96 / 118 = 81.36%')).toBeTruthy();
});

test('preserves the quick attend preview in full pairs alongside the new skip feature', () => {
    function AttendPreview() {
        const [offset, setOffset] = React.useState(0);
        return <WhatIfSimulator subjectData={{ id: 'math', name: 'Math', attended: 50, total: 60, target: 85, unitsPerClass: 2 }} initialMode="attend" allowSkip={false} title="Attend preview" classLabel="pairs · 2 lectures" simulationOffset={offset} setSimulationOffset={setOffset} />;
    }
    const before = JSON.stringify(mockAppState);
    const screen = render(<AttendPreview />);
    expect(screen.getByText('Attend preview')).toBeTruthy();
    expect(screen.getByText('83.3%')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Add one simulated class pair'));
    expect(screen.getByText('83.9%')).toBeTruthy();
    expect(screen.getByText('Plan on a calendar')).toBeTruthy();
    expect(JSON.stringify(mockAppState)).toBe(before);
});
