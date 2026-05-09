export const DEFAULT_NATIVE_API_BASE = 'https://presence-gurjobanpanjeta.vercel.app';

export function normalizeApiBaseUrl(url) {
    if (!url || typeof url !== 'string') return '';
    return url.trim().replace(/\/+$/, '');
}

export function getApiBaseUrl(platformOS, env = process.env) {
    if (platformOS === 'web') return '';
    return normalizeApiBaseUrl(env.EXPO_PUBLIC_API_BASE_URL) || DEFAULT_NATIVE_API_BASE;
}

export function buildApiUrl(endpoint, platformOS, env = process.env) {
    return `${getApiBaseUrl(platformOS, env)}${endpoint}`;
}
