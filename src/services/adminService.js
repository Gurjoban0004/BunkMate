import { db } from '../config/firebase';
import { doc, getDoc, getDocs, collection, query, where, Timestamp } from 'firebase/firestore';
import { Platform } from 'react-native';
import { buildApiUrl, setRuntimeApiBase } from './apiConfig';
import { getErpToken } from '../storage/erpTokenStorage';

/**
 * Whether the signed-in student is an admin. The server decides this at ERP
 * login (ADMIN_ROLL_NUMBERS) and the app stores the answer; nothing about who
 * the admins are lives in the bundle. Real authorization is still server-side:
 * every admin call carries the sealed session token and the server checks the
 * roll inside it, so flipping this flag locally only reveals a tab whose every
 * request is refused.
 */
export const isAdminUser = (state) => !!state?.settings?.isAdmin;

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

// ─── CONFIG (reads stay client-side, writes go through API) ─────

export const getAdminConfig = async () => {
    const snap = await getDoc(doc(db, 'admin', 'config'));
    const config = snap.exists() ? { ...getDefaultConfig(), ...snap.data() } : getDefaultConfig();
    // An installed APK follows the API wherever the admin points it (audit H4).
    setRuntimeApiBase(config.apiBaseUrl);
    return config;
};

export const updateAdminConfig = async (rollNumber, updates) => {
    return adminApiCall('/api/admin', { rollNumber, action: 'updateConfig', payload: updates });
};

/**
 * Remote feature flags, for the app (not the admin screen) to gate behaviour on.
 * Falls back to enabled so a failed config read never silently disables sync.
 */
export const getFeatureFlags = async () => {
    try {
        const config = await getAdminConfig();
        return { ...getDefaultConfig().featureFlags, ...(config.featureFlags || {}) };
    } catch {
        return getDefaultConfig().featureFlags;
    }
};

const getDefaultConfig = () => ({
    maintenanceMode: false,
    maintenanceMessage: 'Scheduled upgrades in progress.',
    minVersion: '2.0.0',
    updateUrl: '',
    apiBaseUrl: '',
    featureFlags: {
        autoSync: true,
        calendarSync: true,
    },
});

// ─── ANNOUNCEMENTS (reads stay client-side, writes go through API)

export const getActiveAnnouncements = async () => {
    // Deliberately no orderBy: combining it with the active filter needs a
    // composite index; announcements are few, so sort here instead.
    const now = Timestamp.now();
    const snap = await getDocs(query(
        collection(db, 'admin', 'announcements', 'items'),
        where('active', '==', true),
    ));

    const millis = (value) => (value && typeof value.toMillis === 'function') ? value.toMillis() : 0;

    return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(a => !a.expiry || millis(a.expiry) > now.toMillis())
        .sort((a, b) => millis(b.createdAt) - millis(a.createdAt))
        .slice(0, 10);
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

export const fetchActiveUserMetrics = (forceRefresh) =>
    fetchAnalyticsMetric(null, 'activeUsers', forceRefresh);

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

export const fetchUserRoster = (rollNumber, forceRefresh) =>
    fetchAnalyticsMetric(rollNumber, 'userRoster', forceRefresh);

export const fetchBatchDistribution = (forceRefresh) =>
    fetchAnalyticsMetric(null, 'batchDistribution', forceRefresh);

// Outages are inferred from the same telemetry that powers Endpoint Health.
export const fetchDowntime = (rollNumber, forceRefresh) =>
    fetchAnalyticsMetric(rollNumber, 'downtime', forceRefresh);
