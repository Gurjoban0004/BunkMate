import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Platform } from 'react-native';
import { db } from '../config/firebase';
import { logger } from './logger';

// Character set for login code generation (excludes confusing characters: 0, O, 1, I, L)
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
      // Update lastActive in background — do NOT await, so startup is never blocked
      const userRef = doc(db, 'users', existingUserId);
      setDoc(userRef, {
        lastActive: serverTimestamp(),
        version: '1.0.0'
      }, { merge: true }).catch(error => {
        logger.warn('⚠️ Failed to update lastActive:', error);
      });
      
      logger.info('✅', 'Logged in as:', existingUserId);
      return existingUserId;
    }
    
    // Generate new login code
    const newUserId = generateLoginCode();
    
    // Save to AsyncStorage
    await AsyncStorage.setItem('userId', newUserId);
    
    // Create Firestore user document in background — do NOT await
    const userRef = doc(db, 'users', newUserId);
    setDoc(userRef, {
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp(),
      version: '1.0.0'
    }).then(() => {
      logger.info('✅', 'New user created:', newUserId);
    }).catch(error => {
      logger.warn('⚠️ Failed to create Firestore user document:', error);
    });
    
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
    // Validate code format before hitting Firestore
    const CODE_REGEX = /^PRES-[A-Z0-9]{7}$/;
    if (!code || !CODE_REGEX.test(code)) {
      throw new Error('Invalid login code');
    }

    // Validate code exists in Firestore
    const userRef = doc(db, 'users', code);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('Invalid login code');
    }
    
    // Save code to AsyncStorage
    await AsyncStorage.setItem('userId', code);
    
    // Update lastActive timestamp
    await setDoc(userRef, {
      lastActive: serverTimestamp(),
      version: '1.0.0'
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
