import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { signInWithCustomToken } from 'firebase/auth';
import { Platform } from 'react-native';
import { db, auth } from '../config/firebase';
import { getErpToken } from '../storage/erpTokenStorage';
import { buildApiUrl } from '../services/apiConfig';
import { APP_VERSION } from '../config/version';
import { logger } from './logger';

/**
 * Exchange the ERP session token for a Firebase auth session.
 *
 * The server opens the sealed token, reads the roll number out of it and mints a
 * custom token with uid === roll number. Firestore rules require that session for
 * any read/write of user data. There is no second credential: the college login
 * the student already did is the whole proof.
 *
 * @param {string} erpToken - the sealed session token from erpTokenStorage
 * @throws {Error} 'Session expired' (401), a throttling message (429), or a generic failure
 */
// React Native's fetch has NO default timeout. An unbounded stall here hangs app
// STARTUP: loadAppState() awaits ensureAuthenticated(), and AppProvider's
// `finally { setIsLoading(false) }` only runs once that resolves — so a stalled
// request leaves the app on the splash forever (an Android ANR). Always bound it.
const AUTH_TIMEOUT_MS = 15000;

function withTimeout(promise, ms, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

export const authenticateWithErp = async (erpToken) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(buildApiUrl('/api/auth-token', Platform.OS), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: erpToken }),
      signal: controller.signal,
    });
  } catch (e) {
    if (e?.name === 'AbortError') {
      throw new Error('Could not reach the server. Please check your connection and try again.');
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }

  if (res.status === 401) throw new Error('Session expired');
  if (res.status === 429) throw new Error('Too many attempts. Please try again in a few minutes.');
  if (!res.ok) throw new Error('Could not sign in. Please check your connection and try again.');

  const { token } = await res.json();
  // Firebase's own sign-in call is likewise unbounded — race it.
  await withTimeout(
    signInWithCustomToken(auth, token),
    AUTH_TIMEOUT_MS,
    'Sign-in timed out. Please try again.',
  );
  return true;
};

// Dedupe concurrent auth attempts (boot + first save can race).
let authInFlight = null;

/**
 * Ensure there is a Firebase session for the stored (or given) roll number,
 * minting one from the ERP session token if needed. Fail-OPEN: returns false
 * instead of throwing so offline / server-down / signed-out-of-college never
 * blocks the app — cloud writes simply no-op under the rules until a session
 * exists, while local storage keeps working.
 *
 * @param {string} [explicitRoll] - defaults to the userId in AsyncStorage
 * @returns {Promise<boolean>} whether a valid session exists
 */
export const ensureAuthenticated = async (explicitRoll) => {
  try {
    const roll = explicitRoll || (await AsyncStorage.getItem('userId'));
    if (!roll) return false;
    if (auth?.currentUser?.uid === roll) return true;

    if (!authInFlight) {
      // No college session, no cloud session. That is the whole point: there is
      // no longer a second credential that could stand in for one.
      authInFlight = getErpToken()
        .then((erpToken) => (erpToken ? authenticateWithErp(erpToken) : false))
        .finally(() => { authInFlight = null; });
    }
    await authInFlight;
    return auth?.currentUser?.uid === roll;
  } catch (e) {
    logger.warn('⚠️ Firebase auth unavailable — running local-only:', e.message);
    return false;
  }
};

/**
 * Adopt a roll number as this install's identity and register it in the cloud.
 *
 * Called once, right after the college sign-in that proved the roll belongs to
 * this student. Signing in on a new phone with the same college account lands on
 * the same id, so cloud data comes back by itself — which is the job the
 * PRES-XXXXXXX login code used to do badly.
 *
 * @param {string} rollNumber
 * @returns {Promise<string|null>} the stored id, or null if the roll was empty
 */
export const registerUser = async (rollNumber) => {
  const roll = String(rollNumber || '').trim();
  if (!roll) return null;

  await AsyncStorage.setItem('userId', roll);

  // Sign in and stamp lastActive in the background so setup is never blocked;
  // fails open when offline, and the next sync picks it up.
  ensureAuthenticated(roll).then((ok) => {
    if (!ok) return;
    setDoc(doc(db, 'users', roll), {
      lastActive: serverTimestamp(),
      version: APP_VERSION,
    }, { merge: true }).catch((error) => logger.warn('⚠️ Failed to update lastActive:', error));
  });

  logger.info('✅', 'Signed in as:', roll);
  return roll;
};

/**
 * Calculate current semester ID based on date
 * August-December: fall-YYYY
 * January-May: spring-YYYY
 * June-July: summer-YYYY
 * @returns {string} Semester ID (e.g., "fall-2024")
 */
export const getCurrentSemesterId = () => {
  const now = new Date();
  const month = now.getMonth() + 1; // getMonth() returns 0-11
  const year = now.getFullYear();
  
  if (month >= 8 && month <= 12) {
    // August through December: fall semester
    return `fall-${year}`;
  } else if (month >= 1 && month <= 5) {
    // January through May: spring semester
    return `spring-${year}`;
  } else {
    // June through July: summer semester
    return `summer-${year}`;
  }
};

// Network status tracking
// On web, use navigator.onLine; on native default to true (online)
let isOnline = Platform.OS === 'web'
  ? (typeof navigator !== 'undefined' ? navigator.onLine : true)
  : true;
const networkListeners = [];

const notifyListeners = (status) => {
  networkListeners.forEach(callback => {
    try {
      callback(status);
    } catch (error) {
      logger.error('❌ Error in network listener callback:', error);
    }
  });
};

/**
 * Initialize network status listeners
 * On web: uses window online/offline events
 * On native: no-op (NetInfo can be wired in separately if needed)
 */
export const initNetworkListener = () => {
  if (Platform.OS !== 'web') {
    // Native platforms — skip web-only window events
    logger.info('📡', 'Network listener skipped on native (use NetInfo if needed)');
    return;
  }

  if (typeof window === 'undefined') return;

  const handleOnline = () => {
    isOnline = true;
    logger.info('📡', 'Back online');
    notifyListeners(true);
  };

  const handleOffline = () => {
    isOnline = false;
    logger.info('📡', 'Gone offline');
    notifyListeners(false);
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  logger.info('✅', 'Network listener initialized');
};

/**
 * Check current online status
 * @returns {boolean} True if online, false if offline
 */
export const checkOnlineStatus = () => {
  return isOnline;
};

/**
 * Register a callback for network status changes
 * @param {Function} callback - Function to call when network status changes (receives boolean)
 * @returns {Function} Unsubscribe function
 */
export const onNetworkStatusChange = (callback) => {
  networkListeners.push(callback);
  
  // Return unsubscribe function
  return () => {
    const index = networkListeners.indexOf(callback);
    if (index > -1) {
      networkListeners.splice(index, 1);
    }
  };
};
