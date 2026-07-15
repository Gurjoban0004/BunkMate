/**
 * Web Push for the installed PWA.
 *
 * Native uses expo-notifications (local schedule). The web/PWA build can't run JS
 * while closed, so a daily reminder must be server-pushed: the browser subscribes,
 * the subscription is stored server-side, and a cron (api/push-send) delivers at the
 * user's reminder hour. The service worker (public/sw.js) shows the notification.
 *
 * Requires EXPO_PUBLIC_VAPID_PUBLIC_KEY (the public half of the server's VAPID pair).
 */

import { buildApiUrl } from '../services/apiConfig';
import { logger } from './logger';

const VAPID_PUBLIC_KEY = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;

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
export async function enableWebPush(userId, reminderTime = '18:00') {
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

        const res = await fetch(buildApiUrl('/api/push-subscribe', 'web'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, subscription: sub.toJSON(), reminderTime, enabled: true }),
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
            await fetch(buildApiUrl('/api/push-subscribe', 'web'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, subscription: sub.toJSON(), enabled: false }),
            }).catch(() => {});
            await sub.unsubscribe();
        }
        return { ok: true };
    } catch (e) {
        logger.warn('⚠️ disableWebPush failed:', e.message);
        return { ok: false };
    }
}

/** Keep the server's stored reminder time in sync when the user changes it. */
export async function updateWebPushTime(userId, reminderTime) {
    if (!isWebPushSupported() || Notification.permission !== 'granted') return;
    try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!sub) return;
        await fetch(buildApiUrl('/api/push-subscribe', 'web'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, subscription: sub.toJSON(), reminderTime, enabled: true }),
        }).catch(() => {});
    } catch (e) { /* best-effort */ }
}
