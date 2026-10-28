import type { User } from '@/domain/auth/entities/User'

/**
 * Everything the browser keeps about a sign-in. The access token is short-lived (minutes) and sent with every
 * request; the refresh token lasts longer and is only ever sent to `/v1/auth/refresh`, which swaps it for a new
 * pair (rotation). Both are replaced together, so the stored pair is always one that works.
 */
export interface Session {
  accessToken: string
  /** Epoch milliseconds at which the access token stops being accepted. */
  accessExpiresAt: number
  refreshToken: string
  user: User
}

/** Where a session is kept. Browser tabs share it, so a sign-in or sign-out in one is seen by the others. */
export interface SessionStore {
  read(): Session | null
  write(session: Session): void
  clear(): void
  /** Called after any change, including ones made by another tab. */
  subscribe(listener: () => void): () => void
}

export const SESSION_KEY = 'stiamo.session.v1'

const isSession = (v: unknown): v is Session => {
  const s = v as Session | null
  return !!s && typeof s.accessToken === 'string' && typeof s.refreshToken === 'string' && typeof s.accessExpiresAt === 'number' && !!s.user?.id
}

/** localStorage-backed, shared across tabs through the `storage` event. */
export class BrowserSessionStore implements SessionStore {
  private readonly listeners = new Set<() => void>()

  constructor(private readonly storage: Storage = localStorage) {
    // `storage` events fire in the *other* tabs only, which is exactly who needs telling.
    window.addEventListener('storage', (e) => {
      if (e.key === SESSION_KEY || e.key === null) this.emit()
    })
  }

  read(): Session | null {
    try {
      const raw = this.storage.getItem(SESSION_KEY)
      const parsed: unknown = raw ? JSON.parse(raw) : null
      return isSession(parsed) ? parsed : null
    } catch {
      return null
    }
  }

  write(session: Session) {
    this.storage.setItem(SESSION_KEY, JSON.stringify(session))
    this.emit()
  }

  clear() {
    this.storage.removeItem(SESSION_KEY)
    this.emit()
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit() {
    this.listeners.forEach((l) => l())
  }
}

/** For tests, and for any place without a browser. */
export class MemorySessionStore implements SessionStore {
  private current: Session | null = null
  private readonly listeners = new Set<() => void>()

  read() {
    return this.current
  }
  write(session: Session) {
    this.current = session
    this.listeners.forEach((l) => l())
  }
  clear() {
    this.current = null
    this.listeners.forEach((l) => l())
  }
  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}

/**
 * Older builds signed in through Supabase, which keeps its own session under `sb-…-auth-token`. Those tokens mean
 * nothing to the new backend, so they are removed: everybody starts from a clean sign-in.
 */
export function purgeLegacySessions(storage: Storage = localStorage) {
  const stale: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key && /^sb-.*-auth-token/.test(key)) stale.push(key)
  }
  stale.forEach((k) => storage.removeItem(k))
}
