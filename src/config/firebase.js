import { initializeApp } from 'firebase/app';
import { getFirestore, initializeFirestore, enableIndexedDbPersistence, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';
import { Platform } from 'react-native';

// Firebase configuration
// TODO: Replace with your actual Firebase project credentials
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

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
        console.warn('⚠️ Multiple tabs open. Persistence enabled in first tab only.');
      } else if (err.code === 'unimplemented') {
        // The current browser doesn't support persistence
        console.warn('⚠️ Browser does not support offline persistence.');
      } else {
        console.error('❌ Error enabling persistence:', err);
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
