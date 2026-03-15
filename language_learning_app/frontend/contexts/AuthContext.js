import React, { createContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseAuth } from '../utils/firebaseAuth';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  loginEmail,
  signUpEmail,
  sendPasswordReset as firebaseSendPasswordReset,
  loginWithGoogle as firebaseLoginWithGoogle,
} from '../utils/firebaseAuth';

const AUTH_STORAGE_KEY = '@fluo_id_token';
const API_BASE_URL = typeof __DEV__ !== 'undefined' && __DEV__ ? 'http://localhost:9090' : 'http://localhost:9090';

export const AuthContext = createContext({
  user: null,
  idToken: null,
  loading: true,
  login: async () => {},
  signUp: async () => {},
  logout: async () => {},
  sendPasswordReset: async () => {},
  loginWithGoogle: async () => {},
  refreshIdToken: async () => null,
  authHeaders: {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [idToken, setIdToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshIdToken = useCallback(async (firebaseUser) => {
    if (!firebaseUser) return null;
    try {
      const token = await firebaseUser.getIdToken(true);
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, token);
      return token;
    } catch (e) {
      console.warn('Failed to refresh id token', e);
      return null;
    }
  }, []);

  useEffect(() => {
    let unsubscribe;
    try {
      const auth = getFirebaseAuth();
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        setUser(firebaseUser);
        if (firebaseUser) {
          const token = await refreshIdToken(firebaseUser);
          setIdToken(token);
        } else {
          setIdToken(null);
          await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
        }
        setLoading(false);
      });
    } catch (e) {
      console.warn('Firebase auth not configured', e);
      setLoading(false);
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [refreshIdToken]);

  const login = useCallback(async (email, password) => {
    const cred = await loginEmail(email, password);
    const token = await refreshIdToken(cred.user);
    setIdToken(token);
    return cred.user;
  }, [refreshIdToken]);

  const signUp = useCallback(async (email, password, displayName = null, username = null) => {
    const cred = await signUpEmail(email, password);
    const token = await refreshIdToken(cred.user);
    setIdToken(token);
    if (token && (displayName || username)) {
      try {
        await fetch(`${API_BASE_URL}/api/auth/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            display_name: displayName || undefined,
            username: username || undefined,
          }),
        });
      } catch (e) {
        console.warn('Failed to update profile after sign up', e);
      }
    }
    return cred.user;
  }, [refreshIdToken]);

  const logout = useCallback(async () => {
    // Clear UI state immediately so the app shows the login screen right away
    setUser(null);
    setIdToken(null);
    setLoading(false);
    try {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      const auth = getFirebaseAuth();
      await signOut(auth);
    } catch (e) {
      // Still show login screen even if Firebase signOut fails (e.g. offline)
      console.warn('Logout cleanup failed', e);
    }
  }, []);

  const sendPasswordReset = useCallback(async (email) => {
    return firebaseSendPasswordReset(email);
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const cred = await firebaseLoginWithGoogle();
    const token = await refreshIdToken(cred.user);
    setIdToken(token);
    return cred.user;
  }, [refreshIdToken]);

  const value = {
    user,
    idToken,
    loading,
    login,
    signUp,
    logout,
    sendPasswordReset,
     loginWithGoogle,
    refreshIdToken: () => user && refreshIdToken(user),
    authHeaders: idToken ? { Authorization: `Bearer ${idToken}` } : {},
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
