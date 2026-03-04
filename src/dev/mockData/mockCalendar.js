/**
 * Generate Full Semester Calendar
 */

import {
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    format,
    isSameDay,
    addMonths,
    subMonths,
} from 'date-fns';

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const getDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export function generateSemesterCalendar({
    subject,
    timetable,
    records, // The app's attendanceRecords
    currentDate = new Date(),
    monthsBack = 2,
    monthsAhead = 3,
}) {
    const startDate = startOfMonth(subMonths(currentDate, monthsBack));
    const endDate = endOfMonth(addMonths(currentDate, monthsAhead));

    const allDays = eachDayOfInterval({ start: startDate, end: endDate });

    const calendar = allDays.map(day => {
        const dayOfWeek = day.getDay();
        const dayName = days[dayOfWeek];

        // Check if the subject has a class on this day in the timetable
        const daySlots = timetable[dayName] || [];
        const hasScheduledClass = daySlots.some(slot => slot.subjectId === subject.id);

        // Check if there's a history entry for this day
        const dateKey = getDateKey(day);
        const dayRecords = records[dateKey] || {};
        const subjectRecord = dayRecords[subject.id];

        const isFuture = day > currentDate && hasScheduledClass;
        const isPast = day < currentDate;
        const isToday = isSameDay(day, currentDate);

        return {
            date: day,
            dateFormatted: format(day, 'yyyy-MM-dd'),
            dayNumber: format(day, 'd'),
            dayName: format(day, 'EEE'),
            monthName: format(day, 'MMM'),
            isToday,
            isPast,
            isFuture,
            hasClass: hasScheduledClass,
            status: subjectRecord ? subjectRecord.status : null,
            isScheduled: hasScheduledClass,
        };
    });

    const byMonth = calendar.reduce((acc, day) => {
        const monthKey = format(day.date, 'yyyy-MM');
        if (!acc[monthKey]) {
            acc[monthKey] = {
                monthName: format(day.date, 'MMMM yyyy'),
                days: [],
            };
        }
        acc[monthKey].days.push(day);
        return acc;
    }, {});

    return {
        allDays: calendar,
        byMonth,
    };
}

export function getCalendarStats(calendar) {
    const { allDays } = calendar;

    const totalScheduled = allDays.filter(d => d.hasClass).length;
    const attended = allDays.filter(d => d.status === 'present').length;
    const skipped = allDays.filter(d => d.status === 'absent').length;
    const upcoming = allDays.filter(d => d.isFuture && d.hasClass).length;

    return {
        totalScheduled,
        attended,
        skipped,
        upcoming,
        percentage: totalScheduled > 0 ? (attended / (attended + skipped)) * 100 : 0,
    };
}
