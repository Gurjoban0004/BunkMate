export function getTodayKey() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function getDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function getTodayDayName() {
    const days = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
    ];
    return days[new Date().getDay()];
}

export function formatDate(date = new Date()) {
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

/**
 * Formats a time range like "09:00", "11:00" to "9 - 11 AM"
 * or "11:00", "13:00" to "11 AM - 1 PM"
 */
export function formatTimeRange(startStr, endStr) {
    if (!startStr || !endStr) return '';

    const formatHour = (timeStr) => {
        const [h, m] = timeStr.split(':');
        const hour = parseInt(h, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        if (m === '00') {
            return { ampm, text: `${hour12}` };
        }
        return { ampm, text: `${hour12}:${m}` };
    };

    const start = formatHour(startStr);
    const end = formatHour(endStr);

    if (start.ampm === end.ampm) {
        // Same period: "9 - 11 AM"
        return `${start.text} - ${end.text} ${end.ampm}`;
    } else {
        // Different period: "11 AM - 1 PM"
        return `${start.text} ${start.ampm} - ${end.text} ${end.ampm}`;
    }
}

/**
 * Returns the date key for the day after the given date key.
 */
export function getNextDay(dateKey) {
    const d = new Date(dateKey + 'T12:00:00'); // Use noon to avoid TZ issues
    d.setDate(d.getDate() + 1);
    return getDateKey(d);
}
