import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, PhoneAuthProvider, RecaptchaVerifier } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

const customDatabaseId = (firebaseConfig as any).firestoreDatabaseId;
export const db = (customDatabaseId && customDatabaseId !== '(default)')
  ? getFirestore(app, customDatabaseId)
  : getFirestore(app);

export { PhoneAuthProvider, RecaptchaVerifier };
