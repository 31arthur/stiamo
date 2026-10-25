import { initializeApp } from 'firebase/app'
import type { FirebaseApp, FirebaseOptions } from 'firebase/app'
import { browserLocalPersistence, initializeAuth } from 'firebase/auth'
import type { Auth } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import type { FirebaseStorage } from 'firebase/storage'

export interface FirebaseServices {
  app: FirebaseApp
  auth: Auth
  db: Firestore
  storage: FirebaseStorage
}

/** Reads the web config from Vite env; null when the app should run in offline/demo mode. */
export function readFirebaseConfig(env: Record<string, string | undefined> = import.meta.env): FirebaseOptions | null {
  const config: FirebaseOptions = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  }
  return config.apiKey && config.projectId && config.appId ? config : null
}

export function initFirebase(config: FirebaseOptions): FirebaseServices {
  const app = initializeApp(config)
  // Offline-first: reads come from an IndexedDB cache shared across tabs; writes queue while offline.
  const db = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  })
  const auth = initializeAuth(app, { persistence: browserLocalPersistence })
  return { app, auth, db, storage: getStorage(app) }
}
