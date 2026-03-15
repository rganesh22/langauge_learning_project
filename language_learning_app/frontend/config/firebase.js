/**
 * Firebase web app config for Auth + Analytics (frontend only).
 *
 * This is the Web App config from Firebase Console:
 * Project settings → General → Your apps → Web app.
 *
 * Note: The Firebase web apiKey is NOT a secret; it is safe to ship in the client.
 */

export const firebaseConfig = {
  apiKey: 'AIzaSyCYuvp4fs9Lg1wAI7W7oYs9exYK1BGe5mU',
  authDomain: 'agentic-language-learning.firebaseapp.com',
  projectId: 'agentic-language-learning',
  storageBucket: 'agentic-language-learning.firebasestorage.app',
  messagingSenderId: '216749722261',
  appId: '1:216749722261:web:3f0fa16038d39529ac699c',
  measurementId: 'G-V3L4QDGQPZ',
};

// Optional: Analytics (web-only; safe to ignore on native)
export const analyticsEnabled = typeof window !== 'undefined';
