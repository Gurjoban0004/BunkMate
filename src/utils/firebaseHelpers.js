import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

// Character set for login code generation (excludes confusing characters: 0, O, 1, I, L)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Generate a random login code in format PRES-XXXXXXXX
 * Uses non-ambiguous characters to prevent user confusion
 * @returns {string} Login code in format PRES-XXXXXXXX (13 characters total)
 */
export const generateLoginCode = () => {
  const prefix = 'PRES';
  let randomPart = '';
  
  // Generate 8 random characters
  for (let i = 0; i < 8; i++) {
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
      // Update lastActive timestamp for existing user
      try {
        const userRef = doc(db, 'users', existingUserId);
        await setDoc(userRef, {
          lastActive: serverTimestamp(),
          version: '1.0.0'
        }, { merge: true });
        
        console.log('✅ Logged in as:', existingUserId);
      } catch (error) {
        console.warn('⚠️ Failed to update lastActive:', error);
        // Continue anyway - local userId is valid
      }
      
      return existingUserId;
    }
    
    // Generate new login code
    const newUserId = generateLoginCode();
    
    // Save to AsyncStorage
    await AsyncStorage.setItem('userId', newUserId);
    
    // Create Firestore user document
    try {
      const userRef = doc(db, 'users', newUserId);
      await setDoc(userRef, {
        createdAt: serverTimestamp(),
        lastActive: serverTimestamp(),
        version: '1.0.0'
      });
      
      console.log('✅ New user created:', newUserId);
    } catch (error) {
      console.warn('⚠️ Failed to create Firestore user document:', error);
      // Continue anyway - local userId is saved
    }
    
    return newUserId;
    
  } catch (error) {
    console.error('❌ Error in getUserId:', error);
    
    // Fallback: Generate temporary ID and store in AsyncStorage
    const tempUserId = generateLoginCode();
    try {
      await AsyncStorage.setItem('userId', tempUserId);
      console.log('⚠️ Using temporary ID:', tempUserId);
      return tempUserId;
    } catch (storageError) {
      console.error('❌ Critical: Cannot save userId to AsyncStorage:', storageError);
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
    
    console.log('✅ Logged in as:', code);
    
    return code;
    
  } catch (error) {
    if (error.message === 'Invalid login code') {
      throw error;
    }
    console.error('❌ Error in loginWithCode:', error);
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
let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
const networkListeners = [];

/**
 * Initialize network status listeners
 * Sets up event listeners for online/offline events
 */
export const initNetworkListener = () => {
  if (typeof window === 'undefined') {
    // Not in a browser environment
    return;
  }
  
  const handleOnline = () => {
    isOnline = true;
    console.log('📡 Back online');
    
    // Notify all registered listeners
    networkListeners.forEach(callback => {
      try {
        callback(true);
      } catch (error) {
        console.error('❌ Error in network listener callback:', error);
      }
    });
  };
  
  const handleOffline = () => {
    isOnline = false;
    console.log('📡 Gone offline');
    
    // Notify all registered listeners
    networkListeners.forEach(callback => {
      try {
        callback(false);
      } catch (error) {
        console.error('❌ Error in network listener callback:', error);
      }
    });
  };
  
  // Add event listeners
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  console.log('✅ Network listener initialized');
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
