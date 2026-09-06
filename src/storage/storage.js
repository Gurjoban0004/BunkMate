import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getCurrentSemesterId, checkOnlineStatus, ensureAuthenticated } from '../utils/firebaseHelpers';
import { logger } from '../utils/logger';

const STORAGE_KEY = '@bunkmate_state';
const STATE_VERSION = 1;
const SYNC_TIMEOUT = 5000;

// Live UI state that must never be written anywhere: a server verdict, a
// sheet being open, network reachability, the sync spinner.
const TRANSIENT_KEYS = ['erpSync', 'accessRevoked', 'erpReconnectOpen', 'erpSessionExpired', 'isOnline', 'devDate'];

function stripTransient(state) {
    const out = { ...state };
    TRANSIENT_KEYS.forEach((k) => delete out[k]);
    return out;
}

const withTimeout = (promise, ms, message) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
]);

/** Whether the cloud copy is newer than the local one. */
export function shouldUseCloudData(localState, cloudState) {
    if (!cloudState) return false;
    if (!localState) return true;
    const localTime = localState._lastModified ? new Date(localState._lastModified).getTime() : 0;
    const cloudTime = cloudState._lastModified ? new Date(cloudState._lastModified).getTime() : 0;
    return cloudTime > localTime;
}

/**
 * Save to local storage, then (if signed in and online) to Firestore.
 * Local is the fast path and always wins for the running app; the cloud copy
 * exists so a second device or a reinstall can pick up where this one left off.
 */
export async function saveAppState(state) {
    const stateWithTimestamp = {
        ...stripTransient(state),
        _version: STATE_VERSION,
        _lastModified: new Date().toISOString(),
    };

    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stateWithTimestamp));

        if (checkOnlineStatus() && state.userId && await ensureAuthenticated(state.userId)) {
            const semesterId = getCurrentSemesterId();
            const semesterRef = doc(db, 'users', state.userId, 'semesters', semesterId);

            setDoc(semesterRef, { ...stateWithTimestamp, _cloudTimestamp: serverTimestamp() }, { merge: true })
                .then(() => logger.info('✅', `State synced to cloud (${semesterId})`))
                .catch((err) => logger.warn('⚠️ Cloud sync failed (will retry later):', err));

            // The root user profile is what the admin roster reads. Only a
            // student who has connected their college account gets one — an
            // abandoned sign-up never becomes a "user" in the admin panel.
            if (state.erpRollNumber) {
                const yearPrefix = String(state.erpRollNumber).substring(0, 2);
                const fullYear = parseInt(yearPrefix, 10) >= 50 ? `19${yearPrefix}` : `20${yearPrefix}`;
                setDoc(doc(db, 'users', state.userId), {
                    erpRollNumber: state.erpRollNumber,
                    batchGroup: `Batch ${fullYear}`,
                    studentName: state.userName || '',
                    setupComplete: !!state.setupComplete,
                    lastActive: serverTimestamp(),
                }, { merge: true }).catch(() => {});
            }
        }
    } catch (e) {
        logger.error('❌ Failed to save state:', e);
    }
}

/**
 * The local copy only. No network, so it is what the app paints from.
 * Returns null when there is nothing saved or it belongs to another user.
 */
export async function loadLocalState() {
    const currentUserId = await AsyncStorage.getItem('userId');
    const localValue = await AsyncStorage.getItem(STORAGE_KEY);
    let localState = localValue ? JSON.parse(localValue) : null;

    if (localState && localState._version !== STATE_VERSION) localState._version = STATE_VERSION;

    if (localState && localState.userId && currentUserId && localState.userId !== currentUserId) {
        logger.info('🔄', 'Local state belongs to a different user, discarding.');
        localState = null;
    }
    return localState;
}

/**
 * The cloud copy for this user's current semester, or null. Signs in first
 * (fail-open: no session → null). Bounded so it can never hang a caller.
 */
export async function loadCloudState(userId) {
    if (!userId || !checkOnlineStatus()) return null;
    if (!(await ensureAuthenticated(userId))) return null;
    const semesterRef = doc(db, 'users', userId, 'semesters', getCurrentSemesterId());
    const snap = await withTimeout(getDoc(semesterRef), SYNC_TIMEOUT, 'Cloud fetch timeout');
    return snap && snap.exists() ? snap.data() : null;
}

/**
 * Local + cloud, newest wins, local storage updated to match. Used by the
 * "log in with a code" flow, which genuinely has to wait for the cloud.
 */
export async function loadAppState() {
    try {
        const currentUserId = await AsyncStorage.getItem('userId');
        let localState = await loadLocalState();
        try {
            const cloudState = await loadCloudState(currentUserId);
            if (shouldUseCloudData(localState, cloudState)) {
                logger.info('🔄', 'Cloud data is newer, updating local storage');
                localState = cloudState;
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(localState));
            }
        } catch (cloudError) {
            logger.warn('⚠️ Could not fetch cloud data, using local:', cloudError.message);
        }
        return localState;
    } catch (e) {
        logger.error('❌ Failed to load state:', e);
        return null;
    }
}

/** One-time upload of a pre-cloud install. Safe to call every launch. */
export async function migrateToFirestore(state) {
    if (!state || state._migrated) return;

    try {
        const userId = await AsyncStorage.getItem('userId');
        if (!userId || !checkOnlineStatus()) return;
        if (!(await ensureAuthenticated(userId))) return;

        const semesterRef = doc(db, 'users', userId, 'semesters', getCurrentSemesterId());
        const cloudDoc = await withTimeout(getDoc(semesterRef), SYNC_TIMEOUT, 'Migration timeout');

        if (!cloudDoc.exists()) {
            const migratedState = {
                ...stripTransient(state),
                _migrated: true,
                _lastModified: new Date().toISOString(),
                _cloudTimestamp: serverTimestamp(),
            };
            await withTimeout(setDoc(semesterRef, migratedState), SYNC_TIMEOUT, 'Migration timeout');
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(migratedState));
            logger.info('✅', 'Migration complete');
        } else {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stripTransient(state), _migrated: true }));
        }
    } catch (error) {
        logger.error('❌ Migration failed:', error);
    }
}

/** Soft-delete in the cloud, hard-delete locally. */
export async function deleteUserAccount() {
    const userId = await AsyncStorage.getItem('userId');
    if (userId && checkOnlineStatus() && await ensureAuthenticated(userId)) {
        const semesterRef = doc(db, 'users', userId, 'semesters', getCurrentSemesterId());
        await setDoc(semesterRef, { _deleted: true, _deletedAt: serverTimestamp() }, { merge: true });
    }
    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.removeItem('userId');
    logger.info('✅', 'Account and data deleted successfully');
}

export async function clearAppState() {
    try {
        await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        logger.error('Failed to clear state from AsyncStorage:', e);
    }
}
