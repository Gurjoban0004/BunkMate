/**
 * ERP Attendance Mapper
 * 
 * Transforms the clean JSON from our ERP proxy into 
 * Presence app state format. Handles:
 * - Matching ERP subjects to existing app subjects (fuzzy match)
 * - Creating new subjects for unmatched ones
 * - Building RESYNC_ATTENDANCE payloads
 */

import { COLORS } from '../theme/theme';

/**
 * Normalize subject name for fuzzy matching
 * "Data Structures & Algorithms" → "data structures algorithms"
 */
function normalize(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')  // Remove special chars
        .replace(/\s+/g, ' ')          // Collapse whitespace
        .trim();
}

/**
 * Calculate similarity between two normalized strings
 * Uses word overlap (Jaccard similarity)
 */
function similarity(a, b) {
    const wordsA = new Set(normalize(a).split(' '));
    const wordsB = new Set(normalize(b).split(' '));

    if (wordsA.size === 0 || wordsB.size === 0) return 0;

    const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
    const union = new Set([...wordsA, ...wordsB]).size;

    return intersection / union;
}

/**
 * Generate a unique ID for new subjects
 */
function generateId() {
    return 'erp-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 8);
}

/**
 * Map ERP subjects to existing app subjects and prepare sync payloads
 * 
 * @param {Array} erpSubjects - Parsed subjects from ERP
 *   [{ name, code, teacher, delivered, attended, absent, percentage }]
 * @param {Array} existingSubjects - Current subjects from app state
 *   [{ id, name, teacher, color, initialAttended, initialTotal, target }]
 * 
 * @returns {{
 *   matchedUpdates: Array<{ subjectId, subjectName, newAttended, newTotal, oldAttended, oldTotal }>,
 *   newSubjects: Array<{ id, name, teacher, color, initialAttended, initialTotal, target }>,
 *   unmatchedErp: Array<{ name, code, teacher, delivered, attended }>,
 * }}
 */
export function mapErpToAppState(erpSubjects, existingSubjects) {
    const MATCH_THRESHOLD = 0.4; // Minimum similarity to consider a match

    const matchedUpdates = [];
    const newSubjects = [];
    const unmatchedErp = [];

    // Track which existing subjects have been matched
    const matchedExistingIds = new Set();

    // Get available colors (ones not already used)
    const usedColors = new Set(existingSubjects.map(s => s.color));
    const availableColors = (COLORS.subjectPalette || []).filter(c => !usedColors.has(c));
    let colorIndex = 0;

    for (const erpSub of erpSubjects) {
        // CR-11 fix: try matching by erpSubjectId first (set on subjects created by previous syncs)
        // This prevents duplicate subjects when ERP name has minor formatting differences
        let bestMatch = existingSubjects.find(
            s => !matchedExistingIds.has(s.id) && s.erpSubjectId && s.erpSubjectId === erpSub.code
        ) || null;
        let bestScore = bestMatch ? 1 : 0;

        // Fall back to name similarity if no ID match
        if (!bestMatch) {
            for (const existingSub of existingSubjects) {
                if (matchedExistingIds.has(existingSub.id)) continue;

                const score = similarity(erpSub.name, existingSub.name);
                if (score > bestScore && score >= MATCH_THRESHOLD) {
                    bestScore = score;
                    bestMatch = existingSub;
                }
            }
        }

        if (bestMatch) {
            // Matched! — prepare RESYNC update
            // Stamp erpSubjectId on the match so future syncs use code-based identity
            matchedExistingIds.add(bestMatch.id);
            matchedUpdates.push({
                subjectId:    bestMatch.id,
                subjectName:  bestMatch.name,
                erpName:      erpSub.name,
                erpSubjectId: erpSub.code || null, // carry code so reducer can persist it
                newAttended:  erpSub.attended,
                newTotal:     erpSub.delivered,
                oldAttended:  (bestMatch.initialAttended || 0),
                oldTotal:     (bestMatch.initialTotal || 0),
                percentage:   erpSub.percentage,
                matchScore:   bestScore,
            });
        } else {
            // No match — create new subject
            const color = availableColors[colorIndex % availableColors.length]
                || (COLORS.subjectPalette || ['#85C1E9'])[colorIndex % (COLORS.subjectPalette?.length || 1)];
            colorIndex++;

            const newSubject = {
                id: generateId(),
                name: erpSub.name,
                teacher: erpSub.teacher || '',
                color,
                initialAttended: erpSub.attended,
                initialTotal: erpSub.delivered,
                target: 75,
                erpSubjectId: erpSub.code || null,
                source: 'erp',
                lastUpdated: new Date().toISOString(),
            };

            newSubjects.push(newSubject);
            unmatchedErp.push({
                ...erpSub,
                assignedId: newSubject.id,
            });
        }
    }

    return {
        matchedUpdates,
        newSubjects,
        unmatchedErp,
    };
}

/**
 * Build the ERP_OVERWRITE_ATTENDANCE dispatch payload from matched updates
 * 
 * @param {Array} matchedUpdates - From mapErpToAppState (pre-filtered by change detection)
 * @returns {{ updates: Array<{ subjectId, newAttended, newTotal, source, lastUpdated }> }}
 */
export function buildResyncPayload(matchedUpdates) {
    const now = new Date().toISOString();
    return {
        updates: matchedUpdates.map(u => ({
            subjectId:    u.subjectId,
            newAttended:  u.newAttended,
            newTotal:     u.newTotal,
            erpSubjectId: u.erpSubjectId || null, // persist stable code for future syncs
            source:       'erp',
            lastUpdated:  now,
        })),
    };
}

/**
 * Validate a single ERP subject before applying it.
 * Returns false if the subject is malformed or has nonsensical values.
 *
 * @param {Object} sub - ERP subject { name, delivered, attended, percentage }
 * @returns {boolean}
 */
export function validateErpSubject(sub) {
    if (!sub || typeof sub !== 'object') return false;
    if (!sub.name || typeof sub.name !== 'string' || !sub.name.trim()) return false;
    if (typeof sub.delivered !== 'number' || sub.delivered < 0) return false;
    if (typeof sub.attended  !== 'number' || sub.attended  < 0) return false;
    if (sub.attended > sub.delivered) return false; // attended can't exceed delivered
    return true;
}

/**
 * Map ERP calendar data into Presence attendanceRecords format.
 * 
 * @param {Object} calendarData - From erp-calendar endpoint
 *   { "2026-01-20": { "Subject Name": { status: "present"|"absent", code, erpSubjectId } } }
 * @param {Array} erpSubjects - Subjects list from erp-calendar endpoint
 *   [{ erpSubjectId, name, code, attended, total, percentage }]
 * @param {Array} existingSubjects - Current subjects from app state
 *   [{ id, name, teacher, color, initialAttended, initialTotal, target }]
 * 
 * @returns {{
 *   records: Object,           // { "2026-01-20": { "appSubjectId": { status, autoMarked } } }
 *   newSubjects: Array,        // Subjects not matched to existing ones
 *   subjectMapping: Object,    // { erpSubjectName: appSubjectId }
 *   totalDays: number,
 *   earliestDate: string,
 * }}
 */
export function mapCalendarToRecords(calendarData, erpSubjects, existingSubjects) {
    const MATCH_THRESHOLD = 0.4;
    const records = {};
    const subjectMapping = {}; // erpName → appSubjectId
    const newSubjects = [];
    const matchedExistingIds = new Set();

    // Get available colors
    const usedColors = new Set(existingSubjects.map(s => s.color));
    // CR-07 fix: COLORS is already imported at the top of the file — removed duplicate require()
    const availableColors = (COLORS.subjectPalette || []).filter(c => !usedColors.has(c));
    let colorIndex = 0;

    // Step 1: Build mapping from ERP subject names → app subject IDs
    for (const erpSub of erpSubjects) {
        // Try erpSubjectId (code) match first — stable identity, no fuzzy needed
        let bestMatch = existingSubjects.find(
            s => !matchedExistingIds.has(s.id) && s.erpSubjectId && s.erpSubjectId === erpSub.code
        ) || null;
        let bestScore = bestMatch ? 1 : 0;

        // Fall back to name similarity if no code match
        if (!bestMatch) {
            for (const existingSub of existingSubjects) {
                if (matchedExistingIds.has(existingSub.id)) continue;
                const score = similarity(erpSub.name, existingSub.name);
                if (score > bestScore && score >= MATCH_THRESHOLD) {
                    bestScore = score;
                    bestMatch = existingSub;
                }
            }
        }

        if (bestMatch) {
            matchedExistingIds.add(bestMatch.id);
            subjectMapping[erpSub.name] = bestMatch.id;
        } else {
            // Create a new subject
            const color = availableColors[colorIndex % availableColors.length]
                || (COLORS.subjectPalette || ['#85C1E9'])[colorIndex % (COLORS.subjectPalette?.length || 1)];
            colorIndex++;

            const newSub = {
                id: generateId(),
                name: erpSub.name,
                teacher: '',
                color,
                initialAttended: erpSub.attended || 0,
                initialTotal: erpSub.total || 0,
                target: 75,
                source: 'erp',
                lastUpdated: new Date().toISOString(),
            };

            newSubjects.push(newSub);
            subjectMapping[erpSub.name] = newSub.id;
        }
    }

    // Step 2: Convert calendar data into attendanceRecords format
    let earliestDate = null;

    for (const [dateKey, dayData] of Object.entries(calendarData)) {
        if (!earliestDate || dateKey < earliestDate) {
            earliestDate = dateKey;
        }

        records[dateKey] = {};

        for (const [subjectName, attendanceInfo] of Object.entries(dayData)) {
            const appSubjectId = subjectMapping[subjectName];
            if (!appSubjectId) continue; // shouldn't happen but safety check

            records[dateKey][appSubjectId] = {
                status: attendanceInfo.status, // 'present' or 'absent'
                source: 'erp', // Explicitly label as synced from ERP
            };
        }
    }

    return {
        records,
        newSubjects,
        subjectMapping,
        totalDays: Object.keys(records).length,
        earliestDate,
    };
}
