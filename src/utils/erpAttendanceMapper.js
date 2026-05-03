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
 * REBUILT FROM SCRATCH — previous versions failed because they tried to match
 * subjects by name strings (which differ between the summary and calendar endpoints).
 *
 * This version uses a SINGLE key: erpSubjectId.
 * The register HTML encodes it in every <td id="subject_{erpSubjectId}_{date}_{period}">.
 * The calendar API returns it on both `erpSubjects[]` and inside `calendarData[date][name]`.
 * App subjects get it stamped during Step 1 (from the subject code, since erp-attendance
 * doesn't return numeric portal IDs) or from a previous calendar sync.
 *
 * Resolution: erpSubjectId → app subject.erpSubjectId OR app subject.code
 * If no match exists, a new subject is created.
 *
 * @param {Object} calendarData - { "2026-01-20": { "Subject Name": { status, code, erpSubjectId, units } } }
 * @param {Array} erpSubjects  - [{ erpSubjectId, name, code, attended, total, percentage }]
 * @param {Array} existingSubjects - current app subjects
 * @param {Object} [step1NameMap] - ignored (kept for API compat)
 */
export function mapCalendarToRecords(calendarData, erpSubjects, existingSubjects, step1NameMap = {}) {
    const records = {};
    const newSubjects = [];
    const subjectMapping = {};   // erpSubjectId → appSubjectId
    const erpSubjectIdStamps = {}; // appSubjectId → erpSubjectId (for stamping)

    const usedColors = new Set(existingSubjects.map(s => s.color));
    const availableColors = (COLORS.subjectPalette || []).filter(c => !usedColors.has(c));
    let colorIndex = 0;

    // ── Build a single lookup: erpSubjectId OR code → app subject ──────
    // App subjects can have erpSubjectId set to either:
    //   - The numeric portal ID (e.g. "10574") from a previous calendar sync
    //   - The subject code (e.g. "24CSE0212") from the first attendance summary sync
    // We index by both so we catch either case.
    const appSubjectByKey = {}; // String key → appSubject
    for (const sub of existingSubjects) {
        if (sub.erpSubjectId) appSubjectByKey[String(sub.erpSubjectId)] = sub;
        if (sub.code)         appSubjectByKey[String(sub.code)] = sub;
    }

    // ── Step 1: Map each calendar-endpoint subject to an app subject ──
    // The calendar endpoint returns erpSubjects[] with { erpSubjectId, name, code }.
    // Match each to an existing app subject by erpSubjectId or code.
    const usedAppIds = new Set();

    for (const erpSub of erpSubjects) {
        const portalId = erpSub.erpSubjectId ? String(erpSub.erpSubjectId) : null;
        const code     = erpSub.code ? String(erpSub.code) : null;

        // Try: numeric portal ID → app subject
        let appSub = portalId ? appSubjectByKey[portalId] : null;

        // Try: subject code → app subject
        if (!appSub && code) appSub = appSubjectByKey[code];

        // Guard: don't double-match the same app subject
        if (appSub && usedAppIds.has(appSub.id)) appSub = null;

        if (appSub) {
            usedAppIds.add(appSub.id);
            subjectMapping[portalId || code] = appSub.id;
            if (erpSub.name) subjectMapping[erpSub.name] = appSub.id;

            // Stamp the numeric portal ID for future syncs
            if (portalId) erpSubjectIdStamps[appSub.id] = portalId;
        } else {
            // No match — create new subject
            const color = availableColors[colorIndex % availableColors.length]
                || (COLORS.subjectPalette || ['#85C1E9'])[colorIndex % (COLORS.subjectPalette?.length || 1)];
            colorIndex++;

            const newSub = {
                id: generateId(),
                name: erpSub.name || `Subject ${erpSub.code || portalId}`,
                code: code || '',
                teacher: '',
                color,
                initialAttended: erpSub.attended || 0,
                initialTotal: erpSub.total || 0,
                target: 75,
                erpSubjectId: portalId || code || null,
                source: 'erp',
                lastUpdated: new Date().toISOString(),
            };

            newSubjects.push(newSub);
            usedAppIds.add(newSub.id);
            if (portalId) subjectMapping[portalId] = newSub.id;
            if (code)     subjectMapping[code] = newSub.id;
            if (erpSub.name) subjectMapping[erpSub.name] = newSub.id;
            if (portalId) erpSubjectIdStamps[newSub.id] = portalId;
        }
    }

    // ── Step 2: Convert calendar data → attendanceRecords ─────────────
    // calendarData format: { "2026-01-20": { "Subject Name": { status, erpSubjectId, code, units } } }
    // We need to produce: { "2026-01-20": { appSubjectId: { status, source, units } } }
    //
    // KEY INSIGHT: each entry in calendarData has its own erpSubjectId field.
    // We match by that ID, NOT by the subject name key.
    let earliestDate = null;
    let latestDate = null;
    const lastSubjectSyncDates = {};

    for (const [dateKey, dayData] of Object.entries(calendarData)) {
        if (!earliestDate || dateKey < earliestDate) earliestDate = dateKey;
        if (!latestDate || dateKey > latestDate) latestDate = dateKey;

        records[dateKey] = {};

        for (const [subjectName, attendanceInfo] of Object.entries(dayData)) {
            // Resolve app subject ID using the erpSubjectId embedded in the entry
            const entryPortalId = attendanceInfo.erpSubjectId ? String(attendanceInfo.erpSubjectId) : null;
            const entryCode     = attendanceInfo.code ? String(attendanceInfo.code) : null;

            let appSubjectId = null;

            // Primary: match by erpSubjectId from the entry itself
            if (entryPortalId && subjectMapping[entryPortalId]) {
                appSubjectId = subjectMapping[entryPortalId];
            }
            // Fallback: match by code
            if (!appSubjectId && entryCode && subjectMapping[entryCode]) {
                appSubjectId = subjectMapping[entryCode];
            }
            // Last resort: match by subject name (from Step 1 name mapping)
            if (!appSubjectId && subjectMapping[subjectName]) {
                appSubjectId = subjectMapping[subjectName];
            }

            if (!appSubjectId) continue; // skip unmatchable entries

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
