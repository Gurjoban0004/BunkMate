import { initializeApp } from 'firebase/app';
import { getFirestore, initializeFirestore, enableIndexedDbPersistence, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';
import { Platform } from 'react-native';
import { logger } from '../utils/logger';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

// Validate that all required config values are present
const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const missingKeys = requiredKeys.filter(key => !firebaseConfig[key]);

if (missingKeys.length > 0) {
  throw new Error(
    `Missing Firebase configuration keys: ${missingKeys.join(', ')}. ` +
    'Please create a .env file with your Firebase credentials. ' +
    'See .env.example for the required format.'
  );
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with platform-specific configuration
let db;

if (Platform.OS === 'web') {
  // Web platform: Use IndexedDB persistence
  db = getFirestore(app);
  
  // Enable offline persistence for web
  enableIndexedDbPersistence(db)
    .catch((err) => {
      if (err.code === 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one tab at a time
        logger.warn('⚠️ Multiple tabs open. Persistence enabled in first tab only.');
      } else if (err.code === 'unimplemented') {
        // The current browser doesn't support persistence
        logger.warn('⚠️ Browser does not support offline persistence.');
      } else {
        logger.error('❌ Error enabling persistence:', err);
      }
    });
} else {
  // React Native platform: Use unlimited cache size
  db = initializeFirestore(app, {
    cacheSizeBytes: CACHE_SIZE_UNLIMITED
  });
}

export { db, app };
export default app;
