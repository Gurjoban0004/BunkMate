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
 */

const { setCorsHeaders, decodeSessionRollNumber } = require('./_session-utils');
const { adminDb, isAdminRoll } = require('./_firebase-admin');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');

module.exports = async function handler(req, res) {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { token, action, payload } = req.body || {};

    // Authorize on the roll number sealed inside the ERP session token, never on a
    // plaintext value from the client — a client-sent roll number is trivially spoofed.
    const rollNumber = decodeSessionRollNumber(token);
    if (!rollNumber || !isAdminRoll(rollNumber)) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!action) {
        return res.status(400).json({ error: 'Missing action' });
    }

    try {
        switch (action) {
            case 'updateConfig': {
                // Whitelist: an unrecognised key would write cleanly and then do
                // nothing, which reads to the admin as a working control.
                const ALLOWED = ['maintenanceMode', 'maintenanceMessage', 'minVersion', 'updateUrl', 'featureFlags'];
                const ALLOWED_FLAGS = ['autoSync', 'calendarSync'];
                const updates = {};

                for (const [key, value] of Object.entries(payload || {})) {
                    if (!ALLOWED.includes(key)) {
                        return res.status(400).json({ error: `Unknown config key: ${key}` });
                    }
                    if (key === 'featureFlags') {
                        const flags = {};
                        for (const [flag, on] of Object.entries(value || {})) {
                            if (!ALLOWED_FLAGS.includes(flag)) {
                                return res.status(400).json({ error: `Unknown feature flag: ${flag}` });
                            }
                            flags[flag] = !!on;
                        }
                        updates.featureFlags = flags;
                    } else if (key === 'maintenanceMode') {
                        updates.maintenanceMode = !!value;
                    } else if (key === 'minVersion') {
                        const version = String(value || '').trim();
                        if (!/^\d+\.\d+\.\d+$/.test(version)) {
                            return res.status(400).json({ error: 'minVersion must look like 2.1.0' });
                        }
                        updates.minVersion = version;
                    } else {
                        updates[key] = String(value ?? '');
                    }
                }

                if (Object.keys(updates).length === 0) {
                    return res.status(400).json({ error: 'No config changes supplied' });
                }
                await adminDb.doc('admin/config').set(updates, { merge: true });
                return res.json({ success: true, updated: Object.keys(updates) });
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
                const cleanTarget = String(targetRollNumber).trim();
                if (cleanTarget === '2410990296' || isAdminRoll(cleanTarget)) {
                    return res.status(400).json({ error: 'Cannot revoke primary super admin (2410990296)' });
                }
                await adminDb.doc(`admin/revokedUsers/items/${cleanTarget}`).set({
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

            default:
                return res.status(400).json({ error: `Unknown action: ${action}` });
        }
    } catch (err) {
        console.error('Admin action failed:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
