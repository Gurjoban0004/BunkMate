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
import { buildApiUrl, getApiBaseUrl } from './apiConfig';
import { updateErpToken } from '../storage/erpTokenStorage';

const API_TIMEOUT = 20000; // 20 seconds

async function apiCall(endpoint, body) {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), API_TIMEOUT);
    const requestUrl = buildApiUrl(endpoint, Platform.OS);

    try {
        const response = await fetch(requestUrl, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
            signal:  controller.signal,
        });

        clearTimeout(timeoutId);
        const responseText = await response.text();
        let data = {};
        try {
            data = responseText ? JSON.parse(responseText) : {};
        } catch {
            data = { error: 'NON_JSON_RESPONSE', message: responseText };
        }

        if (!response.ok) {
            const protectedDeployment = response.status === 401 && /vercel|authentication|sso/i.test(responseText);
            const message = protectedDeployment
                ? `API host is protected and cannot be reached by the app. Disable Vercel Deployment Protection for ${getApiBaseUrl(Platform.OS)} or set EXPO_PUBLIC_API_BASE_URL to a public API deployment.`
                : data.message || data.error || `HTTP ${response.status}`;
            const error    = new Error(message);
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
        const e = new Error(`Could not connect to ${requestUrl}. Please check your internet connection.`);
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
 * Data call wrapper: if the server silently refreshed the session (trusted
 * device, no OTP), the response carries a new `token` — persist it so
 * subsequent calls don't repeat the re-login.
 */
async function dataCall(endpoint, body) {
    const result = await apiCall(endpoint, body);
    if (result?.token) {
        await updateErpToken(result.token); // never throws
    }
    return result;
}

/**
 * Fetch attendance summary.
 * Always pass persistentToken so server can auto-initiate re-login on session failure.
 * If response has { sessionExpired: true, needsOtp: true } → caller handles OTP flow.
 */
export async function erpFetchAttendance(token, persistentToken = null) {
    return dataCall('/api/erp-attendance', { token, persistentToken });
}

/**
 * Fetch day-by-day attendance calendar.
 * Same session-refresh behaviour as erpFetchAttendance.
 */
export async function erpFetchCalendar(token, persistentToken = null) {
    return dataCall('/api/erp-calendar', { token, persistentToken });
}

/**
 * Fetch the weekly timetable from the ERP.
 * Same session-refresh behaviour as erpFetchAttendance.
 * Derived from the attendance register (live, weekly-auto-updating).
 */
export async function erpFetchTimetable(token, persistentToken = null) {
    return dataCall('/api/erp-timetable', { token, persistentToken });
}

/**
 * Lightweight keep-alive ping — fetches a minimal ERP page to keep the
 * session warm. Called every 10–15 minutes while the app is active.
 * Failures are silently ignored — this is best-effort only.
 */
export async function erpKeepAlive(token, persistentToken = null) {
    try {
        return await dataCall('/api/erp-attendance', { token, persistentToken, keepAlive: true });
    } catch {
        // Silently swallow — keep-alive is non-critical
        return null;
    }
}
