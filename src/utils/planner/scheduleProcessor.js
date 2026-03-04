/**
 * Schedule processing for the planner.
 * Works with our adapted schedule format: { type: 'recurring', slots: [{ day, time, duration }] }
 * Timetable uses named days (Monday-Saturday) mapped to day numbers (0-6 where 0=Sun).
 */

import { getDateKey, getTodayDayName } from '../dateHelpers';

const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Get next upcoming class for a subject.
 */
export function getNextClass(subject, fromDate = new Date()) {
    const { schedule } = subject;
    if (!schedule || !schedule.slots || schedule.slots.length === 0) return null;

    const today = new Date(fromDate);
    today.setHours(0, 0, 0, 0);
    const maxDaysToCheck = 60;

    for (let i = 0; i < maxDaysToCheck; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() + i);
        const dayOfWeek = checkDate.getDay();

        const matchingSlot = schedule.slots.find(slot => slot.day === dayOfWeek);

        if (matchingSlot) {
            const classDateTime = new Date(checkDate);
            const [hours, minutes] = matchingSlot.time.split(':');
            classDateTime.setHours(parseInt(hours), parseInt(minutes), 0);

            // Skip if this class already passed today
            if (classDateTime > fromDate) {
                const isTomorrow = new Date(fromDate);
                isTomorrow.setDate(isTomorrow.getDate() + 1);
                isTomorrow.setHours(0, 0, 0, 0);
                const tomorrowEnd = new Date(isTomorrow);
                tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

                return {
                    date: classDateTime,
                    time: matchingSlot.time,
                    day: DAY_NAMES_SHORT[classDateTime.getDay()],
                    isToday: i === 0,
                    isTomorrow: classDateTime >= isTomorrow && classDateTime < tomorrowEnd,
                    formattedDate: `${MONTH_NAMES_SHORT[classDateTime.getMonth()]} ${classDateTime.getDate()}`,
                };
            }
        }
    }

    return null;
}

/**
 * Get all classes for a subject in next 7 days.
 */
export function getNext7DaysClasses(subject, fromDate = new Date()) {
    const classes = [];
    const { schedule } = subject;

    if (!schedule || !schedule.slots || schedule.slots.length === 0) return classes;

    const startDate = new Date(fromDate);
    startDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
        const checkDate = new Date(startDate);
        checkDate.setDate(startDate.getDate() + i);
        const dayOfWeek = checkDate.getDay();

        const matchingSlot = schedule.slots.find(slot => slot.day === dayOfWeek);

        if (matchingSlot) {
            const classDateTime = new Date(checkDate);
            const [hours, minutes] = matchingSlot.time.split(':');
            classDateTime.setHours(parseInt(hours), parseInt(minutes), 0);

            classes.push({
                date: classDateTime,
                time: matchingSlot.time,
                day: DAY_NAMES_SHORT[classDateTime.getDay()],
                dateNum: String(classDateTime.getDate()).padStart(2, '0'),
                isToday: i === 0,
            });
        }
    }

    return classes;
}

/**
 * Get today's classes from all subjects, sorted by time.
 */
export function getTodaysClasses(subjects, date = new Date()) {
    const today = new Date(date);
    today.setHours(0, 0, 0, 0);
    const todayDayOfWeek = today.getDay();

    return subjects
        .map(subject => {
            const { schedule } = subject;
            if (!schedule || !schedule.slots || schedule.slots.length === 0) return null;

            const matchingSlot = schedule.slots.find(slot => slot.day === todayDayOfWeek);

            if (matchingSlot) {
                const classDateTime = new Date(today);
                const [hours, minutes] = matchingSlot.time.split(':');
                classDateTime.setHours(parseInt(hours), parseInt(minutes), 0);

                return {
                    subject,
                    date: classDateTime,
                    time: matchingSlot.time,
                    hasPassed: classDateTime < new Date(),
                };
            }

            return null;
        })
        .filter(Boolean)
        .sort((a, b) => a.date - b.date);
}

/**
 * Check if today has any classes.
 */
export function hasClassesToday(subjects, date = new Date()) {
    return getTodaysClasses(subjects, date).length > 0;
}

/**
 * Format a relative date label: "Today", "Tomorrow", "Tue, Mar 5"
 */
export function formatRelativeDate(date) {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    const target = new Date(date);
    target.setHours(0, 0, 0, 0);

    if (target.getTime() === today.getTime()) return 'Today';
    if (target.getTime() === tomorrow.getTime()) return 'Tomorrow';

    return `${DAY_NAMES_SHORT[target.getDay()]}, ${MONTH_NAMES_SHORT[target.getMonth()]} ${target.getDate()}`;
}
