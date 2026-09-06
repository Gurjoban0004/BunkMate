/**
 * Where the native app finds the API.
 *
 * The PWA calls /api/* same-origin, so this only matters for the APK — which
 * bakes a hostname in at build time and cannot be hot-fixed. Three layers, in
 * order of precedence:
 *   1. a runtime override from admin/config.apiBaseUrl (audit H4: lets an
 *      installed APK survive the deployment moving without a re-install)
 *   2. EXPO_PUBLIC_API_BASE_URL, set per EAS profile in eas.json
 *   3. the production alias below
 */

export const DEFAULT_NATIVE_API_BASE = 'https://presence-blue.vercel.app';

let runtimeApiBase = '';

export function normalizeApiBaseUrl(url) {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim().replace(/\/+$/, '');
    return /^https:\/\/[^\s/]+$/.test(trimmed) ? trimmed : '';
}

/** Applied from remote config at startup. Only https origins are accepted. */
export function setRuntimeApiBase(url) {
    runtimeApiBase = normalizeApiBaseUrl(url);
}

export function getApiBaseUrl(platformOS, env = process.env) {
    if (platformOS === 'web') return '';
    return runtimeApiBase || normalizeApiBaseUrl(env.EXPO_PUBLIC_API_BASE_URL) || DEFAULT_NATIVE_API_BASE;
}

export function buildApiUrl(endpoint, platformOS, env = process.env) {
    return `${getApiBaseUrl(platformOS, env)}${endpoint}`;
}
