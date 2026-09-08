import { db } from '../config/firebase';
import { doc, getDoc, getDocs, collection, query, where, Timestamp } from 'firebase/firestore';
import { setRuntimeApiBase } from './apiConfig';

/**
 * Whether the signed-in student is an admin. The server decides this at ERP
 * login (ADMIN_ROLL_NUMBERS) and the app stores the answer; nothing about who
 * the admins are lives in the bundle. Real authorization is still server-side:
 * every admin call carries the sealed session token and the server checks the
 * roll inside it, so flipping this flag locally only reveals a tab whose every
 * request is refused.
 */
export const isAdminUser = (state) => !!state?.settings?.isAdmin;

// ─── CONFIG (reads; writing it is adminApi.js) ──────────────────

export const getAdminConfig = async () => {
    const snap = await getDoc(doc(db, 'admin', 'config'));
    const config = snap.exists() ? { ...getDefaultConfig(), ...snap.data() } : getDefaultConfig();
    // An installed APK follows the API wherever the admin points it (audit H4).
    setRuntimeApiBase(config.apiBaseUrl);
    return config;
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

// ─── ANNOUNCEMENTS (the banner the app shows; writing them is adminApi.js)

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
