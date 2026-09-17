import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, PhoneAuthProvider, RecaptchaVerifier } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import jsonConfig from '../../firebase-applet-config.json';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || jsonConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || jsonConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || jsonConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || jsonConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || jsonConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || jsonConfig.appId,
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

// Determine firestore database ID safely
const envDbId = import.meta.env.VITE_FIREBASE_DATABASE_ID;
const jsonDbId = (jsonConfig as any).firestoreDatabaseId;
const isVercelHost = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');

const targetDbId = envDbId || (isVercelHost ? '(default)' : jsonDbId);

export const db = (targetDbId && targetDbId !== '(default)')
  ? getFirestore(app, targetDbId)
  : getFirestore(app);

export { PhoneAuthProvider, RecaptchaVerifier };

