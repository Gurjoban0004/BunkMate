/**
 * Web Push for the installed PWA.
 *
 * Native uses expo-notifications (local schedule). The web/PWA build can't run
 * JS while closed, so the browser subscription plus a small attendance and
 * timetable profile are stored server-side. Three daily cron windows then send
 * class-specific guidance without needing the app open.
 *
 * Requires EXPO_PUBLIC_VAPID_PUBLIC_KEY (the public half of the server's VAPID pair).
 */

import { buildApiUrl } from '../services/apiConfig';
import { auth } from '../config/firebase';
import { ensureAuthenticated } from './firebaseHelpers';
import { getErpToken } from '../storage/erpTokenStorage';
import { logger } from './logger';

const VAPID_PUBLIC_KEY = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;

/**
 * Headers for /api/push-subscribe, which requires proof the caller owns userId.
 * @returns {Promise<Object|null>} null when no Firebase session can be established.
 */
async function pushHeaders(userId) {
    // The sealed ERP session is already the app's proof of identity and works
    // reliably in iOS Home Screen apps where Firebase Auth persistence may not.
    const erpToken = await getErpToken();
    if (erpToken) return { 'Content-Type': 'application/json', Authorization: `Bearer ${erpToken}` };

    // Keep Firebase as a fallback for existing sessions and non-ERP test users.
    if (auth?.currentUser?.uid !== userId) await ensureAuthenticated(userId);
    const idToken = await auth?.currentUser?.getIdToken?.();
    if (!idToken) return null;
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` };
}

export function isWebPushSupported() {
    return (
        typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'Notification' in window &&
        !!VAPID_PUBLIC_KEY
    );
}

export async function isWebPushEnabled() {
    if (!isWebPushSupported() || Notification.permission !== 'granted') return false;
    try {
        const reg = await navigator.serviceWorker.ready;
        return !!reg.pushManager && !!(await reg.pushManager.getSubscription());
    } catch {
        return false;
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
    return output;
}

/**
 * Ask for permission, subscribe, and register the subscription server-side.
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
function notificationProfile(state) {
    return {
        subjects: state.subjects,
        timeSlots: state.timeSlots,
        timetable: state.timetable,
        holidays: state.holidays,
        settings: { dangerThreshold: state.settings?.dangerThreshold },
        timetableMeta: { timesAreInferred: state.timetableMeta?.timesAreInferred === true },
        dataSyncedAt: state.erpSync?.lastGlobalSyncAt || state.settings?.lastErpSync || null,
    };
}

async function saveSubscription(userId, sub, state, sendTest = false) {
    const headers = await pushHeaders(userId);
    if (!headers) return { ok: false, reason: 'unauthenticated' };
    const res = await fetch(buildApiUrl('/api/push-subscribe', 'web'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
            userId,
            subscription: sub.toJSON(),
            enabled: true,
            sendTest,
            ...(state ? { profile: notificationProfile(state) } : {}),
        }),
    });
    return res.ok ? { ok: true } : { ok: false, reason: 'server' };
}

export async function enableWebPush(state) {
    if (!isWebPushSupported()) return { ok: false, reason: 'unsupported' };
    const userId = state?.userId;
    if (!userId) return { ok: false, reason: 'no-user' };

    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return { ok: false, reason: 'denied' };

        const reg = await navigator.serviceWorker.ready;
        if (!reg.pushManager) return { ok: false, reason: 'push-unavailable' };
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
            sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });
        }

        return saveSubscription(userId, sub, state, true);
    } catch (e) {
        logger.warn('⚠️ enableWebPush failed:', e.message);
        return { ok: false, reason: 'error' };
    }
}

/** Refresh the server's notification inputs after attendance/timetable changes. */
export async function syncWebPushProfile(state) {
    if (!state?.userId || !isWebPushSupported() || Notification.permission !== 'granted') return;
    try {
        const reg = await navigator.serviceWorker.ready;
        const sub = reg.pushManager && await reg.pushManager.getSubscription();
        if (sub) await saveSubscription(state.userId, sub, state, false);
    } catch (e) {
        logger.warn('⚠️ syncWebPushProfile failed:', e.message);
    }
}

/** Unsubscribe locally and mark disabled server-side. */
export async function disableWebPush(userId) {
    if (!isWebPushSupported()) return { ok: true };
    try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
            const headers = await pushHeaders(userId);
            // Always unsubscribe locally, even if the server call can't be authenticated —
            // the user asked for notifications off, so the local half must not depend on it.
            if (headers) {
                await fetch(buildApiUrl('/api/push-subscribe', 'web'), {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ userId, subscription: sub.toJSON(), enabled: false }),
                }).catch(() => {});
            }
            await sub.unsubscribe();
        }
        return { ok: true };
    } catch (e) {
        logger.warn('⚠️ disableWebPush failed:', e.message);
        return { ok: false };
    }
}
