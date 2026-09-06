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
 * The write is awaited, and never throws. Awaiting is not optional: a serverless
 * instance can be frozen or torn down the moment its response is sent, so a
 * promise left running after `res.json()` may simply never finish. That is not
 * theoretical — it is why the first real participant's timetable (30 slots, a
 * fast write) landed while their marks (~1000 entries, a slow one) silently did
 * not. Swallowing errors is what keeps a failed research write from breaking a
 * sync; not waiting for it was never the right way to get that.
 */

const { adminDb } = require('./_firebase-admin');

const RESEARCH_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function researchDoc(researchId) {
    return adminDb.collection('research').doc('students').collection('items').doc(researchId);
}

/**
 * Merge a patch into the student's research document. Awaited by the caller so the
 * write actually completes before the function returns; resolves either way.
 * @param {string|undefined} researchId  UUID from the request body, or absent if not consented
 * @param {Object} patch                 fields to merge
 * @param {string} [consentedAt]         ISO timestamp the device recorded at consent
 * @returns {Promise<void>} never rejects — a research failure must not break a sync
 */
async function saveResearch(researchId, patch, consentedAt) {
    if (!researchId || !RESEARCH_ID.test(researchId)) return;

    try {
        await researchDoc(researchId).set({
            v: 1,
            lastSyncAt: new Date().toISOString(),
            ...(consentedAt && { consentedAt }),
            ...patch,
        }, { merge: true });
    } catch (err) {
        console.error('research write failed:', err.message);
    }
}

module.exports = { saveResearch, researchDoc, RESEARCH_ID };
