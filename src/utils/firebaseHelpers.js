import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { signInWithCustomToken } from 'firebase/auth';
import { Platform } from 'react-native';
import { db, auth } from '../config/firebase';
import { buildApiUrl } from '../services/apiConfig';
import { logger } from './logger';

/**
 * Exchange a login code for a Firebase auth session.
 * Calls the server, which validates the code and mints a custom token (uid === code),
 * then signs in. Firestore rules require this session for any read/write of user data.
 *
 * @param {string} code
 * @param {{ create?: boolean }} [opts] - create the user doc server-side if missing (new users)
 * @throws {Error} 'Invalid login code' (404), a throttling message (429), or a generic failure
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

export const authenticateWithCode = async (code, { create = false } = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(buildApiUrl('/api/auth-token', Platform.OS), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, create }),
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

  if (res.status === 404) throw new Error('Invalid login code');
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
 * Ensure there is a Firebase session for the stored (or given) code, minting one if
 * needed. Fail-OPEN: returns false instead of throwing so offline / server-down never
 * blocks the app — cloud writes simply no-op under the rules until a session exists,
 * while local AsyncStorage keeps working.
 *
 * @param {string} [explicitCode] - defaults to the userId in AsyncStorage
 * @returns {Promise<boolean>} whether a valid session exists
 */
export const ensureAuthenticated = async (explicitCode) => {
  try {
    const code = explicitCode || (await AsyncStorage.getItem('userId'));
    if (!code) return false;
    if (auth?.currentUser?.uid === code) return true;

    if (!authInFlight) {
      authInFlight = authenticateWithCode(code).finally(() => { authInFlight = null; });
    }
    await authInFlight;
    return auth?.currentUser?.uid === code;
  } catch (e) {
    logger.warn('⚠️ Firebase auth unavailable — running local-only:', e.message);
    return false;
  }
};

// Character set for login code generation (excludes confusing characters: 0, O, 1, I)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Generate a random login code in format PRES-XXXXXXX
 * Uses non-ambiguous characters to prevent user confusion
 * @returns {string} Login code in format PRES-XXXXXXX (12 characters total)
 */
export const generateLoginCode = () => {
  const prefix = 'PRES';
  let randomPart = '';
  
  // Generate 7 random characters
  for (let i = 0; i < 7; i++) {
    const randomIndex = Math.floor(Math.random() * CODE_CHARS.length);
    randomPart += CODE_CHARS[randomIndex];
  }
  
  return `${prefix}-${randomPart}`;
};

/**
 * Get or create user ID
 * Checks AsyncStorage for existing userId, generates new one if not found
 * Creates Firestore user document for new users
 * Updates lastActive timestamp for existing users
 * @returns {Promise<string>} User ID (login code)
 */
export const getUserId = async () => {
  try {
    // Check AsyncStorage for existing userId
    const existingUserId = await AsyncStorage.getItem('userId');
    
    if (existingUserId) {
      // Sign in (needed for any cloud write), then update lastActive in the background
      // so startup is never blocked. All of this fails-open when offline.
      ensureAuthenticated(existingUserId).then((ok) => {
        if (!ok) return;
        const userRef = doc(db, 'users', existingUserId);
        setDoc(userRef, {
          lastActive: serverTimestamp(),
          version: '2.0.0'
        }, { merge: true }).catch(error => {
          logger.warn('⚠️ Failed to update lastActive:', error);
        });
      });

      logger.info('✅', 'Logged in as:', existingUserId);
      return existingUserId;
    }
    
    // Generate new login code
    const newUserId = generateLoginCode();

    // Save to AsyncStorage
    await AsyncStorage.setItem('userId', newUserId);

    // Create the user doc server-side and sign in (uid === code). The server owns
    // doc creation now — clients can't write arbitrary user docs under the rules.
    try {
      await authenticateWithCode(newUserId, { create: true });
      logger.info('✅', 'New user created:', newUserId);
    } catch (error) {
      // Offline / server down: keep the local code; cloud sync starts once auth succeeds.
      logger.warn('⚠️ Deferred cloud registration for new user:', error.message);
    }

    return newUserId;
    
  } catch (error) {
    logger.error('❌ Error in getUserId:', error);
    
    // Fallback: Generate temporary ID and store in AsyncStorage
    const tempUserId = generateLoginCode();
    try {
      await AsyncStorage.setItem('userId', tempUserId);
      logger.warn('⚠️ Using temporary ID:', tempUserId);
      return tempUserId;
    } catch (storageError) {
      logger.error('❌ Critical: Cannot save userId to AsyncStorage:', storageError);
      // Return temporary ID even if storage fails
      return tempUserId;
    }
  }
};

/**
 * Login with existing code
 * Validates code exists in Firestore, saves to AsyncStorage, updates lastActive
 * @param {string} code - Login code to validate
 * @returns {Promise<string>} User ID if valid
 * @throws {Error} If code is invalid or doesn't exist
 */
export const loginWithCode = async (code) => {
  try {
    // Validate code format before hitting the network
    // Only accept characters from CODE_CHARS (excludes 0, O, 1, I)
    const CODE_REGEX = /^PRES-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{7}$/;
    if (!code || !CODE_REGEX.test(code)) {
      throw new Error('Invalid login code');
    }

    // Authenticate — the server validates the code exists, throttles brute force,
    // and mints a session. A wrong code throws 'Invalid login code' here.
    await authenticateWithCode(code);

    // Save code to AsyncStorage
    await AsyncStorage.setItem('userId', code);

    // Update lastActive (now permitted — we're signed in as this uid)
    const userRef = doc(db, 'users', code);
    await setDoc(userRef, {
      lastActive: serverTimestamp(),
      version: '2.0.0'
    }, { merge: true });

    logger.info('✅', 'Logged in as:', code);

    return code;
    
  } catch (error) {
    if (error.message === 'Invalid login code') {
      throw error;
    }
    logger.error('❌ Error in loginWithCode:', error);
    throw new Error('Failed to login. Please check your connection and try again.');
  }
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
