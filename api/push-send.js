/**
 * Vercel Cron: personalised, timetable-aware Web Push.
 *
 * Three once-daily jobs call this endpoint with morning, midday or afternoon.
 * Delivery still fails closed behind CRON_SECRET, PUSH_ALLOWED_USER_IDS and
 * PUSH_MAX_TARGETS. A missing class, holiday or inferred timetable sends
 * nothing; uncertain attendance sends neutral guidance rather than a guess.
 */

const crypto = require('crypto');
const webpush = require('web-push');
const { FieldValue } = require('firebase-admin/firestore');
const { adminDb } = require('./_firebase-admin');
const { buildPersonalizedNotification, localDay } = require('./_push-personalization');

const MAX_SUBSCRIPTIONS = 5000;
const VALID_SLOTS = new Set(['morning', 'midday', 'afternoon']);

function allowedRecipients() {
    return new Set(String(process.env.PUSH_ALLOWED_USER_IDS || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean));
}

function maxTargets() {
    const configured = Number(process.env.PUSH_MAX_TARGETS || 1);
    return Number.isInteger(configured) && configured > 0 ? configured : 1;
}

function currentSemesterId(now = new Date()) {
    const local = new Date(now.getTime() + 330 * 60 * 1000);
    const month = local.getUTCMonth() + 1;
    const year = local.getUTCFullYear();
    if (month >= 8) return `fall-${year}`;
    if (month <= 5) return `spring-${year}`;
    return `summer-${year}`;
}

async function profileFor(target, now) {
    if (target.data.profile) {
        return { profile: target.data.profile, updatedAt: target.data.profileUpdatedAt };
    }
    try {
        const snap = await adminDb.doc(`users/${target.userId}/semesters/${currentSemesterId(now)}`).get();
        const profile = snap.exists ? snap.data() : null;
        return { profile, updatedAt: profile?._lastModified || null };
    } catch {
        return { profile: null, updatedAt: null };
    }
}

function authorized(req) {
    const secret = process.env.CRON_SECRET;
    if (!secret) return false;
    const expected = Buffer.from(`Bearer ${secret}`);
    const given = Buffer.from(String(req.headers.authorization || ''));
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

module.exports = async function handler(req, res) {
    if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });
    const slot = String(req.query?.slot || '');
    if (!VALID_SLOTS.has(slot)) return res.status(400).json({ error: 'Invalid notification slot' });

    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
        return res.status(500).json({ error: 'VAPID keys not configured' });
    }
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const allowed = allowedRecipients();
    if (allowed.size === 0) return res.status(503).json({ error: 'No push recipients configured' });
    const dryRun = String(req.query?.dryRun || '') === '1';
    const now = new Date();

    let sent = 0, skipped = 0, pruned = 0, failed = 0;
    try {
        const snap = await adminDb.collectionGroup('push')
            .where('enabled', '==', true)
            .limit(MAX_SUBSCRIPTIONS)
            .get();

        const targets = [];
        snap.forEach((docSnap) => {
            const data = docSnap.data();
            if (!data.subscription) return;
            const userId = docSnap.ref.path.split('/')[1];
            if (!allowed.has('*') && !allowed.has(userId)) return;
            targets.push({ data, docSnap, userId });
        });
        if (targets.length > maxTargets()) {
            return res.status(409).json({
                error: 'Push target limit exceeded',
                matched: targets.length,
                limit: maxTargets(),
            });
        }

        await Promise.all(targets.map(async (target) => {
            try {
                const { profile, updatedAt } = await profileFor(target, now);
                const notification = buildPersonalizedNotification(profile, slot, now, updatedAt);
                if (!notification || target.data.lastSentKey === notification.key) {
                    skipped++;
                    return;
                }
                if (dryRun) return;

                const { key, ...payload } = notification;
                await webpush.sendNotification(target.data.subscription, JSON.stringify(payload), { TTL: 90 * 60 });
                sent++;
                if (target.docSnap.ref.set) {
                    await target.docSnap.ref.set({
                        lastSentKey: key,
                        lastSentAt: FieldValue.serverTimestamp(),
                    }, { merge: true });
                }
            } catch (err) {
                if (!dryRun && (err.statusCode === 404 || err.statusCode === 410)) {
                    pruned++;
                    await target.docSnap.ref.delete().catch(() => {});
                } else {
                    failed++;
                }
            }
        }));

        return res.status(200).json({
            ok: true,
            slot,
            date: localDay(now).dateKey,
            dryRun,
            matched: targets.length,
            sent,
            skipped,
            pruned,
            failed,
        });
    } catch (err) {
        console.error('push-send failed:', err.message);
        return res.status(500).json({ error: 'Send failed' });
    }
};
