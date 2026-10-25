import { FirebaseError } from 'firebase/app'

const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Invalid email or password',
  'auth/wrong-password': 'Invalid email or password',
  'auth/user-not-found': 'Invalid email or password',
  'auth/invalid-email': 'Enter a valid email address',
  'auth/email-already-in-use': 'An account with this email already exists — sign in instead',
  'auth/weak-password': 'Choose a stronger password (at least 8 characters)',
  'auth/too-many-requests': 'Too many attempts. Wait a moment and try again',
  'auth/network-request-failed': 'You appear to be offline',
  'auth/operation-not-allowed': 'Email/password sign-in is not enabled for this Firebase project (Authentication → Sign-in method)',
  'auth/configuration-not-found': 'Firebase Authentication is not set up for this project yet (Authentication → Get started)',
  'permission-denied': 'You don’t have access to this data. Check that the Firestore security rules are deployed',
  'unavailable': 'Can’t reach the database right now — changes will sync when you’re back online',
  'failed-precondition': 'The Firestore database isn’t ready. Create it in the Firebase console (Firestore Database → Create database)',
  'not-found': 'The Firestore database doesn’t exist yet. Create it in the Firebase console',
  'storage/unauthorized': 'You don’t have permission to upload here. Check the Storage security rules',
  'storage/quota-exceeded': 'Storage quota exceeded',
  'storage/retry-limit-exceeded': 'Upload timed out — check your connection',
}

/** Turns Firebase errors into sentences a person can act on. */
export function describeFirebaseError(error: unknown): string {
  if (error instanceof FirebaseError) return MESSAGES[error.code] ?? error.message.replace(/^Firebase:\s*/, '')
  return error instanceof Error ? error.message : 'Something went wrong'
}

export const firebaseCode = (error: unknown) => (error instanceof FirebaseError ? error.code : undefined)
