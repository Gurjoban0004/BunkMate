/**
 * Usage pings — what the admin panel's "who opened the app today, when, for
 * how long, and what did they use" is built from (api/_activity.js recordPing).
 *
 * In the foreground the app pings on opening, every two minutes, and again on
 * going to the background, carrying the screens viewed since the last ping.
 * The server turns the pings into sessions. Fire-and-forget: a lost ping costs
 * a statistic, never a feature.
 */

import { AppState } from 'react-native';
import { getErpToken } from '../storage/erpTokenStorage';
import { erpPing } from './erpService';

const PING_INTERVAL_MS = 2 * 60 * 1000;

let pending = {};
let lastScreen = null;
let timer = null;
let subscription = null;

/** Count a screen view. Consecutive repeats (a params change) are one view. */
export function trackScreen(name) {
    if (!name || name === lastScreen) return;
    lastScreen = name;
    pending[name] = (pending[name] || 0) + 1;
}

async function ping() {
    const screens = pending;
    pending = {};
    try {
        const token = await getErpToken();
        if (!token) return;   // no college session, no identity to count against
        const { ok } = await erpPing(token, screens);
        if (!ok) throw new Error('not recorded');
    } catch {
        // Offline, or inside the server's repeat floor: send them next time.
        Object.entries(screens).forEach(([k, n]) => { pending[k] = (pending[k] || 0) + n; });
    }
}

function foreground() {
    clearInterval(timer);
    timer = setInterval(ping, PING_INTERVAL_MS);
    ping();
}

/** Start pinging while the app is in the foreground. Returns the stop function. */
export function startUsagePings() {
    if (!subscription) {
        subscription = AppState.addEventListener('change', (next) => {
            if (next === 'active') foreground();
            else if (next === 'background') { clearInterval(timer); timer = null; ping(); }
        });
        if (AppState.currentState !== 'background') foreground();
    }
    return stopUsagePings;
}

export function stopUsagePings() {
    subscription?.remove();
    subscription = null;
    clearInterval(timer);
    timer = null;
}
