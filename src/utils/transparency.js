/**
 * Utility to calculate the breakdown of attendance projections.
 * Separates the ERP baseline from the local changes (Autopilot + Manual).
 */

import { shouldCountLocalRecord, recordUnits, recordAttendedUnits } from './attendance';

export function calculateProjectionBreakdown(state, subjectId = null) {
    let erpAttended = 0;
    let erpTotal = 0;
    let localAttended = 0;
    let localMissed = 0;
    let localCancelled = 0;

    const subjectsToProcess = subjectId
        ? state.subjects.filter(s => s.id === subjectId)
        : state.subjects;

    subjectsToProcess.forEach(subject => {
        // ERP baseline is stored directly on the subject object
        erpAttended += (subject.initialAttended || 0);
        erpTotal += (subject.initialTotal || 0);

        // Local changes (since last ERP sync)
        const records = state.attendanceRecords || {};
        const holidays = state.holidays || [];

        Object.entries(records).forEach(([dateKey, dayRecord]) => {
            if (dayRecord._holiday) return;
            if (holidays.includes(dateKey)) return;

            const record = dayRecord[subject.id];
            if (shouldCountLocalRecord(dateKey, subject.id, record, state)) {
                if (record.status === 'cancelled') {
                    localCancelled += 1;
                } else {
                    const units = recordUnits(record);
                    const attended = recordAttendedUnits(record);
                    localAttended += attended;
                    localMissed += units - attended;
                }
            }
        });
    });

    const localTotal = localAttended + localMissed;
    const projectedAttended = erpAttended + localAttended;
    const projectedTotal = erpTotal + localTotal;

    const erpPercentage = erpTotal > 0 ? (erpAttended / erpTotal) * 100 : 0;
    const projectedPercentage = projectedTotal > 0 ? (projectedAttended / projectedTotal) * 100 : 0;

    return {
        erp: { 
            attended: erpAttended, 
            total: erpTotal, 
            percentage: parseFloat(erpPercentage.toFixed(1)) 
        },
        local: { 
            attended: localAttended, 
            missed: localMissed, 
            cancelled: localCancelled,
            total: localTotal 
        },
        projected: { 
            attended: projectedAttended, 
            total: projectedTotal, 
            percentage: parseFloat(projectedPercentage.toFixed(1)) 
        },
    };
}
