/**
 * Research dataset writes (AI/ML class project — see attendance-insights/PLAN.md).
 *
 * One document per consenting student at research/students/items/{researchId}:
 *   { v, consentedAt, lastSyncAt, group, marks[], slots[], subjects[], reasons[] }
 *
 * `researchId` is a random UUID minted on the student's device at consent. Nothing
 * that identifies a person is written here — no name, roll number or login code —
 * so there is nothing to strip later.
 *
 * Fire-and-forget in both directions: a failed research write must never fail or
 * slow a sync, and the sync never waits on it.
 */

const { adminDb } = require('./_firebase-admin');

const RESEARCH_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function researchDoc(researchId) {
    return adminDb.collection('research').doc('students').collection('items').doc(researchId);
}

/**
 * Merge a patch into the student's research document. Returns immediately;
 * the write settles in the background.
 * @param {string|undefined} researchId  UUID from the request body, or absent if not consented
 * @param {Object} patch                 fields to merge
 * @param {string} [consentedAt]         ISO timestamp the device recorded at consent
 */
function saveResearch(researchId, patch, consentedAt) {
    if (!researchId || !RESEARCH_ID.test(researchId)) return;

    researchDoc(researchId)
        .set({
            v: 1,
            lastSyncAt: new Date().toISOString(),
            ...(consentedAt && { consentedAt }),
            ...patch,
        }, { merge: true })
        .catch(err => console.error('research write failed:', err.message));
}

module.exports = { saveResearch, researchDoc, RESEARCH_ID };
