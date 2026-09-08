/**
 * The admin panel's own API surface — every write and every metric.
 *
 * Split out of adminService.js so it is imported by AdminScreen and nothing
 * else. AdminScreen is web-only (see navigation/AdminTab.native.js), so this
 * whole contract — which endpoints exist, which actions they take, what can be
 * revoked or purged — stays out of the APK instead of sitting in a file anyone
 * can unzip. Authorization was never here: the server checks the roll sealed in
 * the session token against ADMIN_ROLL_NUMBERS on every call.
 */

import { Platform } from 'react-native';
import { buildApiUrl } from './apiConfig';
import { getErpToken } from '../storage/erpTokenStorage';

// ─── API HELPERS ────────────────────────────────────────────────

// All admin calls authenticate with the encrypted session token (proof of a real
// ERP login), never a plaintext roll number. Legacy callers may still pass a roll
// number as the first argument; it is ignored in favor of the token.
async function adminApiCall(endpoint, body) {
    const token = await getErpToken();
    const url = buildApiUrl(endpoint, Platform.OS);
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, token }),
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error((payload && payload.error) || `Request failed (HTTP ${res.status})`);
    }
    if (!payload) {
        throw new Error('Server returned a non-JSON response — is the API deployed?');
    }
    return payload;
}

export const updateAdminConfig = async (rollNumber, updates) => {
    return adminApiCall('/api/admin', { rollNumber, action: 'updateConfig', payload: updates });
};

export const publishAnnouncement = async (rollNumber, { title, message, type, expiryHours }) => {
    const result = await adminApiCall('/api/admin', {
        rollNumber, action: 'publishAnnouncement', payload: { title, message, type, expiryHours },
    });
    return { id: result.id, title, message, type, active: true };
};

export const deleteAnnouncement = async (rollNumber, id) => {
    return adminApiCall('/api/admin', { rollNumber, action: 'deleteAnnouncement', payload: { id } });
};

// ─── REVOKED USERS (server-side only — the list is no longer world-readable)

export const listAuditLog = async () => {
    const result = await adminApiCall('/api/admin', { action: 'listAuditLog' });
    return result.entries || [];
};

/** Deletes leftover accounts from the old login codes. Returns { deleted, remaining }. */
export const purgeUnfinishedSignups = async (olderThanDays = 7) => {
    return adminApiCall('/api/admin', { action: 'purgeUnfinishedSignups', payload: { olderThanDays } });
};

export const getRevokedUsers = async () => {
    const result = await adminApiCall('/api/admin', { action: 'listRevokedUsers' });
    return result.users || [];
};

export const revokeUser = async (rollNumber, targetRollNumber, reason) => {
    return adminApiCall('/api/admin', { rollNumber, action: 'revokeUser', payload: { targetRollNumber, reason } });
};

export const unrevokeUser = async (rollNumber, targetRollNumber) => {
    return adminApiCall('/api/admin', { rollNumber, action: 'unrevokeUser', payload: { targetRollNumber } });
};

// ─── ANALYTICS (computed server-side) ───────────────────────────

async function fetchAnalyticsMetric(rollNumber, metric, forceRefresh = false) {
    const result = await adminApiCall('/api/admin-analytics', { rollNumber, metric, forceRefresh });
    return result.data;
}

export const fetchOverview = (forceRefresh) =>
    fetchAnalyticsMetric(null, 'overview', forceRefresh);

// Live and login history come from the server-side activity ledger, not from
// what the app managed to write to Firestore — see api/_activity.js.
export const fetchLive = (forceRefresh) =>
    fetchAnalyticsMetric(null, 'live', forceRefresh);

export const fetchLoginEvents = (forceRefresh) =>
    fetchAnalyticsMetric(null, 'loginEvents', forceRefresh);

export const fetchSessionEvents = (forceRefresh) =>
    fetchAnalyticsMetric(null, 'sessionEvents', forceRefresh);

export const fetchSubjectDifficulty = (rollNumber, forceRefresh) =>
    fetchAnalyticsMetric(rollNumber, 'subjectDifficulty', forceRefresh);

export const fetchBunkCultureIndex = (rollNumber, forceRefresh) =>
    fetchAnalyticsMetric(rollNumber, 'bunkCulture', forceRefresh);

export const fetchEndpointHealth = (rollNumber, forceRefresh) =>
    fetchAnalyticsMetric(rollNumber, 'endpointHealth', forceRefresh);

export const fetchParserFailures = (rollNumber, forceRefresh) =>
    fetchAnalyticsMetric(rollNumber, 'parserFailures', forceRefresh);

export const fetchRateLimitData = (rollNumber, forceRefresh) =>
    fetchAnalyticsMetric(rollNumber, 'rateLimit', forceRefresh);

/** { users: [real students], unfinished: { count, olderThan7d } } */
export const fetchUserRoster = (rollNumber, forceRefresh) =>
    fetchAnalyticsMetric(rollNumber, 'userRoster', forceRefresh);

export const fetchBatchDistribution = (forceRefresh) =>
    fetchAnalyticsMetric(null, 'batchDistribution', forceRefresh);

// Outages are inferred from the same telemetry that powers Endpoint Health.
export const fetchDowntime = (rollNumber, forceRefresh) =>
    fetchAnalyticsMetric(rollNumber, 'downtime', forceRefresh);
