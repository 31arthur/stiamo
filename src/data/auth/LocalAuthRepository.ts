import type { Credentials, User } from '@/domain/auth/entities/User'
import { InvalidCredentialsError } from '@/domain/auth/errors'
import type { AuthRepository } from '@/domain/auth/repositories/AuthRepository'

const SESSION_KEY = 'stiamo.session'

interface StoredAccount extends User {
  password: string
}

// Demo account. Swap this repository for an HTTP-backed one to use a real API.
export const DEMO_ACCOUNT: StoredAccount = {
  id: 'user-demo',
  name: 'Demo User',
  email: 'demo@stiamo.app',
  password: 'password123',
}

const NETWORK_LATENCY_MS = 300

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export class LocalAuthRepository implements AuthRepository {
  constructor(
    private readonly storage: Storage = localStorage,
    private readonly accounts: StoredAccount[] = [DEMO_ACCOUNT],
  ) {}

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
    const account = this.accounts.find(
      (a) => a.email.toLowerCase() === email.toLowerCase() && a.password === password,
    )
    if (!account) throw new InvalidCredentialsError()
    const user: User = { id: account.id, name: account.name, email: account.email }
    this.storage.setItem(SESSION_KEY, JSON.stringify(user))
    return user
  }

  async logout(): Promise<void> {
    this.storage.removeItem(SESSION_KEY)
  }
}
