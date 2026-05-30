import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { initializeAuth, getAuth, GoogleAuthProvider, type Persistence } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// getReactNativePersistence is in the RN build of firebase/auth but the tsc types resolve
// the browser build (package.json puts "types" before "react-native" in the export map).
// Using require lets Metro pick the correct RN bundle at runtime while keeping tsc happy.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getReactNativePersistence } = require('firebase/auth') as {
  getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
};

const firebaseConfig = {
  apiKey: 'AIzaSyCR_tMxKN_KS2T2J1v-U2XAJHEpWuSGmVM',
  authDomain: 'swipemyflat.firebaseapp.com',
  projectId: 'swipemyflat',
  storageBucket: 'swipemyflat.firebasestorage.app',
  messagingSenderId: '967416784277',
  appId: '1:967416784277:web:aa9751713c003f501d029c',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

function getDb() {
  try {
    return initializeFirestore(app, { experimentalForceLongPolling: true });
  } catch {
    return getFirestore(app);
  }
}

function getAuthInstance() {
  try {
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    return getAuth(app);
  }
}

export const db = getDb();
export const auth = getAuthInstance();
export const storage = getStorage(app);
export { GoogleAuthProvider };
export default app;
