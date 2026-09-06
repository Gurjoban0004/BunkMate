/**
 * Web Push for the installed PWA.
 *
 * Native uses expo-notifications (local schedule). The web/PWA build can't run JS
 * while closed, so the daily reminder is server-pushed: the browser subscribes,
 * the subscription is stored server-side, and the daily cron (api/push-send)
 * delivers it. The service worker (public/sw.js) shows the notification.
 *
 * There is one reminder time for everyone (18:00 IST) — the cron is daily and
 * the app never had a working time picker, so the per-user time was dropped
 * rather than shipped as a control that silently did nothing (audit H2).
 *
 * Requires EXPO_PUBLIC_VAPID_PUBLIC_KEY (the public half of the server's VAPID pair).
 */

import { buildApiUrl } from '../services/apiConfig';
import { auth } from '../config/firebase';
import { ensureAuthenticated } from './firebaseHelpers';
import { logger } from './logger';

const VAPID_PUBLIC_KEY = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;

/**
 * Headers for /api/push-subscribe, which requires proof the caller owns userId.
 * @returns {Promise<Object|null>} null when no Firebase session can be established.
 */
async function pushHeaders(userId) {
    if (auth?.currentUser?.uid !== userId) await ensureAuthenticated(userId);
    const idToken = await auth?.currentUser?.getIdToken?.();
    if (!idToken) return null;
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` };
}

export function isWebPushSupported() {
    return (
        typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window &&
        !!VAPID_PUBLIC_KEY
    );
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
export async function enableWebPush(userId) {
    if (!isWebPushSupported()) return { ok: false, reason: 'unsupported' };
    if (!userId) return { ok: false, reason: 'no-user' };

    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return { ok: false, reason: 'denied' };

        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
            sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });
        }

        const headers = await pushHeaders(userId);
        if (!headers) return { ok: false, reason: 'unauthenticated' };

        const res = await fetch(buildApiUrl('/api/push-subscribe', 'web'), {
            method: 'POST',
            headers,
            body: JSON.stringify({ userId, subscription: sub.toJSON(), enabled: true }),
        });
        if (!res.ok) return { ok: false, reason: 'server' };
        return { ok: true };
    } catch (e) {
        logger.warn('⚠️ enableWebPush failed:', e.message);
        return { ok: false, reason: 'error' };
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
