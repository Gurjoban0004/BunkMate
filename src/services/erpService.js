/**
 * ERP Service — client-side API layer.
 *
 * Talks ONLY to our own /api/* proxy endpoints; the client never communicates
 * with the ERP directly.
 *
 * Session refresh flow:
 *   1. Every data call includes both token + persistentToken.
 *   2. If the server answers { sessionExpired: true, needsOtp: true, authUserId }
 *      → the caller shows the OTP prompt, then calls erpRefreshSession().
 *   3. If it answers { sessionExpired: true, needsLogin: true } the stored
 *      "remember me" has run out → the caller clears the ERP connection.
 *   4. A silently refreshed session comes back as `token`; dataCall persists it.
 */

import { Platform } from 'react-native';
import { buildApiUrl, getApiBaseUrl } from './apiConfig';
import { updateErpToken, getDeviceId } from '../storage/erpTokenStorage';
import { getResearchId, getConsentedAt } from '../storage/researchStorage';

// The functions cap at 30s (vercel.json); the client must outlive the server so a
// slow ERP surfaces as the server's JSON error, not as a client-side abort.
const API_TIMEOUT = 35000;

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
            error.code     = response.status === 429 ? 'RATE_LIMITED' : data.error;
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
        const e = new Error(`Could not connect to ${requestUrl}. Please check your internet connection.`);
        e.code  = 'NETWORK_ERROR';
        e.cause = err.message;
        throw e;
    }
}

// ─── AUTH ─────────────────────────────────────────────────────────────

/**
 * Sign in. Sends this install's device id so a phone that has done OTP once is
 * trusted next time. Returns either { trusted, token, persistentToken, isAdmin }
 * or { needsOtp, authUserId } where authUserId is an opaque sealed ticket.
 */
export async function erpLogin(username, password) {
    return apiCall('/api/erp-login', { username, password, deviceId: await getDeviceId() });
}

/**
 * Verify the OTP for a ticket from erpLogin. The ticket already carries the
 * username, password and device id, so nothing else is sent.
 * Returns { token, persistentToken, studentName, studentPhoto, isAdmin }.
 */
export async function erpVerifyOtp(ticket, otp) {
    return apiCall('/api/erp-verify-otp', { authUserId: ticket, otp });
}

// ─── SESSION MANAGEMENT ───────────────────────────────────────────────

/**
 * Check the stored session token on app start. Never contacts the ERP.
 * Returns { valid, reason, isAdmin?, revoked? }.
 */
export async function erpCheckSession(token) {
    return apiCall('/api/erp-session', { action: 'check', token });
}

/** Complete a session refresh after OTP re-entry. Returns { token, persistentToken, studentName, isAdmin }. */
export async function erpRefreshSession(persistentToken, ticket, otp) {
    return apiCall('/api/erp-session', {
        action: 'refresh', persistentToken, authUserId: ticket, otp, deviceId: await getDeviceId(),
    });
}

// ─── DATA FETCHING ────────────────────────────────────────────────────

// The two endpoints that hold the raw register/timetable HTML server-side. Tagging
// the request with the participant UUID lets the server file the dataset row
// itself instead of shipping a semester of marks down to the phone and back up.
const RESEARCH_ENDPOINTS = ['/api/erp-calendar', '/api/erp-timetable'];

async function dataCall(endpoint, body) {
    if (RESEARCH_ENDPOINTS.includes(endpoint)) {
        const researchId = await getResearchId();
        if (researchId) body = { ...body, researchId, consentedAt: await getConsentedAt() };
    }
    const result = await apiCall(endpoint, body);
    if (result?.token) await updateErpToken(result.token); // never throws
    return result;
}

export async function erpFetchAttendance(token, persistentToken = null) {
    return dataCall('/api/erp-attendance', { token, persistentToken });
}

export async function erpFetchCalendar(token, persistentToken = null) {
    return dataCall('/api/erp-calendar', { token, persistentToken });
}

export async function erpFetchTimetable(token, persistentToken = null) {
    return dataCall('/api/erp-timetable', { token, persistentToken });
}

/** Record why a class was missed. Fire-and-forget; failures are not worth surfacing. */
export async function researchLogReason(researchId, { d, s, p, r }) {
    try {
        return await apiCall('/api/research', { researchId, action: 'reason', d, s, p, r });
    } catch {
        return null;
    }
}

/** Delete the student's research row. Errors surface — withdrawal must be confirmable. */
export async function researchWithdraw(researchId) {
    return apiCall('/api/research', { researchId, action: 'withdraw' });
}

/**
 * Keep-alive: one liveness probe against the ERP, no parsing. Failures are
 * silently ignored — this is best-effort only.
 */
export async function erpKeepAlive(token, persistentToken = null) {
    try {
        return await dataCall('/api/erp-attendance', { token, persistentToken, keepAlive: true });
    } catch {
        return null;
    }
}
