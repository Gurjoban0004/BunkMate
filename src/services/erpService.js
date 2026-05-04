/**
 * ERP Service — Client-side API layer
 *
 * Talks ONLY to our own /api/* proxy endpoints.
 * The client never communicates directly with ERP APIs.
 *
 * Session refresh flow:
 *   1. Every data call includes both token + persistentToken
 *   2. If server returns { sessionExpired: true, needsOtp: true, authUserId }
 *      → caller must show OTP screen, then call erpRefreshSession()
 *   3. After OTP, new token is saved and the original call is retried automatically
 */

import { Platform } from 'react-native';

const API_TIMEOUT = 20000; // 20 seconds

// Web uses relative paths (same domain as Vercel deployment).
// Native APK must use the absolute production URL.
const API_BASE = Platform.OS === 'web' ? '' : 'https://presence-gurjobanpanjeta.vercel.app';

async function apiCall(endpoint, body) {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
            signal:  controller.signal,
        });

        clearTimeout(timeoutId);
        const data = await response.json();

        if (!response.ok) {
            const error    = new Error(data.message || data.error || `HTTP ${response.status}`);
            error.status   = response.status;
            error.code     = data.error;
            error.data     = data;
            throw error;
        }

        return data;
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            const e = new Error('Request timed out. Please check your internet connection.');
            e.code  = 'TIMEOUT';
            throw e;
        }
        if (err.status) throw err; // already a structured API error
        // True network failure (no response at all)
        const e = new Error(`Could not connect to ${endpoint}. Please check your internet connection.`);
        e.code  = 'NETWORK_ERROR';
        e.cause = err.message;
        throw e;
    }
}

// ─── AUTH ─────────────────────────────────────────────────────────────

export async function erpLogin(username, password) {
    return apiCall('/api/erp-login', { username, password });
}

/**
 * Verify OTP. Pass username + password so server can build the persistent token.
 * Returns { token, persistentToken, studentName, studentPhoto }
 */
export async function erpVerifyOtp(authUserId, otp, username = '', password = '') {
    return apiCall('/api/erp-verify-otp', { authUserId, otp, username, password });
}

// ─── SESSION MANAGEMENT ───────────────────────────────────────────────

/**
 * Check if an encrypted session token exists on app start.
 * Returns:
 *   { valid: true, reason: 'session_available' }              — let sync validate against ERP
 *   { valid: false, reason: 'no_token' | 'invalid_token' }    — show full login
 */
export async function erpCheckSession(token) {
    return apiCall('/api/erp-session', { action: 'check', token });
}

/**
 * Complete session refresh after OTP re-entry.
 * Returns { token, persistentToken, studentName }
 */
export async function erpRefreshSession(persistentToken, authUserId, otp) {
    return apiCall('/api/erp-session', { action: 'refresh', persistentToken, authUserId, otp });
}

// ─── DATA FETCHING ────────────────────────────────────────────────────

/**
 * Fetch attendance summary.
 * Always pass persistentToken so server can auto-initiate re-login on session failure.
 * If response has { sessionExpired: true, needsOtp: true } → caller handles OTP flow.
 */
export async function erpFetchAttendance(token, persistentToken = null) {
    return apiCall('/api/erp-attendance', { token, persistentToken });
}

/**
 * Fetch day-by-day attendance calendar.
 * Same session-refresh behaviour as erpFetchAttendance.
 */
export async function erpFetchCalendar(token, persistentToken = null) {
    return apiCall('/api/erp-calendar', { token, persistentToken });
}

/**
 * Lightweight keep-alive ping — fetches a minimal ERP page to keep the
 * session warm. Called every 10–15 minutes while the app is active.
 * Failures are silently ignored — this is best-effort only.
 */
export async function erpKeepAlive(token, persistentToken = null) {
    try {
        return await apiCall('/api/erp-attendance', { token, persistentToken, keepAlive: true });
    } catch {
        // Silently swallow — keep-alive is non-critical
        return null;
    }
}
