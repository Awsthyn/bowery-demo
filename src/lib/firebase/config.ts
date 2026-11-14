/**
 * Firebase client identifiers. These are NOT secrets: they ship inside every client build anyway.
 * Access is protected by (1) only Google + Anonymous providers being enabled, and (2) the Android
 * API key being restricted in Google Cloud Console to package com.bowery.onboardingdemo + the EAS SHA-1.
 * See README "Why the Firebase config is committed".
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyCClhsZYO-rXVCkLxkslbTvfkbm1SuK2JE',
  authDomain: 'bowery-demo.firebaseapp.com',
  projectId: 'bowery-demo',
  storageBucket: 'bowery-demo.firebasestorage.app',
  messagingSenderId: '332744897043',
  appId: '1:332744897043:web:f0abd1335a420bc2f305e6',
};

/** OAuth "Web client" (client_type 3 in google-services.json). Required to get an idToken on Android. */
export const googleWebClientId = '332744897043-agh33k520omee4fes4i6qrk7hs5qo9pe.apps.googleusercontent.com';
