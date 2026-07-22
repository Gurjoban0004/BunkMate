import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
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
  logger.warn(
    `Missing Firebase configuration keys: ${missingKeys.join(', ')}. ` +
    'Set EXPO_PUBLIC_FIREBASE_* environment variables in EAS or your .env file.'
  );
}

let app = null;
let db = null;
let auth = null;

if (missingKeys.length === 0) {
  try {
    app = initializeApp(firebaseConfig);
    db = Platform.OS === 'web'
      ? initializeFirestore(app, {
          localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        })
      : initializeFirestore(app);
    auth = getAuth(app);
  } catch (error) {
    logger.warn('Firebase unavailable — running local-only:', error.message);
  }
}

export { db, app, auth };
export default app;
