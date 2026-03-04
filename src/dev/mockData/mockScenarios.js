/**
 * Mock Scenarios combining previous static mock state with the new dynamic dev mode ones.
 */

import { generateSubject, SUBJECT_TEMPLATES } from './mockSubjects';
import { generateRealisticHistory } from './mockHistory';

// Helper to generate a date key offset from today
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

// Re-use timetable base structure to bind subjects correctly
export const mockTimeSlots = [
    { id: 'slot-1', start: '09:00', end: '10:00' },
    { id: 'slot-2', start: '10:00', end: '11:00' },
    { id: 'slot-3', start: '11:00', end: '12:00' },
    { id: 'slot-4', start: '12:00', end: '13:00' },
    { id: 'slot-5', start: '14:00', end: '15:00' },
    { id: 'slot-6', start: '15:00', end: '16:00' },
];

export const mockTimetable = {
    Monday: [
        { slotId: 'slot-1', subjectId: 'dbms_critical' },
        { slotId: 'slot-2', subjectId: 'dbms_critical' },
        { slotId: 'slot-3', subjectId: 'math_borderline' },
        { slotId: 'slot-4', subjectId: 'physics_excellent' },
        { slotId: 'slot-5', subjectId: 'linux_safe' },
        { slotId: 'slot-6', subjectId: 'linux_safe' },
    ],
    Tuesday: [
        { slotId: 'slot-1', subjectId: 'chemistry_exact' },
        { slotId: 'slot-2', subjectId: 'chemistry_exact' },
        { slotId: 'slot-3', subjectId: 'english_desperate' },
        { slotId: 'slot-4', subjectId: 'english_desperate' },
        { slotId: 'slot-5', subjectId: 'math_borderline' },
        { slotId: 'slot-6', subjectId: 'math_borderline' },
    ],
    Wednesday: [
        { slotId: 'slot-1', subjectId: 'dbms_critical' },
        { slotId: 'slot-2', subjectId: 'dbms_critical' },
        { slotId: 'slot-3', subjectId: 'physics_excellent' },
        { slotId: 'slot-5', subjectId: 'english_desperate' },
        { slotId: 'slot-6', subjectId: 'linux_safe' },
    ],
    Thursday: [
        { slotId: 'slot-1', subjectId: 'math_borderline' },
        { slotId: 'slot-2', subjectId: 'chemistry_exact' },
        { slotId: 'slot-3', subjectId: 'chemistry_exact' },
        { slotId: 'slot-4', subjectId: 'dbms_critical' },
        { slotId: 'slot-5', subjectId: 'physics_excellent' },
        { slotId: 'slot-6', subjectId: 'linux_safe' },
    ],
    Friday: [
        { slotId: 'slot-1', subjectId: 'english_desperate' },
        { slotId: 'slot-2', subjectId: 'english_desperate' },
        { slotId: 'slot-3', subjectId: 'linux_safe' },
        { slotId: 'slot-4', subjectId: 'linux_safe' },
        { slotId: 'slot-5', subjectId: 'dbms_critical' },
        { slotId: 'slot-6', subjectId: 'physics_excellent' },
    ],
    Saturday: [],
    Sunday: [],
};

// Instead of passing a static array, we build scenarios out of SUBJECT_TEMPLATES
const generateStateWithSubjects = (subjectKeys) => {
    const subjects = subjectKeys.map(k => generateSubject(SUBJECT_TEMPLATES[k] || {}));

    // To make the state robust, we must auto-generate history that aligns with these initial percentages
    const generatedHistory = generateRealisticHistory({
        subjects,
        timetable: mockTimetable,
        weeksBack: 4,
        currentDate: new Date(),
        pattern: 'realistic',
    });

    return {
        setupComplete: true,
        userName: 'DevUser',
        timeSlots: mockTimeSlots,
        timetable: mockTimetable,
        settings: {
            notificationEnabled: true,
            notificationTime: '18:00',
            smartAlertsEnabled: true,
        },
        holidays: [getDateKey(5)],
        notificationState: {},
        subjects,
        attendanceRecords: generatedHistory,
    };
};

export const MOCK_SCENARIOS = {
    // Ported from update-dev.md:
    PERFECT_STUDENT: generateStateWithSubjects([
        'SAFE_LINUX', 'EXCELLENT_PHYSICS', 'SAFE_LINUX', 'SAFE_LINUX' // Simplified mapping
    ]),

    STRUGGLING: generateStateWithSubjects([
        'CRITICAL_DBMS', 'BORDERLINE_MATH', 'DESPERATE_ENGLISH', 'EXACT_CHEMISTRY'
    ]),

    MIXED_BAG: generateStateWithSubjects([
        'CRITICAL_DBMS', 'SAFE_LINUX', 'BORDERLINE_MATH', 'EXCELLENT_PHYSICS', 'EXACT_CHEMISTRY'
    ]),

    EDGE_CASES: generateStateWithSubjects([
        'EXACT_CHEMISTRY', 'DESPERATE_ENGLISH'
    ]),

    // Original Scenarios Mapping:
    NORMAL: generateStateWithSubjects([
        'CRITICAL_DBMS', 'SAFE_LINUX', 'BORDERLINE_MATH', 'EXCELLENT_PHYSICS', 'EXACT_CHEMISTRY'
    ]),

    ALL_DANGER: generateStateWithSubjects([
        'CRITICAL_DBMS', 'DESPERATE_ENGLISH'
    ]),
};

export default MOCK_SCENARIOS.NORMAL;
