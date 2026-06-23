import { db } from '../config/firebase';
import {
    doc, getDoc, getDocs, collection,
    query, where, orderBy, limit, Timestamp,
} from 'firebase/firestore';
import { Platform } from 'react-native';
import { buildApiUrl } from './apiConfig';

const ADMIN_ROLL = '2410990296';

export const isAdminRollNumber = (rollNumber) => rollNumber === ADMIN_ROLL;

// ─── API HELPERS ────────────────────────────────────────────────

async function adminApiCall(endpoint, body) {
    const url = buildApiUrl(endpoint, Platform.OS);
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
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

const getDefaultConfig = () => ({
    maintenanceMode: false,
    maintenanceMessage: 'Scheduled upgrades in progress.',
    minVersion: '2.0.0',
    updateUrl: '',
    featureFlags: {
        autoSync: true,
        calendarSync: true,
        gradeEstimates: true,
    },
});

// ─── ANNOUNCEMENTS (reads stay client-side, writes go through API)

export const getActiveAnnouncements = async () => {
    const now = Timestamp.now();
    const q = query(
        collection(db, 'admin', 'announcements', 'items'),
        where('active', '==', true),
        orderBy('createdAt', 'desc'),
        limit(10)
    );
    const snap = await getDocs(q);
    return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(a => !a.expiry || a.expiry.toMillis() > now.toMillis());
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
    const snap = await getDoc(doc(db, 'admin', 'revokedUsers', 'items', rollNumber));
    return snap.exists() ? snap.data() : null;
};

// ─── ANALYTICS (single-query functions stay client-side) ────────

export const fetchActiveUserMetrics = async () => {
    const usersSnap = await getDocs(collection(db, 'users'));
    const now = Date.now();
    const DAY = 86400000;

    let dau = 0, wau = 0, mau = 0;
    const dailyCounts = new Array(7).fill(0);

    usersSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.lastActive) return;
        const lastActive = data.lastActive.toMillis ? data.lastActive.toMillis() : new Date(data.lastActive).getTime();
        const diff = now - lastActive;

        if (diff <= DAY) dau++;
        if (diff <= 7 * DAY) wau++;
        if (diff <= 30 * DAY) mau++;

        const daysAgo = Math.floor(diff / DAY);
        if (daysAgo < 7) dailyCounts[6 - daysAgo]++;
    });

    return { dau, wau, mau, sparkline: dailyCounts };
};

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

// ─── BATCH DETECTION (single query, stays client-side) ──────────

export const fetchBatchDistribution = async () => {
    const usersSnap = await getDocs(collection(db, 'users'));
    const batches = {};

    usersSnap.forEach(docSnap => {
        const data = docSnap.data();
        const rn = data.erpRollNumber;
        if (!rn || rn.length < 4) return;
        const yearPrefix = rn.substring(0, 2);
        const fullYear = parseInt(yearPrefix, 10) >= 50 ? `19${yearPrefix}` : `20${yearPrefix}`;
        const batchLabel = `Batch ${fullYear}`;
        if (!batches[batchLabel]) batches[batchLabel] = 0;
        batches[batchLabel]++;
    });

    const total = Object.values(batches).reduce((a, b) => a + b, 0);
    return Object.entries(batches)
        .map(([batch, count]) => ({ batch, count, percentage: total > 0 ? (count / total) * 100 : 0 }))
        .sort((a, b) => b.count - a.count);
};

// ─── DOWNTIME (reads stay client-side, writes go through API) ───

export const getDowntimeEvents = async () => {
    const snap = await getDocs(
        query(collection(db, 'admin', 'downtime', 'events'), orderBy('detectedAt', 'desc'), limit(10))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const resolveDowntime = async (rollNumber, eventId) => {
    return adminApiCall('/api/admin', {
        rollNumber,
        action: 'resolveDowntime',
        payload: { eventId },
    });
};
