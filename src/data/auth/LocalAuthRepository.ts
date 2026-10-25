import type { Credentials, Registration, User } from '@/domain/auth/entities/User'
import { InvalidCredentialsError, ValidationError } from '@/domain/auth/errors'
import type { AuthRepository } from '@/domain/auth/repositories/AuthRepository'

const SESSION_KEY = 'stiamo.session'
const ACCOUNTS_KEY = 'stiamo.local-accounts'

interface StoredAccount extends User {
  password: string
}

/** Offline demo account, used when no Firebase project is configured. */
export const DEMO_ACCOUNT: StoredAccount = {
  id: 'user-demo',
  name: 'Demo User',
  email: 'demo@stiamo.app',
  password: 'password123',
}

const NETWORK_LATENCY_MS = 250

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Browser-only accounts for offline/demo use. Not secure — swap for FirebaseAuthRepository in production. */
export class LocalAuthRepository implements AuthRepository {
  private listeners = new Set<(user: User | null) => void>()

  constructor(private readonly storage: Storage = localStorage) {}

  async getCurrentUser(): Promise<User | null> {
    const raw = this.storage.getItem(SESSION_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as User
    } catch {
      this.storage.removeItem(SESSION_KEY)
      return null
    }
  }

  async login({ email, password }: Credentials): Promise<User> {
    await wait(NETWORK_LATENCY_MS)
    const account = this.accounts().find((a) => a.email.toLowerCase() === email.toLowerCase() && a.password === password)
    if (!account) throw new InvalidCredentialsError()
    return this.startSession(account)
  }

  async register({ name, email, password }: Registration): Promise<User> {
    await wait(NETWORK_LATENCY_MS)
    const accounts = this.accounts()
    if (accounts.some((a) => a.email.toLowerCase() === email.toLowerCase())) throw new ValidationError('An account with this email already exists')
    const account: StoredAccount = { id: crypto.randomUUID(), name, email, password }
    this.storage.setItem(ACCOUNTS_KEY, JSON.stringify([...accounts.filter((a) => a.id !== DEMO_ACCOUNT.id), account]))
    return this.startSession(account)
  }

  async resetPassword(): Promise<void> {
    throw new ValidationError('Password reset needs the online (Firebase) mode')
  }

  async logout(): Promise<void> {
    this.storage.removeItem(SESSION_KEY)
    this.emit(null)
  }

  onChange(listener: (user: User | null) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private startSession(account: StoredAccount): User {
    const user: User = { id: account.id, name: account.name, email: account.email }
    this.storage.setItem(SESSION_KEY, JSON.stringify(user))
    this.emit(user)
    return user
  }

  private accounts(): StoredAccount[] {
    try {
      const stored = JSON.parse(this.storage.getItem(ACCOUNTS_KEY) ?? '[]') as StoredAccount[]
      return [DEMO_ACCOUNT, ...stored]
    } catch {
      return [DEMO_ACCOUNT]
    }
  }

  private emit(user: User | null) {
    for (const l of this.listeners) l(user)
  }
}
