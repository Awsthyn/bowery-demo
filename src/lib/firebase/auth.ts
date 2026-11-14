import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  type Auth,
  GoogleAuthProvider,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  signInAnonymously,
  signInWithCredential,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { Platform } from 'react-native';

import { firebaseConfig, googleWebClientId } from './config';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

function createAuth(): Auth {
  try {
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    // Fast refresh re-evaluates this module; auth is already initialised.
    return getAuth(app);
  }
}

export const auth = createAuth();

/**
 * The native Google Sign-In module is not bundled in Expo Go. Importing it there crashes at load
 * time, so it is required lazily and only when this flag is true.
 */
export const isGoogleSignInAvailable =
  Platform.OS === 'android' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

type GoogleModule = typeof import('@react-native-google-signin/google-signin');
let google: GoogleModule | undefined;

function loadGoogle(): GoogleModule {
  if (!isGoogleSignInAvailable) throw new Error('Google Sign-In is not available in this build');
  if (!google) {
    // Lazy on purpose: a top-level import would crash Expo Go, which lacks the native module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    google = require('@react-native-google-signin/google-signin') as GoogleModule;
    google.GoogleSignin.configure({ webClientId: googleWebClientId });
  }
  return google;
}

/** Resolves false when the user cancels the Google sheet. */
export async function signInWithGoogle(): Promise<boolean> {
  const { GoogleSignin, isSuccessResponse } = loadGoogle();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) return false;
  const { idToken } = response.data;
  if (!idToken) throw new Error('Google did not return an ID token');
  await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  return true;
}

export async function signInAsDemo() {
  await signInAnonymously(auth);
}

export async function signOut() {
  if (isGoogleSignInAvailable && google) {
    await google.GoogleSignin.signOut().catch(() => undefined);
  }
  await firebaseSignOut(auth);
}

/** Human-readable message for the sign-in screen. */
export function describeAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === 'DEVELOPER_ERROR' || code === '10') {
    return 'Google Sign-In is misconfigured for this build (SHA-1 mismatch). Use "Continue as demo user".';
  }
  if (code === 'auth/network-request-failed') return 'No connection. Sign-in needs internet the first time.';
  return error instanceof Error ? error.message : 'Sign-in failed';
}
