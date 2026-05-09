const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function toPlannerDateKey(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function parseLocalDate(dateInput, endOfDay = false) {
    if (!dateInput) return null;

    const datePart = typeof dateInput === 'string'
        ? dateInput.split('T')[0]
        : toPlannerDateKey(dateInput);
    const [year, month, day] = datePart.split('-').map(Number);

    if (!year || !month || !day) return null;

    return endOfDay
        ? new Date(year, month - 1, day, 23, 59, 59, 999)
        : new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function getPlannerEndDate(stateOrSubject) {
    const endDate = stateOrSubject?.settings?.semesterEndDate || stateOrSubject?.semesterEndDate;
    return parseLocalDate(endDate, true);
}

export function isWithinPlannerWindow(dateInput, stateOrSubject) {
    const endDate = getPlannerEndDate(stateOrSubject);
    if (!endDate) return true;

    const date = parseLocalDate(dateInput, false);
    if (!date) return true;

    return date <= endDate;
}

export function getUpcomingSubjectClasses(state, subjectId, options = {}) {
    const {
        fromDate = new Date(),
        maxClasses = 14,
        maxDays = 100,
    } = options;

    if (!state?.timetable || !subjectId) return [];

    const classes = [];
    const holidays = state.holidays || [];
    const endDate = getPlannerEndDate(state);
    const currentDate = new Date(fromDate);
    currentDate.setHours(0, 0, 0, 0);
    currentDate.setDate(currentDate.getDate() + 1);

    let safeGuard = 0;
    while (classes.length < maxClasses && safeGuard < maxDays) {
        if (endDate && currentDate > endDate) break;

        const dateKey = toPlannerDateKey(currentDate);
        if (!holidays.includes(dateKey)) {
            const dayName = DAY_NAMES[currentDate.getDay()];
            const dayClasses = state.timetable[dayName] || [];
            const subjectClasses = dayClasses.filter(cls => cls.subjectId === subjectId);

            subjectClasses.forEach(cls => {
                if (classes.length >= maxClasses) return;

                const timeSlot = (state.timeSlots || []).find(ts => ts.id === cls.slotId);
                const units = cls.units || timeSlot?.units || 1;
                classes.push({
                    ...cls,
                    subjectId,
                    classKey: `${dateKey}:${cls.slotId || cls.time || classes.length}`,
                    date: new Date(currentDate),
                    dateKey,
                    dayName,
                    time: timeSlot?.start || cls.time || '09:00',
                    units,
                });
            });
        }

        currentDate.setDate(currentDate.getDate() + 1);
        safeGuard++;
    }

    return classes;
}
