import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { firebaseConfig } from '../config/firebase';

let app = null;
let auth = null;

export function getFirebaseAuth() {
  if (!firebaseConfig.apiKey) {
    throw new Error(
      'Firebase API key missing. Set EXPO_PUBLIC_FIREBASE_API_KEY (and optionally EXPO_PUBLIC_FIREBASE_APP_ID, EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) in .env or config.'
    );
  }
  if (!app) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
  }
  return auth;
}

export async function loginEmail(email, password) {
  const a = getFirebaseAuth();
  return signInWithEmailAndPassword(a, email, password);
}

export async function signUpEmail(email, password) {
  const a = getFirebaseAuth();
  return createUserWithEmailAndPassword(a, email, password);
}

export async function logoutFirebase() {
  const a = getFirebaseAuth();
  return signOut(a);
}

export async function sendPasswordReset(email) {
  const a = getFirebaseAuth();
  return sendPasswordResetEmail(a, email);
}

export async function loginWithGoogle() {
  const a = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  // Works on web; on native this requires a different flow
  return signInWithPopup(a, provider);
}
