/**
 * Validate that attended does not exceed total.
 */
export function validateAttendance(attended, total) {
    if (attended < 0 || total < 0) return false;
    if (attended > total) return false;
    return true;
}

/**
 * Validate that a time slot has start before end.
 * Both should be "HH:MM" strings.
 */
export function validateTimeSlot(start, end) {
    if (!start || !end) return false;
    return start < end;
}

/**
 * Validate percentage input is between 0 and 100.
 */
export function validatePercentage(value) {
    const num = Number(value);
    return !isNaN(num) && num >= 0 && num <= 100;
}
