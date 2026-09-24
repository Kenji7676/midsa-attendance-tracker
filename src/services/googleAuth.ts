import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App safely (avoid re-initialization)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Scopes required for Gmail integration
export const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

// Configure Google provider to prompt for account selection so users can choose/switch emails freely
provider.setCustomParameters({
  prompt: 'select_account',
});

// Flag to track whether an active sign-in flow is happening
let isSigningIn = false;

// In-memory token cache (MUST NOT be persisted in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let cachedUser: User | null = null;

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
}

type AuthCallback = (state: AuthState) => void;
const listeners = new Set<AuthCallback>();

const notifyListeners = () => {
  const state: AuthState = {
    user: cachedUser,
    accessToken: cachedAccessToken,
    isAuthenticated: !!(cachedUser && cachedAccessToken),
  };
  listeners.forEach((callback) => callback(state));
};

// Listen to auth changes and manage in-memory token lifecycle
onAuthStateChanged(auth, (user: User | null) => {
  cachedUser = user;
  if (!user) {
    cachedAccessToken = null;
  }
  notifyListeners();
});

export const subscribeAuth = (callback: AuthCallback): (() => void) => {
  listeners.add(callback);
  callback({
    user: cachedUser,
    accessToken: cachedAccessToken,
    isAuthenticated: !!(cachedUser && cachedAccessToken),
  });
  return () => {
    listeners.delete(callback);
  };
};

/**
 * Initializes auth state and attaches success/failure handlers.
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    cachedUser = user;
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      if (!isSigningIn) {
        cachedAccessToken = null;
      }
      if (onAuthFailure) onAuthFailure();
    }
    notifyListeners();
  });
};

/**
 * Initiates the Google Sign-In popup to obtain an access token with Gmail scopes.
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Google sign-in succeeded, but no access token was returned for Gmail API.');
    }

    cachedAccessToken = credential.accessToken;
    cachedUser = result.user;
    notifyListeners();

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    if (
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request'
    ) {
      // Normal user action - closed or cancelled popup window, do not log as an error
      console.info('Google sign-in popup was closed by user.');
    } else {
      console.error('Google Sign-in error:', error);
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Retrieves the currently active in-memory Google access token.
 */
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

/**
 * Retrieves the currently active user profile.
 */
export const getCurrentUser = (): User | null => {
  return cachedUser;
};

/**
 * Disconnects / signs out the active Google account and clears the in-memory token.
 */
export const googleSignOut = async (): Promise<void> => {
  await signOut(auth);
  cachedAccessToken = null;
  cachedUser = null;
  notifyListeners();
};
