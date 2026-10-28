import type { Credentials, Registration, User } from '@/domain/auth/entities/User'
import { InvalidCredentialsError } from '@/domain/auth/errors'
import type { AuthRepository } from '@/domain/auth/repositories/AuthRepository'
import { ApiHttp, sessionFrom, userOf } from './ApiHttp'
import type { AuthResponse } from './ApiHttp'
import { ApiError, SessionExpiredError } from './errors'
import type { SessionStore } from './session'

/**
 * Signs in against the Stiamo identity service. The session (access + refresh token) lives in the SessionStore and
 * is looked after by ApiHttp; this class only starts and ends it and reports who is signed in.
 */
export class ApiAuthRepository implements AuthRepository {
  constructor(
    private readonly http: ApiHttp,
    private readonly sessions: SessionStore,
    private readonly now: () => number = Date.now,
  ) {}

  async getCurrentUser(): Promise<User | null> {
    const stored = this.sessions.read()
    if (!stored) return null
    try {
      // Asking the server confirms the account still exists and renews the tokens if they have lapsed.
      const me = await this.http.get<{ id: string; name: string; email: string }>('/v1/users/me')
      const user = { id: me.id, name: me.name, email: me.email }
      const current = this.sessions.read()
      if (current && (current.user.name !== user.name || current.user.email !== user.email)) this.sessions.write({ ...current, user })
      return user
    } catch (e) {
      if (e instanceof SessionExpiredError || (e instanceof ApiError && (e.status === 401 || e.status === 404))) {
        this.sessions.clear()
        return null
      }
      // Offline or the server is down: keep the session and carry on as the stored user.
      return stored.user
    }
  }

  async login({ email, password }: Credentials): Promise<User> {
    try {
      return this.begin(await this.http.request<AuthResponse>('POST', '/v1/auth/login', { json: { email, password }, auth: false }))
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) throw new InvalidCredentialsError()
      throw e
    }
  }

  async register({ name, email, password }: Registration): Promise<User> {
    return this.begin(await this.http.request<AuthResponse>('POST', '/v1/auth/register', { json: { name, email, password }, auth: false }))
  }

  async resetPassword(): Promise<void> {
    throw new Error('Password reset isn’t available yet. Ask the owner to set a new password for you.')
  }

  async logout(): Promise<void> {
    const session = this.sessions.read()
    // End it on the server too, so the refresh token can't be used again. If that fails the local sign-out still happens.
    if (session) await this.http.request('POST', '/v1/auth/logout', { json: { refresh_token: session.refreshToken }, auth: false }).catch(() => undefined)
    this.sessions.clear()
  }

  onChange(listener: (user: User | null) => void): () => void {
    let last = this.sessions.read()?.user.id ?? null
    return this.sessions.subscribe(() => {
      const user = this.sessions.read()?.user ?? null
      // Token renewals rewrite the session; only a different person (or nobody) is news.
      if ((user?.id ?? null) !== last) {
        last = user?.id ?? null
        listener(user)
      }
    })
  }

  private begin(response: AuthResponse): User {
    this.sessions.write(sessionFrom(response, this.now()))
    return userOf(response)
  }
}
