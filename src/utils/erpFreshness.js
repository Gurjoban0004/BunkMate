/**
 * ERP Freshness Engine
 *
 * Calculates how "stale" the ERP data is for each subject by comparing
 * the `lastSubjectSyncDates` with the local device date. 
 */

import { getTodayKey, getTodayDayName } from './dateHelpers';
import { getClassesForDay } from './attendance';

/**
 * Calculates the freshness states for today's classes
 * 
 * @param {Object} state - The global AppContext state
 * @param {Array} todayClasses - Output from getTodayClasses()
 * @returns {Object} mapped by subjectId, containing freshness data
 *   {
 *     [subjectId]: {
 *       isStale: boolean,       // True if ERP hasn't synced up to today AND there was a gap
 *       gapDays: number,        // Number of working days missed since last sync
 *       lastSyncDate: string,   // The last date ERP had a record for this class
 *       hasPrediction: boolean, // True if a temporary 'prediction' mark exists for today
 *     }
 *   }
 */
export function calculateFreshness(state, todayClasses) {
    const freshnessMap = {};
    if (!state.settings?.lastSubjectSyncDates || !todayClasses) return freshnessMap;

    const devDate = state.devDate ? new Date(state.devDate) : new Date();
    const todayKey = getTodayKey(state.devDate);
    const todayName = getTodayDayName(state.devDate);

    // Collect all class dates from trackingStart up to today
    // To properly calculate working days, we realistically just check if there's a gap
    // But for a simple V1, a subject is stale if its last sync date < today 
    // AND it has classes today.

    todayClasses.forEach(c => {
        const lastSyncDate = state.settings.lastSubjectSyncDates[c.subjectId] || '2000-01-01';
        const todayRecord = state.attendanceRecords[todayKey]?.[c.subjectId];
        
        let isStale = false;
        let gapDays = 0;

        if (lastSyncDate < todayKey) {
            isStale = true;
            
            // Very simple gap calculation: just 1 if < today, but can be expanded
            // to loop backwards and count scheduled days without ERP sync.
            const lastSyncTime = new Date(lastSyncDate).getTime();
            const todayTime = devDate.getTime();
            gapDays = Math.floor((todayTime - lastSyncTime) / (1000 * 60 * 60 * 24));
        }

        freshnessMap[c.subjectId] = {
            isStale,
            gapDays,
            lastSyncDate,
            hasPrediction: todayRecord?.source === 'prediction',
            isConfirmed: todayRecord?.source === 'erp',
        };
    });

    return freshnessMap;
}
