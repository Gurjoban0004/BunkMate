import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getCurrentSemesterId, checkOnlineStatus } from '../utils/firebaseHelpers';
import { logger } from '../utils/logger';

const STORAGE_KEY = '@bunkmate_state';
const STATE_VERSION = 1;
const SYNC_TIMEOUT = 5000; // 5 seconds timeout for cloud operations

/**
 * Compare local and cloud data to determine which is newer
 * @param {Object} localState - Local state from AsyncStorage
 * @param {Object} cloudState - Cloud state from Firestore
 * @returns {boolean} True if cloud data should be used
 */
export function shouldUseCloudData(localState, cloudState) {
    if (!cloudState) return false;
    if (!localState) return true;

    const localTime = localState._lastModified ? new Date(localState._lastModified).getTime() : 0;
    const cloudTime = cloudState._lastModified ? new Date(cloudState._lastModified).getTime() : 0;

    return cloudTime > localTime;
}

/**
 * Save app state to both local storage and Firestore (if online)
 * @param {Object} state - Current application state
 */
export async function saveAppState(state) {
    const timestamp = new Date().toISOString();
    const stateWithTimestamp = {
        ...state,
        _version: STATE_VERSION,
        _lastModified: timestamp
    };

    try {
        // 1. Always save to AsyncStorage first (synchronous-like, always succeeds)
        const jsonValue = JSON.stringify(stateWithTimestamp);
        await AsyncStorage.setItem(STORAGE_KEY, jsonValue);
        logger.info('✅', 'State saved to local storage');

        // 2. If online, save to Firestore for current semester
        if (checkOnlineStatus() && state.userId) {
            const semesterId = getCurrentSemesterId();
            const semesterRef = doc(db, 'users', state.userId, 'semesters', semesterId);

            // Save to cloud with _cloudTimestamp
            // Use setDoc with merge to preserve other fields if any
            setDoc(semesterRef, {
                ...stateWithTimestamp,
                _cloudTimestamp: serverTimestamp()
            }, { merge: true })
            .then(() => logger.info('✅', `State synced to cloud (${semesterId})`))
            .catch(err => logger.warn('⚠️ Cloud sync failed (will retry later):', err));
        }
    } catch (e) {
        logger.error('❌ Failed to save state:', e);
    }
}

/**
 * Load app state from local storage and optionally sync with cloud
 * @returns {Promise<Object|null>} Loaded state or null
 */
export async function loadAppState() {
    try {
        // Read userId once upfront to avoid race conditions between two separate reads
        const currentUserId = await AsyncStorage.getItem('userId');

        // 1. Load from AsyncStorage first (fast, reliable)
        const localValue = await AsyncStorage.getItem(STORAGE_KEY);
        let localState = localValue ? JSON.parse(localValue) : null;

        // Simple migration logic if state version differs
        if (localState && localState._version !== STATE_VERSION) {
            localState._version = STATE_VERSION;
        }

        // Security / Bug Fix: Never load a local state belonging to a different user
        if (localState && localState.userId && currentUserId && localState.userId !== currentUserId) {
            logger.info('🔄', 'Local state belongs to a different user, discarding.');
            localState = null;
        }

        // 2. If online, try to load from Firestore and compare
        if (checkOnlineStatus() && currentUserId) {
            try {
                const semesterId = getCurrentSemesterId();
                const semesterRef = doc(db, 'users', currentUserId, 'semesters', semesterId);
                
                // Implement timeout for cloud fetch
                const cloudFetchPromise = getDoc(semesterRef);
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Cloud fetch timeout')), SYNC_TIMEOUT)
                );

                const cloudDoc = await Promise.race([cloudFetchPromise, timeoutPromise]);
                
                if (cloudDoc && cloudDoc.exists()) {
                    const cloudState = cloudDoc.data();
                    
                    if (shouldUseCloudData(localState, cloudState)) {
                        logger.info('🔄', 'Cloud data is newer, updating local storage');
                        localState = cloudState;
                        // Update local storage in background
                        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(localState));
                    }
                }
            } catch (cloudError) {
                logger.warn('⚠️ Could not fetch cloud data, using local:', cloudError.message);
                // Fallback to localState already handled
            }
        }

        return localState;
    } catch (e) {
        logger.error('❌ Failed to load state:', e);
        return null;
    }
}

/**
 * Migrate local data to Firestore if not already done
 * @param {Object} state - Current loaded state
 */
export async function migrateToFirestore(state) {
    if (!state || state._migrated) return;

    try {
        const userId = await AsyncStorage.getItem('userId');
        if (!userId || !checkOnlineStatus()) return;

        const semesterId = getCurrentSemesterId();
        const semesterRef = doc(db, 'users', userId, 'semesters', semesterId);

        const mkTimeout = () => new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Migration timeout')), SYNC_TIMEOUT)
        );

        // Check if cloud data already exists to avoid overwriting newer data
        const cloudDoc = await Promise.race([getDoc(semesterRef), mkTimeout()]);
        
        if (!cloudDoc.exists()) {
            logger.info('🚀', 'Migrating local data to Firestore...');
            const migratedState = {
                ...state,
                _migrated: true,
                _lastModified: new Date().toISOString(),
                _cloudTimestamp: serverTimestamp()
            };

            await Promise.race([setDoc(semesterRef, migratedState), mkTimeout()]);
            
            // Update local state with migrated flag only after successful cloud write
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(migratedState));
            logger.info('✅', 'Migration complete');
        } else {
            // Already exists in cloud, just mark as migrated locally
            const migratedState = { ...state, _migrated: true };
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(migratedState));
            logger.info('ℹ️', 'Cloud data already exists, marked local as migrated');
        }
    } catch (error) {
        logger.error('❌ Migration failed:', error);
        // Do NOT set _migrated: true on failure — allow retry on next launch
        // Only set a failure flag to avoid spamming logs, but keep retrying
        try {
            const failedState = { ...state, _migrationAttempted: true };
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(failedState));
        } catch (sErr) { /* ignore */ }
    }
}

/**
 * Delete user account and local data
 */
export async function deleteUserAccount() {
    try {
        const userId = await AsyncStorage.getItem('userId');
        
        if (userId && checkOnlineStatus()) {
            const semesterId = getCurrentSemesterId();
            const semesterRef = doc(db, 'users', userId, 'semesters', semesterId);
            
            // Mark as deleted in cloud instead of hard delete
            // Cloud functions will handle actual cleanup if needed
            await setDoc(semesterRef, {
                _deleted: true,
                _deletedAt: serverTimestamp()
            }, { merge: true });
        }

        // Clear local storage
        await AsyncStorage.removeItem(STORAGE_KEY);
        await AsyncStorage.removeItem('userId');
        
        logger.info('✅', 'Account and data deleted successfully');
    } catch (error) {
        logger.error('❌ Error deleting account:', error);
        throw error;
    }
}

export async function clearAppState() {
    try {
        await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        logger.error('Failed to clear state from AsyncStorage:', e);
    }
}
