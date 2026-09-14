import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const sanitize = (val) => {
  if (!val) return undefined;
  let str = String(val).trim();
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1);
  }
  return str === "" ? undefined : str;
};

const firebaseConfig = {
  apiKey: sanitize(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: sanitize(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: sanitize(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  appId: sanitize(import.meta.env.VITE_FIREBASE_APP_ID),
  messagingSenderId: sanitize(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  storageBucket: sanitize(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  measurementId: sanitize(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID),
};

const dbUrl = sanitize(import.meta.env.VITE_FIREBASE_DATABASE_URL);
if (dbUrl) {
  firebaseConfig.databaseURL = dbUrl;
}

// Internal state
let app;
let firebaseAuth = null;
let googleProvider = null;
let firebaseRealtimeDb = null;

/**
 * Ensures Firebase app is initialized but stays silent.
 */
function initializeBaseApp() {
  if (app) return app;
  const existingApps = getApps();
  if (existingApps.length > 0) {
    app = existingApps[0];
  } else {
    app = initializeApp(firebaseConfig);
  }
  return app;
}

/**
 * Get the initialized Firebase Auth instance lazily.
 */
export function getFirebaseAuth() {
  if (!firebaseAuth) {
    const firebaseApp = initializeBaseApp();
    firebaseAuth = getAuth(firebaseApp);
  }
  return firebaseAuth;
}

/**
 * Get the initialized Google Auth Provider lazily.
 */
export function getGoogleAuthProvider() {
  if (!googleProvider) {
    googleProvider = new GoogleAuthProvider();
  }
  return googleProvider;
}

/**
 * Legacy support: ensuring Firebase is initialized.
 * Now it only initializes the basic App and Realtime DB if requested.
 * Auth initialization is skipped by default to avoid stale 'getProjectConfig' calls.
 */
export function ensureFirebaseInitialized(options = {}) {
  const { enableAuth = false, enableRealtimeDb = true } = options;
  const firebaseApp = initializeBaseApp();

  if (enableAuth) {
    getFirebaseAuth();
  }

  if (enableRealtimeDb && !firebaseRealtimeDb) {
    firebaseRealtimeDb = getDatabase(firebaseApp);
  }
  
  return firebaseApp;
}

// Proxies for export
export { app as firebaseApp, firebaseAuth, googleProvider, firebaseRealtimeDb };
