import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { Auth, getAuth, initializeAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Config comes from EXPO_PUBLIC_FIREBASE_* variables (see .env.example). Without them the app runs in local-only demo mode. */
const cfg = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};
export const firebaseConfigured = Boolean(cfg.apiKey && cfg.projectId && cfg.appId);

// Metro resolves 'firebase/auth' to the React Native build, which exports getReactNativePersistence; the TS typings only describe the web build.
const getReactNativePersistence = (FirebaseAuth as unknown as { getReactNativePersistence: (s: typeof AsyncStorage) => FirebaseAuth.Persistence }).getReactNativePersistence;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function getFirebase(): { app: FirebaseApp; auth: Auth; db: Firestore; storage: FirebaseStorage } | null {
  if (!firebaseConfigured) return null;
  if (!app) {
    app = getApps().length ? getApp() : initializeApp(cfg as Record<string, string>);
    try {
      // Persist the signed-in user across app restarts (multi-device login works with the same account on each phone).
      auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
    } catch {
      auth = getAuth(app);   // already initialised (fast refresh)
    }
  }
  return { app: app!, auth: auth!, db: getFirestore(app!), storage: getStorage(app!) };
}
