/**
 * POST /api/admin
 * Body: { token, action, payload }
 *
 * Every admin write goes through here. Authorization is the roll number sealed
 * inside the ERP session token (never a client-sent value), checked against
 * ADMIN_ROLL_NUMBERS. Every write is rate limited (audit M1), input-validated,
 * and recorded in admin/auditLog/entries (audit M2) so two admins — or one
 * leaked token — can be reconstructed after the fact.
 *
 * Actions:
 *   updateConfig        — merge whitelisted keys into admin/config
 *   publishAnnouncement — create admin/announcements/items/{id}
 *   deleteAnnouncement  — deactivate one
 *   revokeUser          — write admin/revokedUsers/items/{roll}
 *   unrevokeUser        — delete it
 *   listRevokedUsers    — read the list (clients can no longer read it from Firestore)
 */

const { setCorsHeaders, decodeSessionRollNumber, cleanString, getClientIp } = require('./_session-utils');
const { tooManyAttempts } = require('./_rate-limit');
const { adminDb, isAdminRoll } = require('./_firebase-admin');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');

const IP_POLICY = { max: 60, windowMs: 10 * 60 * 1000 };

const ROLL_RE = /^\d{6,16}$/;
const ANN_ID_RE = /^ann-\d{10,16}$/;
const ANN_TYPES = ['info', 'warning', 'danger'];
const HTTPS_RE = /^https:\/\/[^\s]{1,500}$/;

const ALLOWED_CONFIG = ['maintenanceMode', 'maintenanceMessage', 'minVersion', 'updateUrl', 'apiBaseUrl', 'featureFlags'];
const ALLOWED_FLAGS = ['autoSync', 'calendarSync'];

/** Validate a config patch. Returns { updates } or { error }. */
function validateConfig(payload) {
    const updates = {};
    for (const [key, value] of Object.entries(payload || {})) {
        if (!ALLOWED_CONFIG.includes(key)) return { error: `Unknown config key: ${key}` };
        switch (key) {
            case 'featureFlags': {
                const flags = {};
                for (const [flag, on] of Object.entries(value || {})) {
                    if (!ALLOWED_FLAGS.includes(flag)) return { error: `Unknown feature flag: ${flag}` };
                    flags[flag] = !!on;
                }
                updates.featureFlags = flags;
                break;
            }
            case 'maintenanceMode':
                updates.maintenanceMode = !!value;
                break;
            case 'maintenanceMessage':
                updates.maintenanceMessage = cleanString(value, 500);
                break;
            case 'minVersion': {
                const version = cleanString(value, 16);
                if (!/^\d+\.\d+\.\d+$/.test(version)) return { error: 'minVersion must look like 2.1.0' };
                updates.minVersion = version;
                break;
            }
            case 'updateUrl':
            case 'apiBaseUrl': {
                const url = cleanString(value, 500);
                if (url && !HTTPS_RE.test(url)) return { error: `${key} must be an https:// URL` };
                updates[key] = url.replace(/\/+$/, '');
                break;
            }
            default:
                return { error: `Unknown config key: ${key}` };
        }
    }
    if (Object.keys(updates).length === 0) return { error: 'No config changes supplied' };
    return { updates };
}

/** Append-only audit trail. Never throws — a logging failure must not undo the write. */
async function audit(actor, ip, action, detail) {
    try {
        await adminDb.collection('admin/auditLog/entries').add({
            actor, ip, action, detail, at: FieldValue.serverTimestamp(),
        });
    } catch (err) {
        console.error('[ADMIN-AUDIT] write failed:', err.message);
    }
}

module.exports = async function handler(req, res) {
    setCorsHeaders(res, req);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { token, action, payload } = req.body || {};

    const rollNumber = decodeSessionRollNumber(token);
    if (!rollNumber || !isAdminRoll(rollNumber)) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const ip = getClientIp(req);
    if (await tooManyAttempts(res, 'admin-ip', ip, IP_POLICY)) return;

    const act = cleanString(action, 32);
    if (!act) return res.status(400).json({ error: 'Missing action' });

    try {
        switch (act) {
            case 'updateConfig': {
                const { updates, error } = validateConfig(payload);
                if (error) return res.status(400).json({ error });
                await adminDb.doc('admin/config').set(updates, { merge: true });
                await audit(rollNumber, ip, act, updates);
                return res.json({ success: true, updated: Object.keys(updates) });
            }

            case 'publishAnnouncement': {
                const title = cleanString(payload?.title, 120);
                const message = cleanString(payload?.message, 2000);
                const type = ANN_TYPES.includes(payload?.type) ? payload.type : 'info';
                const expiryHours = Number(payload?.expiryHours);
                if (!title || !message) return res.status(400).json({ error: 'Title and message required' });

                const id = `ann-${Date.now()}`;
                await adminDb.doc(`admin/announcements/items/${id}`).set({
                    title, message, type,
                    active: true,
                    createdAt: FieldValue.serverTimestamp(),
                    expiry: Number.isFinite(expiryHours) && expiryHours > 0 && expiryHours <= 24 * 90
                        ? Timestamp.fromMillis(Date.now() + expiryHours * 3600000)
                        : null,
                });
                await audit(rollNumber, ip, act, { id, title, type });
                return res.json({ success: true, id });
            }

            case 'deleteAnnouncement': {
                const id = cleanString(payload?.id, 32);
                if (!ANN_ID_RE.test(id)) return res.status(400).json({ error: 'Bad announcement id' });
                await adminDb.doc(`admin/announcements/items/${id}`).set({ active: false }, { merge: true });
                await audit(rollNumber, ip, act, { id });
                return res.json({ success: true });
            }

            case 'revokeUser': {
                const target = cleanString(payload?.targetRollNumber, 16);
                const reason = cleanString(payload?.reason, 300) || 'No reason provided';
                if (!ROLL_RE.test(target)) return res.status(400).json({ error: 'targetRollNumber must be a roll number' });
                if (isAdminRoll(target)) return res.status(400).json({ error: 'An admin cannot be revoked' });
                await adminDb.doc(`admin/revokedUsers/items/${target}`).set({
                    revokedAt: FieldValue.serverTimestamp(),
                    revokedBy: rollNumber,
                    reason,
                });
                await audit(rollNumber, ip, act, { target, reason });
                return res.json({ success: true });
            }

            case 'unrevokeUser': {
                const target = cleanString(payload?.targetRollNumber, 16);
                if (!ROLL_RE.test(target)) return res.status(400).json({ error: 'targetRollNumber must be a roll number' });
                await adminDb.doc(`admin/revokedUsers/items/${target}`).delete();
                await audit(rollNumber, ip, act, { target });
                return res.json({ success: true });
            }

            case 'listRevokedUsers': {
                const snap = await adminDb.collection('admin/revokedUsers/items').limit(500).get();
                const users = [];
                snap.forEach(d => {
                    const data = d.data() || {};
                    users.push({
                        rollNumber: d.id,
                        reason: data.reason || '',
                        revokedAt: data.revokedAt?.toMillis ? data.revokedAt.toMillis() : null,
                    });
                });
                return res.json({ success: true, users });
            }

            default:
                return res.status(400).json({ error: `Unknown action: ${act}` });
        }
    } catch (err) {
        console.error('Admin action failed:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports.validateConfig = validateConfig;
