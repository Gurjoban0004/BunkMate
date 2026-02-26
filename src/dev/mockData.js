/**
 * Mock Data for Development & Testing
 *
 * Provides realistic data to skip setup during development.
 * Covers various scenarios: good attendance, bad attendance, edge cases.
 */

// Helper to generate date keys
const getDateKey = (daysAgo) => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

function getCurrentDayName() {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
}

// ============================================
// MOCK TIME SLOTS
// ============================================
export const mockTimeSlots = [
    { id: 'slot-1', start: '09:00', end: '10:00' },
    { id: 'slot-2', start: '10:00', end: '11:00' },
    { id: 'slot-3', start: '11:00', end: '12:00' },
    { id: 'slot-4', start: '12:00', end: '13:00' },
    { id: 'slot-5', start: '14:00', end: '15:00' },
    { id: 'slot-6', start: '15:00', end: '16:00' },
];

// ============================================
// MOCK SUBJECTS
// ============================================
export const mockSubjects = [
    {
        id: 'sub-1',
        name: 'DSOOPS',
        teacher: 'Prof. Sharma',
        color: '#FF6B6B',
        initialTotal: 80,
        initialAttended: 65, // 81.25% - Good
        createdAt: '2025-01-01T10:00:00Z',
    },
    {
        id: 'sub-2',
        name: 'ES & IOT',
        teacher: 'Prof. Verma',
        color: '#4ECDC4',
        initialTotal: 40,
        initialAttended: 30, // 75% - Borderline
        createdAt: '2025-01-01T10:00:00Z',
    },
    {
        id: 'sub-3',
        name: 'Linux',
        teacher: 'Prof. Kumar',
        color: '#45B7D1',
        initialTotal: 60,
        initialAttended: 42, // 70% - Danger!
        createdAt: '2025-01-01T10:00:00Z',
    },
    {
        id: 'sub-4',
        name: 'BE I',
        teacher: 'Prof. Singh',
        color: '#96CEB4',
        initialTotal: 50,
        initialAttended: 48, // 96% - Excellent
        createdAt: '2025-01-01T10:00:00Z',
    },
    {
        id: 'sub-5',
        name: 'CN',
        teacher: 'Prof. Gupta',
        color: '#DDA0DD',
        initialTotal: 45,
        initialAttended: 33, // 73.3% - Below threshold
        createdAt: '2025-01-01T10:00:00Z',
    },
    {
        id: 'sub-6',
        name: 'EM-IV',
        teacher: 'Prof. Patel',
        color: '#F7DC6F',
        initialTotal: 35,
        initialAttended: 28, // 80% - Good
        createdAt: '2025-01-01T10:00:00Z',
    },
];

// ============================================
// MOCK TIMETABLE
// ============================================
export const mockTimetable = {
    Monday: [
        { slotId: 'slot-1', subjectId: 'sub-1' },
        { slotId: 'slot-2', subjectId: 'sub-1' },
        { slotId: 'slot-3', subjectId: 'sub-2' },
        { slotId: 'slot-4', subjectId: 'sub-6' },
        { slotId: 'slot-5', subjectId: 'sub-3' },
        { slotId: 'slot-6', subjectId: 'sub-3' },
    ],
    Tuesday: [
        { slotId: 'slot-1', subjectId: 'sub-4' },
        { slotId: 'slot-2', subjectId: 'sub-4' },
        { slotId: 'slot-3', subjectId: 'sub-5' },
        { slotId: 'slot-4', subjectId: 'sub-5' },
        { slotId: 'slot-5', subjectId: 'sub-2' },
        { slotId: 'slot-6', subjectId: 'sub-2' },
    ],
    Wednesday: [
        { slotId: 'slot-1', subjectId: 'sub-1' },
        { slotId: 'slot-2', subjectId: 'sub-1' },
        { slotId: 'slot-3', subjectId: 'sub-6' },
        { slotId: 'slot-5', subjectId: 'sub-5' },
        { slotId: 'slot-6', subjectId: 'sub-3' },
    ],
    Thursday: [
        { slotId: 'slot-1', subjectId: 'sub-2' },
        { slotId: 'slot-2', subjectId: 'sub-4' },
        { slotId: 'slot-3', subjectId: 'sub-4' },
        { slotId: 'slot-4', subjectId: 'sub-1' },
        { slotId: 'slot-5', subjectId: 'sub-6' },
        { slotId: 'slot-6', subjectId: 'sub-3' },
    ],
    Friday: [
        { slotId: 'slot-1', subjectId: 'sub-5' },
        { slotId: 'slot-2', subjectId: 'sub-5' },
        { slotId: 'slot-3', subjectId: 'sub-3' },
        { slotId: 'slot-4', subjectId: 'sub-3' },
        { slotId: 'slot-5', subjectId: 'sub-1' },
        { slotId: 'slot-6', subjectId: 'sub-6' },
    ],
    Saturday: [],
};

// ============================================
// MOCK ATTENDANCE RECORDS (Last 14 days)
// ============================================
export const mockAttendanceRecords = {
    [getDateKey(0)]: {
        'sub-1': { status: 'present', units: 2, isExtra: false },
    },
    [getDateKey(1)]: {
        'sub-1': { status: 'present', units: 2, isExtra: false },
        'sub-2': { status: 'absent', units: 1, isExtra: false },
        'sub-5': { status: 'present', units: 2, isExtra: false },
    },
    [getDateKey(2)]: {
        'sub-1': { status: 'present', units: 2, isExtra: false },
        'sub-6': { status: 'present', units: 1, isExtra: false },
        'sub-5': { status: 'absent', units: 1, isExtra: false },
        'sub-3': { status: 'present', units: 1, isExtra: false },
    },
    [getDateKey(3)]: {
        'sub-2': { status: 'present', units: 1, isExtra: false },
        'sub-4': { status: 'present', units: 2, isExtra: false },
        'sub-5': { status: 'present', units: 2, isExtra: false },
    },
    [getDateKey(4)]: {
        'sub-1': { status: 'present', units: 2, isExtra: false },
        'sub-3': { status: 'absent', units: 2, isExtra: false },
        'sub-6': { status: 'present', units: 1, isExtra: false },
    },
    [getDateKey(5)]: {
        _holiday: true,
    },
    [getDateKey(6)]: {
        'sub-5': { status: 'present', units: 2, isExtra: false },
        'sub-3': { status: 'present', units: 2, isExtra: false },
        'sub-1': { status: 'absent', units: 1, isExtra: false },
        'sub-6': { status: 'present', units: 1, isExtra: false },
    },
    [getDateKey(7)]: {
        'sub-1': { status: 'present', units: 2, isExtra: false },
        'sub-2': { status: 'present', units: 2, isExtra: false },
        'sub-4': { status: 'present', units: 2, isExtra: false },
    },
    [getDateKey(8)]: {
        'sub-1': { status: 'present', units: 2, isExtra: true },
    },
    [getDateKey(9)]: {
        'sub-4': { status: 'present', units: 2, isExtra: false },
        'sub-5': { status: 'absent', units: 2, isExtra: false },
        'sub-2': { status: 'present', units: 2, isExtra: false },
    },
    [getDateKey(10)]: {
        'sub-1': { status: 'present', units: 2, isExtra: false },
        'sub-6': { status: 'present', units: 1, isExtra: false },
        'sub-3': { status: 'present', units: 1, isExtra: false },
    },
    [getDateKey(11)]: {
        'sub-3': { status: 'absent', units: 2, isExtra: false },
        'sub-5': { status: 'present', units: 1, isExtra: false },
        'sub-1': { status: 'present', units: 1, isExtra: false },
    },
    [getDateKey(12)]: {
        'sub-2': { status: 'present', units: 1, isExtra: false },
        'sub-4': { status: 'present', units: 2, isExtra: false },
        'sub-6': { status: 'absent', units: 1, isExtra: false },
    },
    [getDateKey(13)]: {
        'sub-1': { status: 'present', units: 2, isExtra: false },
        'sub-3': { status: 'present', units: 2, isExtra: false },
        'sub-5': { status: 'present', units: 2, isExtra: false },
    },
    [getDateKey(14)]: {
        'sub-4': { status: 'present', units: 2, isExtra: false },
        'sub-2': { status: 'absent', units: 1, isExtra: false },
        'sub-6': { status: 'present', units: 1, isExtra: false },
    },
};

// ============================================
// MOCK SETTINGS
// ============================================
export const mockSettings = {
    notificationEnabled: true,
    notificationTime: '18:00',
    smartAlertsEnabled: true,
};

// ============================================
// MOCK HOLIDAYS
// ============================================
export const mockHolidays = [getDateKey(5)];

// ============================================
// COMPLETE MOCK STATE
// ============================================
export const getMockState = () => ({
    setupComplete: true,
    userName: 'Rahul',
    timeSlots: mockTimeSlots,
    subjects: mockSubjects,
    timetable: mockTimetable,
    attendanceRecords: mockAttendanceRecords,
    settings: mockSettings,
    holidays: mockHolidays,
    notificationState: {},
});

// ============================================
// SCENARIO-BASED MOCK DATA
// ============================================
export const MOCK_SCENARIOS = {
    NORMAL: getMockState(),

    ALL_DANGER: {
        ...getMockState(),
        subjects: mockSubjects.map((sub) => ({
            ...sub,
            initialAttended: Math.floor(sub.initialTotal * 0.6),
        })),
    },

    ALL_SAFE: {
        ...getMockState(),
        subjects: mockSubjects.map((sub) => ({
            ...sub,
            initialAttended: Math.floor(sub.initialTotal * 0.95),
        })),
    },

    FRESH_START: {
        ...getMockState(),
        attendanceRecords: {},
        subjects: mockSubjects.map((sub) => ({
            ...sub,
            initialTotal: 0,
            initialAttended: 0,
        })),
    },

    MANY_UNMARKED: {
        ...getMockState(),
        attendanceRecords: {
            [getDateKey(7)]: {
                'sub-1': { status: 'present', units: 2, isExtra: false },
            },
        },
    },

    LONG_STREAK: (() => {
        const records = {};
        for (let i = 0; i < 20; i++) {
            records[getDateKey(i)] = {
                'sub-1': { status: 'present', units: 2, isExtra: false },
                'sub-2': { status: 'present', units: 1, isExtra: false },
                'sub-3': { status: 'present', units: 2, isExtra: false },
            };
        }
        return { ...getMockState(), attendanceRecords: records };
    })(),

    EMPTY_TODAY: {
        ...getMockState(),
        timetable: {
            ...mockTimetable,
            [getCurrentDayName()]: [],
        },
    },
};

export default getMockState;
