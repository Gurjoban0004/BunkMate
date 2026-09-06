/**
 * Vercel Serverless Function: research dataset side-writes
 *
 * POST /api/research
 *   { researchId, action: 'reason', d, s, p, r }  → append one skip reason
 *   { researchId, action: 'withdraw' }            → delete the student's document
 *
 * Marks and timetable are written by the sync endpoints themselves (api/_research.js).
 * This handles only the two things a sync can't carry.
 *
 * The researchId is the only credential, which is the point: it is an unguessable
 * random UUID that maps to no person. Knowing it grants nothing but the ability to
 * add to or delete an anonymous row.
 */

const { FieldValue } = require('firebase-admin/firestore');
const { setCorsHeaders } = require('./_session-utils');
const { researchDoc, RESEARCH_ID } = require('./_research');

const REASONS = ['slept_in', 'sick', 'travel', 'chose_to_skip', 'clash', 'not_held', 'other'];

module.exports = async function handler(req, res) {
    try {
        setCorsHeaders(res);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

    const { researchId, action, d, s, p, r } = req.body || {};
    if (!RESEARCH_ID.test(researchId || '')) return res.status(400).json({ error: 'Bad researchId' });

    try {
        if (action === 'withdraw') {
            await researchDoc(researchId).delete();
            return res.status(200).json({ success: true });
        }

        if (action === 'reason') {
            if (!REASONS.includes(r))            return res.status(400).json({ error: 'Unknown reason' });
            if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) return res.status(400).json({ error: 'Bad date' });
            if (!s) return res.status(400).json({ error: 'Bad class' });

            // arrayUnion is idempotent on identical entries, so a double-tap adds nothing.
            // `p` is optional: the app tracks absences per (date, subject), and a
            // two-period class is one skip decision, not two. The dataset joins on (d, s).
            await researchDoc(researchId).set(
                { reasons: FieldValue.arrayUnion({ d, s, r, ...(Number.isInteger(p) && { p }) }) },
                { merge: true },
            );
            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ error: 'Unknown action' });
    } catch (err) {
        console.error('research action failed:', err.message);
        return res.status(500).json({ error: 'Write failed' });
    }
};

module.exports.REASONS = REASONS;
