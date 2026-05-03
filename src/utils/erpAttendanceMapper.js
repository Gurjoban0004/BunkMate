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
 * Calculate similarity between two normalized strings.
 * Uses word overlap (Jaccard) + longest-common-word-sequence boost.
 */
function similarity(a, b) {
    const wordsA = new Set(normalize(a).split(' ').filter(Boolean));
    const wordsB = new Set(normalize(b).split(' ').filter(Boolean));

    if (wordsA.size === 0 || wordsB.size === 0) return 0;

    const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
    const union = new Set([...wordsA, ...wordsB]).size;
    const jaccard = intersection / union;

    // Boost: if one name contains all words of the other (substring match)
    const smaller = wordsA.size <= wordsB.size ? wordsA : wordsB;
    const larger  = wordsA.size <= wordsB.size ? wordsB : wordsA;
    const containsAll = [...smaller].every(w => larger.has(w));
    if (containsAll && smaller.size >= 2) return Math.max(jaccard, 0.6);

    return jaccard;
}

/**
 * Generate a unique ID for new subjects
 */
function generateId() {
    return 'erp-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 8);
}

/**
 * Find the best matching app subject for an ERP subject.
 * Priority order:
 *   1. erpSubjectId (numeric portal ID) exact match
 *   2. subject code (e.g. "24CSE0212") exact match
 *   3. Fuzzy name similarity >= threshold
 *
 * @param {Object} erpSub - { name, code, erpSubjectId, ... }
 * @param {Array}  existingSubjects - app subjects
 * @param {Set}    matchedIds - already-matched subject IDs (excluded)
 * @param {number} threshold - minimum similarity score
 * @returns {{ match: Object|null, score: number }}
 */
function findBestMatch(erpSub, existingSubjects, matchedIds, threshold = 0.35) {
    // 1. Numeric portal ID match (most stable — set after first sync)
    if (erpSub.erpSubjectId) {
        const byPortalId = existingSubjects.find(
            s => !matchedIds.has(s.id) && s.erpSubjectId && String(s.erpSubjectId) === String(erpSub.erpSubjectId)
        );
        if (byPortalId) return { match: byPortalId, score: 1 };
    }

    // 2. Subject code match (e.g. "24CSE0212")
    if (erpSub.code) {
        const byCode = existingSubjects.find(
            s => !matchedIds.has(s.id) && (
                (s.code && String(s.code) === String(erpSub.code)) ||
                (s.erpSubjectId && String(s.erpSubjectId) === String(erpSub.code))
            )
        );
        if (byCode) return { match: byCode, score: 1 };
    }

    // 3. Fuzzy name similarity
    let bestMatch = null;
    let bestScore = 0;
    for (const existingSub of existingSubjects) {
        if (matchedIds.has(existingSub.id)) continue;
        const score = similarity(erpSub.name, existingSub.name);
        if (score > bestScore && score >= threshold) {
            bestScore = score;
            bestMatch = existingSub;
        }
    }
    return { match: bestMatch, score: bestScore };
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
    const matchedUpdates = [];
    const newSubjects = [];
    const unmatchedErp = [];

    const matchedExistingIds = new Set();

    const usedColors = new Set(existingSubjects.map(s => s.color));
    const availableColors = (COLORS.subjectPalette || []).filter(c => !usedColors.has(c));
    let colorIndex = 0;

    for (const erpSub of erpSubjects) {
        const { match: bestMatch, score: bestScore } = findBestMatch(erpSub, existingSubjects, matchedExistingIds);

        if (bestMatch) {
            matchedExistingIds.add(bestMatch.id);
            matchedUpdates.push({
                subjectId:    bestMatch.id,
                subjectName:  bestMatch.name,
                erpName:      erpSub.name,
                // Persist the numeric portal ID for stable future matching
                erpSubjectId: erpSub.erpSubjectId || erpSub.code || null,
                newAttended:  erpSub.attended,
                newTotal:     erpSub.delivered,
                oldAttended:  (bestMatch.initialAttended || 0),
                oldTotal:     (bestMatch.initialTotal || 0),
                percentage:   erpSub.percentage,
                matchScore:   bestScore,
            });
        } else {
            const color = availableColors[colorIndex % availableColors.length]
                || (COLORS.subjectPalette || ['#85C1E9'])[colorIndex % (COLORS.subjectPalette?.length || 1)];
            colorIndex++;

            const newSubject = {
                id: generateId(),
                name: erpSub.name,
                code: erpSub.code || '',
                teacher: erpSub.teacher || '',
                color,
                initialAttended: erpSub.attended,
                initialTotal: erpSub.delivered,
                target: 75,
                erpSubjectId: erpSub.erpSubjectId || erpSub.code || null,
                source: 'erp',
                lastUpdated: new Date().toISOString(),
            };

            newSubjects.push(newSubject);
            unmatchedErp.push({ ...erpSub, assignedId: newSubject.id });
        }
    }

    return { matchedUpdates, newSubjects, unmatchedErp };
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
 * Build a direct { erpSubjectName → appSubjectId } map after Step 1 (attendance summary).
 * This is passed to mapCalendarToRecords so it can resolve register subject names
 * without re-running fuzzy matching (which fails when names differ between endpoints).
 *
 * Call this after mapErpToAppState + SET_SUBJECTS has run.
 *
 * @param {Array} matchedUpdates - from mapErpToAppState result
 * @param {Array} newSubjects - from mapErpToAppState result
 * @returns {Object} { [erpSubjectName]: appSubjectId }
 */
export function buildErpNameMap(matchedUpdates, newSubjects) {
    const map = {};
    matchedUpdates.forEach(u => { if (u.erpName) map[u.erpName] = u.subjectId; });
    newSubjects.forEach(s => { map[s.name] = s.id; });
    return map;
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
 * @param {Object} [step1NameMap] - Optional { erpSubjectName → appSubjectId } from buildErpNameMap.
 *   When provided, name resolution uses this map first (avoids re-matching mismatches).
 * 
 * @returns {{
 *   records: Object,           // { "2026-01-20": { "appSubjectId": { status, autoMarked } } }
 *   newSubjects: Array,        // Subjects not matched to existing ones
 *   subjectMapping: Object,    // { erpSubjectName: appSubjectId }
 *   totalDays: number,
 *   earliestDate: string,
 * }}
 */
export function mapCalendarToRecords(calendarData, erpSubjects, existingSubjects, step1NameMap = {}) {
    const records = {};
    const subjectMapping = {}; // erpName → appSubjectId
    const newSubjects = [];
    const matchedExistingIds = new Set();

    const usedColors = new Set(existingSubjects.map(s => s.color));
    const availableColors = (COLORS.subjectPalette || []).filter(c => !usedColors.has(c));
    let colorIndex = 0;

    // Step 1: Build subject mapping — erpSubjectName → appSubjectId.
    // Resolution order:
    //   a. step1NameMap (direct map from Step 1 sync — most reliable, no re-matching needed)
    //   b. erpSubjectId numeric match (stable portal ID)
    //   c. subject code match
    //   d. fuzzy name similarity (fallback)
    for (const erpSub of erpSubjects) {
        // (a) Use Step 1 direct map if available — this is the key fix for the calendar empty bug.
        // Step 1 (attendance summary) creates/matches subjects and passes their name→id mapping.
        // The register HTML may use slightly different names than mobilev2, but both reference
        // the same ERP subject, so we try the step1NameMap by erpSubjectId first.
        if (step1NameMap && Object.keys(step1NameMap).length > 0) {
            // Try: match this calendar subject's erpSubjectId to any step1 subject
            let foundViaStep1 = null;
            if (erpSub.erpSubjectId) {
                // Find the step1 app subject that got this erpSubjectId stamped
                for (const [step1Name, appId] of Object.entries(step1NameMap)) {
                    const appSub = existingSubjects.find(s => s.id === appId);
                    if (appSub && (
                        (appSub.erpSubjectId && String(appSub.erpSubjectId) === String(erpSub.erpSubjectId)) ||
                        (appSub.code && String(appSub.code) === String(erpSub.code)) ||
                        step1Name === erpSub.name
                    )) {
                        foundViaStep1 = appId;
                        break;
                    }
                }
            }
            if (!foundViaStep1 && step1NameMap[erpSub.name]) {
                foundViaStep1 = step1NameMap[erpSub.name];
            }
            if (foundViaStep1 && !matchedExistingIds.has(foundViaStep1)) {
                matchedExistingIds.add(foundViaStep1);
                subjectMapping[erpSub.name] = foundViaStep1;
                continue;
            }
        }

        // (b/c/d) Fall back to findBestMatch (erpSubjectId → code → fuzzy name)
        const { match: bestMatch } = findBestMatch(erpSub, existingSubjects, matchedExistingIds);

        if (bestMatch) {
            matchedExistingIds.add(bestMatch.id);
            subjectMapping[erpSub.name] = bestMatch.id;
        } else {
            // No match anywhere — create a new subject so calendar data isn't lost
            const color = availableColors[colorIndex % availableColors.length]
                || (COLORS.subjectPalette || ['#85C1E9'])[colorIndex % (COLORS.subjectPalette?.length || 1)];
            colorIndex++;

            const newSub = {
                id: generateId(),
                name: erpSub.name,
                code: erpSub.code || '',
                teacher: '',
                color,
                initialAttended: erpSub.attended || 0,
                initialTotal: erpSub.total || 0,
                target: 75,
                erpSubjectId: erpSub.erpSubjectId || erpSub.code || null,
                source: 'erp',
                lastUpdated: new Date().toISOString(),
            };

            newSubjects.push(newSub);
            subjectMapping[erpSub.name] = newSub.id;
        }
    }

    // Step 2: Convert calendar data into attendanceRecords format
    let earliestDate = null;
    let latestDate = null;
    const lastSubjectSyncDates = {};
    const erpSubjectIdStamps = {}; // appSubjectId → erpSubjectId

    for (const erpSub of erpSubjects) {
        const appId = subjectMapping[erpSub.name];
        if (appId && erpSub.erpSubjectId) {
            erpSubjectIdStamps[appId] = erpSub.erpSubjectId;
        }
    }

    for (const [dateKey, dayData] of Object.entries(calendarData)) {
        if (!earliestDate || dateKey < earliestDate) earliestDate = dateKey;
        if (!latestDate || dateKey > latestDate) latestDate = dateKey;

        records[dateKey] = {};

        for (const [subjectName, attendanceInfo] of Object.entries(dayData)) {
            const appSubjectId = subjectMapping[subjectName];
            if (!appSubjectId) continue;

            records[dateKey][appSubjectId] = {
                status: attendanceInfo.status, // 'present' or 'absent'
                source: 'erp',
                units: attendanceInfo.units || 1,
            };

            if (!lastSubjectSyncDates[appSubjectId] || dateKey > lastSubjectSyncDates[appSubjectId]) {
                lastSubjectSyncDates[appSubjectId] = dateKey;
            }
        }
    }

    return {
        records,
        newSubjects,
        subjectMapping,
        erpSubjectIdStamps,
        totalDays: Object.keys(records).length,
        earliestDate,
        latestDate,
        lastSubjectSyncDates,
    };
}
