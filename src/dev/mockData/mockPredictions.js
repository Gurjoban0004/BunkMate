/**
 * Generate Future Predictions
 */

import { addDays, format, startOfDay } from 'date-fns';

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Predict future attendance based on current trend
 */
export function generatePredictions({
    subject,
    timetable,
    weeksAhead = 8,
    currentDate = new Date(),
    assumedBehavior = 'continue_trend',
}) {
    const permissions = [];
    const { initialAttended: attended, initialTotal: total } = subject;

    let predictedAttended = attended || 0;
    let predictedTotal = total || 0;

    const target = 75; // Default app target

    const endDate = addDays(startOfDay(currentDate), weeksAhead * 7);
    let currentCheckDate = addDays(startOfDay(currentDate), 1);

    while (currentCheckDate <= endDate) {
        const dayName = days[currentCheckDate.getDay()];
        const daySlots = timetable[dayName] || [];
        const matchingSlots = daySlots.filter(s => s.subjectId === subject.id);

        if (matchingSlots.length > 0) {
            // Group units for the day
            const units = matchingSlots.length;
            predictedTotal += units;

            const currentPercentage = predictedTotal > 0 ? (predictedAttended / predictedTotal) * 100 : 0;

            let willAttend = true;
            switch (assumedBehavior) {
                case 'attend_all': willAttend = true; break;
                case 'skip_all': willAttend = false; break;
                case 'maintain_target': willAttend = currentPercentage <= target; break;
                case 'continue_trend':
                default:
                    willAttend = Math.random() < ((attended / (total || 1))); break;
            }

            if (willAttend) predictedAttended += units;

            const predictedPercentage = predictedTotal > 0 ? (predictedAttended / predictedTotal) * 100 : 0;

            permissions.push({
                date: currentCheckDate.toISOString(),
                dateFormatted: format(currentCheckDate, 'MMM dd'),
                dayFormatted: format(currentCheckDate, 'EEE'),
                assumedStatus: willAttend ? 'present' : 'absent',
                predictedAttended,
                predictedTotal,
                predictedPercentage: predictedPercentage.toFixed(1),
                units,
            });
        }
        currentCheckDate = addDays(currentCheckDate, 1);
    }

    return permissions;
}

export function findCriticalDates({
    subject,
    timetable,
    weeksAhead = 12,
    currentDate = new Date(),
}) {
    const predictions = generatePredictions({
        subject,
        timetable,
        weeksAhead,
        currentDate,
        assumedBehavior: 'continue_trend',
    });

    const criticalDates = {
        dropsBelowThreshold: null,
        dropsBelow70: null,
        reaches80: null,
    };

    predictions.forEach(prediction => {
        const pct = parseFloat(prediction.predictedPercentage);

        if (!criticalDates.dropsBelowThreshold && pct < 75) {
            criticalDates.dropsBelowThreshold = prediction;
        }
        if (!criticalDates.dropsBelow70 && pct < 70) {
            criticalDates.dropsBelow70 = prediction;
        }
        if (!criticalDates.reaches80 && pct >= 80) {
            criticalDates.reaches80 = prediction;
        }
    });

    return criticalDates;
}
