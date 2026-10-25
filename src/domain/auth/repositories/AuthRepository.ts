import type { Credentials, Registration, User } from '../entities/User'

export interface AuthRepository {
  /** Resolves once the session is known (restored or absent). */
  getCurrentUser(): Promise<User | null>
  login(credentials: Credentials): Promise<User>
  register(registration: Registration): Promise<User>
  resetPassword(email: string): Promise<void>
  logout(): Promise<void>
  /** Notifies when the session changes (sign-in elsewhere, expiry, sign-out). */
  onChange(listener: (user: User | null) => void): () => void
}
