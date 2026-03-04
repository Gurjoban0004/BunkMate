/**
 * Mock Subject Generators
 * 
 * Generate subjects with different scenarios
 */

import { COLORS } from "../../theme/theme";
import { addDays, subDays } from 'date-fns';

/**
 * Generate a subject with specific percentage
 */
export function generateSubject({
    id,
    name,
    percentage,
    total = 40,
    target = 75,
    color = COLORS.subjectPalette[0],
    teacher = 'Prof. Dev',
}) {
    const attended = Math.round((percentage / 100) * total);

    return {
        id,
        name,
        teacher,
        color,
        initialTotal: total,
        initialAttended: attended,
        target, // Store target if needed
        createdAt: subDays(new Date(), 60).toISOString(),
        // We can add mock schedules here if needed for timetable generation
    };
}

/**
 * Pre-defined subject templates
 */
export const SUBJECT_TEMPLATES = {
    // Below threshold - DANGER
    CRITICAL_DBMS: {
        id: 'dbms_critical',
        name: 'DBMS',
        percentage: 68,
        target: 75,
        color: COLORS.subjectPalette[0],
        teacher: 'Prof. Sharma',
    },

    // Just below target - WARNING
    BORDERLINE_MATH: {
        id: 'math_borderline',
        name: 'Math',
        percentage: 74,
        target: 75,
        color: COLORS.subjectPalette[1],
        teacher: 'Prof. Verma',
    },

    // Safe - GREEN
    SAFE_LINUX: {
        id: 'linux_safe',
        name: 'Linux',
        percentage: 85,
        target: 75,
        color: COLORS.subjectPalette[2],
        teacher: 'Prof. Kumar',
    },

    // Very safe - can skip freely
    EXCELLENT_PHYSICS: {
        id: 'physics_excellent',
        name: 'Physics',
        percentage: 92,
        target: 75,
        color: COLORS.subjectPalette[3],
        teacher: 'Prof. Singh',
    },

    // exactly at threshold - edge case
    EXACT_CHEMISTRY: {
        id: 'chemistry_exact',
        name: 'Chemistry',
        percentage: 75.0,
        target: 75,
        color: COLORS.subjectPalette[4],
        teacher: 'Prof. Patel',
    },

    // Beyond recovery - worst case
    DESPERATE_ENGLISH: {
        id: 'english_desperate',
        name: 'English',
        percentage: 58,
        target: 75,
        color: COLORS.subjectPalette[0],
        teacher: 'Prof. Gupta',
    },
};
