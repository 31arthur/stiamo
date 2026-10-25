import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import type { Auth, User as FirebaseUser } from 'firebase/auth'
import type { Credentials, Registration, User } from '@/domain/auth/entities/User'
import { InvalidCredentialsError } from '@/domain/auth/errors'
import type { AuthRepository } from '@/domain/auth/repositories/AuthRepository'
import { describeFirebaseError, firebaseCode } from './errors'

const toUser = (u: FirebaseUser): User => ({ id: u.uid, name: u.displayName || u.email?.split('@')[0] || 'You', email: u.email ?? '' })

const INVALID = new Set(['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'])

export class FirebaseAuthRepository implements AuthRepository {
  constructor(private readonly auth: Auth) {}

  async getCurrentUser(): Promise<User | null> {
    await this.auth.authStateReady()
    return this.auth.currentUser ? toUser(this.auth.currentUser) : null
  }

  async login({ email, password }: Credentials): Promise<User> {
    try {
      return toUser((await signInWithEmailAndPassword(this.auth, email, password)).user)
    } catch (error) {
      if (INVALID.has(firebaseCode(error) ?? '')) throw new InvalidCredentialsError()
      throw new Error(describeFirebaseError(error))
    }
  }

  async register({ name, email, password }: Registration): Promise<User> {
    try {
      const { user } = await createUserWithEmailAndPassword(this.auth, email, password)
      await updateProfile(user, { displayName: name })
      return toUser(user)
    } catch (error) {
      throw new Error(describeFirebaseError(error))
    }
  }

  async resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(this.auth, email)
    } catch (error) {
      throw new Error(describeFirebaseError(error))
    }
  }

  async logout(): Promise<void> {
    await signOut(this.auth)
  }

  onChange(listener: (user: User | null) => void): () => void {
    return onAuthStateChanged(this.auth, (u) => listener(u ? toUser(u) : null))
  }
}
