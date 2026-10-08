/**
 * POST /api/push-subscribe
 * Headers: Authorization: Bearer <sealed ERP session or Firebase ID token>
 * Body: { userId, subscription, enabled, sendTest?, profile? }
 *
 * Subscriptions live at users/{userId}/push/{endpointHash}. Written with the
 * Admin SDK (bypasses rules), so the caller's ownership of {userId} is proven
 * here by verifying the ID token's uid. The subscription object is validated
 * to the shape web-push needs and nothing else is stored.
 */

const crypto = require('crypto');
const webpush = require('web-push');
const { FieldValue } = require('firebase-admin/firestore');
const { verifyIdToken } = require('./_verify-id-token');
const { setCorsHeaders, decodeSessionRollNumber } = require('./_session-utils');
const { tooManyAttempts } = require('./_rate-limit');
const { adminDb } = require('./_firebase-admin');

// The uid is the roll number. This only keeps it safe to interpolate into a
// document path — ownership is proved below by the ID token's own uid.
const USER_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const USER_POLICY = { max: 20, windowMs: 10 * 60 * 1000 };

function endpointHash(endpoint) {
    return crypto.createHash('sha256').update(String(endpoint)).digest('hex').slice(0, 32);
}

function testPushAllowed(userId) {
    return String(process.env.PUSH_ALLOWED_USER_IDS || '')
        .split(',')
        .map((id) => id.trim())
        .includes(userId);
}

/** Only the fields web-push consumes; rejects anything malformed or oversized. */
function cleanSubscription(sub) {
    if (!sub || typeof sub !== 'object') return null;
    const endpoint = typeof sub.endpoint === 'string' ? sub.endpoint : '';
    const p256dh = typeof sub.keys?.p256dh === 'string' ? sub.keys.p256dh : '';
    const auth = typeof sub.keys?.auth === 'string' ? sub.keys.auth : '';
    if (!/^https:\/\/\S{1,2000}$/.test(endpoint)) return null;
    if (!p256dh || p256dh.length > 256 || !auth || auth.length > 64) return null;
    return { endpoint, keys: { p256dh, auth } };
}

function text(value, max = 100) {
    return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function time(value) {
    const clean = text(value, 5);
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(clean) ? clean : '';
}

/** The small, non-sensitive slice of app state needed to plan notifications. */
function cleanProfile(profile) {
    if (!profile || typeof profile !== 'object') return null;
    const subjects = (Array.isArray(profile.subjects) ? profile.subjects : []).slice(0, 80).map((subject) => ({
        id: text(subject?.id, 80),
        name: text(subject?.name, 120),
        initialAttended: Math.max(0, Number(subject?.initialAttended) || 0),
        initialTotal: Math.max(0, Number(subject?.initialTotal) || 0),
        target: subject?.target == null ? null : Math.min(100, Math.max(1, Number(subject.target) || 75)),
    })).filter((subject) => subject.id && subject.name);
    const subjectIds = new Set(subjects.map((subject) => subject.id));
    const timeSlots = (Array.isArray(profile.timeSlots) ? profile.timeSlots : []).slice(0, 60).map((slot) => ({
        id: text(slot?.id, 80), start: time(slot?.start), end: time(slot?.end),
    })).filter((slot) => slot.id && slot.start && slot.end);
    const slotIds = new Set(timeSlots.map((slot) => slot.id));
    const timetable = {};
    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']) {
        timetable[day] = (Array.isArray(profile.timetable?.[day]) ? profile.timetable[day] : []).slice(0, 100).map((entry) => ({
            slotId: text(entry?.slotId, 80),
            subjectId: text(entry?.subjectId, 80),
            customStart: time(entry?.customStart) || null,
            customEnd: time(entry?.customEnd) || null,
        })).filter((entry) => subjectIds.has(entry.subjectId) && (slotIds.has(entry.slotId) || entry.customStart));
    }
    const threshold = Number(profile.settings?.dangerThreshold);
    return {
        subjects,
        timeSlots,
        timetable,
        holidays: (Array.isArray(profile.holidays) ? profile.holidays : []).slice(0, 180)
            .map((day) => text(day, 10)).filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day)),
        settings: { dangerThreshold: threshold > 0 && threshold <= 100 ? threshold : 75 },
        timetableMeta: { timesAreInferred: profile.timetableMeta?.timesAreInferred === true },
        dataSyncedAt: text(profile.dataSyncedAt, 40) || null,
    };
}

module.exports = async function handler(req, res) {
    setCorsHeaders(res, req);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { userId, subscription, enabled, sendTest, profile } = req.body || {};
    if (!userId || typeof userId !== 'string' || !USER_ID_RE.test(userId)) {
        return res.status(400).json({ error: 'Invalid user' });
    }
    const clean = cleanSubscription(subscription);
    if (!clean) return res.status(400).json({ error: 'Invalid subscription' });

    const bearer = String(req.headers.authorization || '');
    const idToken = bearer.startsWith('Bearer ') ? bearer.slice(7).trim() : '';
    if (!idToken) return res.status(401).json({ error: 'Authentication required' });

    const sessionRoll = decodeSessionRollNumber(idToken);
    if (sessionRoll !== userId) {
        try {
            const decoded = await verifyIdToken(idToken);
            if (decoded.uid !== userId) return res.status(403).json({ error: 'Forbidden' });
        } catch {
            return res.status(401).json({ error: 'Authentication required' });
        }
    }

    if (await tooManyAttempts(res, 'push-subscribe-user', userId, USER_POLICY)) return;
    if (sendTest === true && !testPushAllowed(userId)) {
        return res.status(403).json({ error: 'Test push not allowed for this user' });
    }

    try {
        const ref = adminDb.doc(`users/${userId}/push/${endpointHash(clean.endpoint)}`);
        if (enabled === false) {
            await ref.set({ enabled: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        } else {
            const cleanNotificationProfile = cleanProfile(profile);
            await ref.set({
                subscription: clean,
                enabled: true,
                updatedAt: FieldValue.serverTimestamp(),
                ...(cleanNotificationProfile ? {
                    profile: cleanNotificationProfile,
                    profileUpdatedAt: FieldValue.serverTimestamp(),
                } : {}),
            }, { merge: true });
        }

        if (enabled !== false && sendTest === true) {
            const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
            if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
                return res.status(500).json({ error: 'VAPID keys not configured' });
            }
            webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
            await new Promise((resolve) => setTimeout(resolve, 6000));
            await webpush.sendNotification(clean, JSON.stringify({
                title: '',
                body: 'Notifications are ready. Personalised class guidance will arrive at the right moments.',
                url: '/app',
                tag: 'presence-test',
            }), { TTL: 60 });
        }

        return res.status(200).json({ ok: true, testSent: enabled !== false && sendTest === true });
    } catch (err) {
        console.error('push-subscribe failed:', err.message);
        return res.status(500).json({ error: 'Could not save subscription' });
    }
};
