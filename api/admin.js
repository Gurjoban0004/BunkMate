/**
 * Vercel Serverless Function: Admin Write Operations
 *
 * POST /api/admin
 * Body: { rollNumber, action, payload }
 *
 * All admin write operations are routed through this endpoint.
 * Server-side validation ensures only whitelisted roll numbers can write.
 *
 * Actions:
 *   updateConfig      — merge updates into admin/config
 *   publishAnnouncement — create announcement in admin/announcements/items
 *   deleteAnnouncement  — deactivate an announcement
 *   revokeUser         — add user to admin/revokedUsers/items
 *   unrevokeUser       — remove user from revoked list
 *   resolveDowntime    — mark a downtime event resolved
 */

const { setCorsHeaders } = require('./_session-utils');
const { adminDb, isAdminRoll } = require('./_firebase-admin');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');

module.exports = async function handler(req, res) {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { rollNumber, action, payload } = req.body || {};

    if (!rollNumber || !isAdminRoll(rollNumber)) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!action) {
        return res.status(400).json({ error: 'Missing action' });
    }

    try {
        switch (action) {
            case 'updateConfig': {
                const configRef = adminDb.doc('admin/config');
                await configRef.set(payload || {}, { merge: true });
                return res.json({ success: true });
            }

            case 'publishAnnouncement': {
                const { title, message, type, expiryHours } = payload || {};
                if (!title || !message) {
                    return res.status(400).json({ error: 'Title and message required' });
                }
                const id = `ann-${Date.now()}`;
                const data = {
                    title,
                    message,
                    type: type || 'info',
                    active: true,
                    createdAt: FieldValue.serverTimestamp(),
                    expiry: expiryHours
                        ? Timestamp.fromMillis(Date.now() + expiryHours * 3600000)
                        : null,
                };
                await adminDb.doc(`admin/announcements/items/${id}`).set(data);
                return res.json({ success: true, id });
            }

            case 'deleteAnnouncement': {
                const { id } = payload || {};
                if (!id) return res.status(400).json({ error: 'Missing announcement id' });
                await adminDb.doc(`admin/announcements/items/${id}`).set(
                    { active: false },
                    { merge: true }
                );
                return res.json({ success: true });
            }

            case 'revokeUser': {
                const { targetRollNumber, reason } = payload || {};
                if (!targetRollNumber) return res.status(400).json({ error: 'Missing targetRollNumber' });
                if (isAdminRoll(targetRollNumber)) {
                    return res.status(400).json({ error: 'Cannot revoke admin' });
                }
                await adminDb.doc(`admin/revokedUsers/items/${targetRollNumber}`).set({
                    revokedAt: FieldValue.serverTimestamp(),
                    reason: reason || 'No reason provided',
                });
                return res.json({ success: true });
            }

            case 'unrevokeUser': {
                const { targetRollNumber: rn } = payload || {};
                if (!rn) return res.status(400).json({ error: 'Missing targetRollNumber' });
                await adminDb.doc(`admin/revokedUsers/items/${rn}`).delete();
                return res.json({ success: true });
            }

            case 'resolveDowntime': {
                const { eventId } = payload || {};
                if (!eventId) return res.status(400).json({ error: 'Missing eventId' });
                await adminDb.doc(`admin/downtime/events/${eventId}`).set(
                    { resolvedAt: FieldValue.serverTimestamp() },
                    { merge: true }
                );
                return res.json({ success: true });
            }

            default:
                return res.status(400).json({ error: `Unknown action: ${action}` });
        }
    } catch (err) {
        console.error('Admin action failed:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
