export function getTodayKey(devDate = null) {
    const today = devDate ? new Date(devDate) : new Date();
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

export function getTodayDayName(devDate = null) {
    const days = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
    ];
    const now = devDate ? new Date(devDate) : new Date();
    return days[now.getDay()];
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
 * Converts integer minutes since midnight to "HH:MM" 24h string.
 * e.g., 545 -> "09:05"
 */
export function formatMinutesToTime(totalMins) {
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Parses "HH:MM" 24h string into total minutes since midnight.
 * e.g., "09:05" -> 545
 */
export function parseTimeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':');
    return parseInt(h, 10) * 60 + parseInt(m, 10);
}

/**
 * Returns the date key for the day after the given date key.
 */
export function getNextDay(dateKey) {
    const d = new Date(dateKey + 'T12:00:00'); // Use noon to avoid TZ issues
    d.setDate(d.getDate() + 1);
    return getDateKey(d);
}

/**
 * Parses "YYYY-MM-DD" into a local Date object safely at noon.
 */
export function parseDate(dateString) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
}

/**
 * Subtracts a number of days from a given Date object and returns a new Date.
 * Uses noon to avoid DST transition issues.
 */
export function subtractDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() - days);
    result.setHours(12, 0, 0, 0);
    return result;
}

/**
 * Checks if a specific "YYYY-MM-DD" + "HH:MM" has passed relative to 'now' (or devDate).
 * @param {string} date "YYYY-MM-DD"
 * @param {string} time "HH:MM"
 * @param {string|null} devDate ISO string overrides 'now' if present
 * @returns {boolean}
 */
export function isPastTime(date, time, devDate = null) {
    const now = devDate ? new Date(devDate) : new Date();
    const targetDate = parseDate(date); // Gets date at noon
    const [hours, minutes] = time.split(':').map(Number);

    // Set exact target time
    targetDate.setHours(hours, minutes, 0, 0);

    return now >= targetDate;
}
