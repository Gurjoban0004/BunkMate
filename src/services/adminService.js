import { db } from '../config/firebase';
import {
    doc, getDoc, getDocs, collection,
    query, where, Timestamp,
} from 'firebase/firestore';
import { Platform } from 'react-native';
import { buildApiUrl } from './apiConfig';
import { getErpToken } from '../storage/erpTokenStorage';

const ADMIN_ROLLS = ['2410990296'];

// Client-side gate for UI rendering only. Real authorization is enforced
// server-side: every admin API call carries the encrypted ERP session token,
// and the server checks the roll number sealed inside it. Spoofing erpRollNumber
// in local state can reveal the Admin tab but grants no privileged action.
export const isAdminRollNumber = (rollNumber) => {
    if (!rollNumber) return false;
    const clean = String(rollNumber).trim();
    return ADMIN_ROLLS.includes(clean) || clean.startsWith('admin');
};

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
    if (!snap.exists()) return getDefaultConfig();
    return { ...getDefaultConfig(), ...snap.data() };
};

export const updateAdminConfig = async (rollNumber, updates) => {
    return adminApiCall('/api/admin', {
        rollNumber,
        action: 'updateConfig',
        payload: updates,
    });
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
    featureFlags: {
        autoSync: true,
        calendarSync: true,
    },
});

// ─── ANNOUNCEMENTS (reads stay client-side, writes go through API)

export const getActiveAnnouncements = async () => {
    // Deliberately no orderBy: combining it with the active filter needs a
    // composite index that was never created, so this query failed in production
    // and no announcement ever reached a user. Announcements are few — sort them
    // here instead of depending on console setup that can silently go missing.
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
        rollNumber,
        action: 'publishAnnouncement',
        payload: { title, message, type, expiryHours },
    });
    return { id: result.id, title, message, type, active: true };
};

export const deleteAnnouncement = async (rollNumber, id) => {
    return adminApiCall('/api/admin', {
        rollNumber,
        action: 'deleteAnnouncement',
        payload: { id },
    });
};

// ─── REVOKED USERS (reads stay client-side, writes go through API)

export const getRevokedUsers = async () => {
    const snap = await getDocs(collection(db, 'admin', 'revokedUsers', 'items'));
    return snap.docs.map(d => ({ rollNumber: d.id, ...d.data() }));
};

export const revokeUser = async (rollNumber, targetRollNumber, reason) => {
    return adminApiCall('/api/admin', {
        rollNumber,
        action: 'revokeUser',
        payload: { targetRollNumber, reason },
    });
};

export const unrevokeUser = async (rollNumber, targetRollNumber) => {
    return adminApiCall('/api/admin', {
        rollNumber,
        action: 'unrevokeUser',
        payload: { targetRollNumber },
    });
};

export const isUserRevoked = async (rollNumber) => {
    if (!rollNumber) return false;
    const clean = String(rollNumber).trim();
    if (isAdminRollNumber(clean) || clean === '2410990296') return null; // Admin is NEVER revoked
    const snap = await getDoc(doc(db, 'admin', 'revokedUsers', 'items', clean));
    return snap.exists() ? snap.data() : null;
};

// ─── ANALYTICS (single-query functions stay client-side) ────────

// Computed server-side so the client never needs to read the whole users
// collection (which would require world-readable Firestore rules).
export const fetchActiveUserMetrics = (forceRefresh) =>
    fetchAnalyticsMetric(null, 'activeUsers', forceRefresh);

// ─── SERVER-SIDE ANALYTICS (formerly N+1 queries) ───────────────

async function fetchAnalyticsMetric(rollNumber, metric, forceRefresh = false) {
    const result = await adminApiCall('/api/admin-analytics', {
        rollNumber,
        metric,
        forceRefresh,
    });
    return result.data;
}

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

// ─── BATCH DETECTION (single query, stays client-side) ──────────

// Computed server-side (see fetchActiveUserMetrics) to avoid a full users read.
export const fetchBatchDistribution = (forceRefresh) =>
    fetchAnalyticsMetric(null, 'batchDistribution', forceRefresh);

// ─── DOWNTIME (derived server-side from sync telemetry) ─────────

// Nothing in the app ever wrote to admin/downtime/events, so the panel that read
// it could only ever render empty. Outages are inferred from the same telemetry
// that powers Endpoint Health, and clear themselves when the endpoint recovers.
export const fetchDowntime = (rollNumber, forceRefresh) =>
    fetchAnalyticsMetric(rollNumber, 'downtime', forceRefresh);
