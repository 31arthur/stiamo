import type { User } from '@/domain/auth/entities/User'
import { NetworkError, SessionExpiredError, toApiError } from './errors'
import type { Session, SessionStore } from './session'

/** Renew the access token a little before it expires, so a request never leaves with one that is about to lapse. */
export const REFRESH_SKEW_MS = 30_000

const REFRESH_LOCK = 'stiamo-session-refresh'

/** What `/v1/auth/login`, `/register` and `/refresh` answer with. */
export interface AuthResponse {
  user: { id: string; name: string; email: string }
  tokens: { access_token: string; refresh_token: string; token_type: string; expires_in: number }
}

export const userOf = (a: AuthResponse): User => ({ id: a.user.id, name: a.user.name, email: a.user.email })

export function sessionFrom(a: AuthResponse, now: number): Session {
  return { accessToken: a.tokens.access_token, accessExpiresAt: now + a.tokens.expires_in * 1000, refreshToken: a.tokens.refresh_token, user: userOf(a) }
}

type QueryValue = string | number | boolean | null | undefined

export interface RequestOptions {
  query?: Record<string, QueryValue>
  /** Sent as a JSON body. */
  json?: unknown
  /** Skip the Authorization header (sign-in and sign-up). Default: signed requests. */
  auth?: boolean
  signal?: AbortSignal
}

export interface HttpDeps {
  fetch?: typeof fetch
  now?: () => number
  /** The Web Locks API. Keeps two tabs from spending the same refresh token at once; null where it does not exist. */
  locks?: Pick<LockManager, 'request'> | null
}

/**
 * The one place that talks to the Stiamo backend.
 *
 * - Signed requests carry the access token. If it is about to expire it is renewed first, and if the server still
 *   says 401 it is renewed once and the request repeated.
 * - Renewing spends the refresh token, which the server replaces with a new one (rotation) and treats a second use of
 *   as theft. So a renewal is single-flight within the tab and serialised across tabs with a Web Lock; a tab that
 *   waited re-reads the stored session and uses what the winner saved instead of spending the token again.
 * - A refresh the server rejects (401) ends the session. A refresh that merely failed (offline, 5xx) does not.
 */
export class ApiHttp {
  private inflightRefresh: Promise<Session> | null = null
  private readonly fetchFn: typeof fetch
  private readonly now: () => number
  private readonly locks: Pick<LockManager, 'request'> | null

  constructor(
    readonly baseUrl: string,
    readonly sessions: SessionStore,
    deps: HttpDeps = {},
  ) {
    this.fetchFn = deps.fetch ?? ((...args) => globalThis.fetch(...args))
    this.now = deps.now ?? Date.now
    this.locks = deps.locks !== undefined ? deps.locks : typeof navigator !== 'undefined' && 'locks' in navigator ? navigator.locks : null
  }

  get<T>(path: string, query?: RequestOptions['query']) {
    return this.request<T>('GET', path, { query })
  }
  post<T>(path: string, json?: unknown, query?: RequestOptions['query']) {
    return this.request<T>('POST', path, { json, query })
  }
  put<T>(path: string, json?: unknown) {
    return this.request<T>('PUT', path, { json })
  }
  patch<T>(path: string, json?: unknown) {
    return this.request<T>('PATCH', path, { json })
  }
  delete<T = void>(path: string, query?: RequestOptions['query']) {
    return this.request<T>('DELETE', path, { query })
  }

  /** Where a path on the backend lives, for things the browser fetches itself (images, downloads). */
  url(path: string) {
    return `${this.baseUrl}${path}`
  }

  async request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const signed = options.auth ?? true
    const token = signed ? await this.accessToken() : null
    let response = await this.send(method, path, options, token)
    if (response.status === 401 && signed) {
      const renewed = await this.refresh(token)
      response = await this.send(method, path, options, renewed.accessToken)
      if (response.status === 401) {
        // A brand-new token was refused too: this session cannot be repaired.
        this.sessions.clear()
        throw new SessionExpiredError()
      }
    }
    if (!response.ok) throw await toApiError(response)
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }

  /** Uploads a form (a file) and reports progress, which `fetch` cannot. */
  async upload<T>(path: string, form: FormData, onProgress?: (fraction: number) => void): Promise<T> {
    let token = await this.accessToken()
    let result = await this.xhr(path, form, token, onProgress)
    if (result.status === 401) {
      token = (await this.refresh(token)).accessToken
      result = await this.xhr(path, form, token, onProgress)
      if (result.status === 401) {
        this.sessions.clear()
        throw new SessionExpiredError()
      }
    }
    if (result.status < 200 || result.status >= 300) throw await toApiError(new Response(result.text, { status: result.status }))
    return JSON.parse(result.text) as T
  }

  /** A valid access token: the stored one while it has time left, otherwise a renewed one. */
  async accessToken(): Promise<string> {
    const session = this.sessions.read()
    if (!session) throw new SessionExpiredError()
    if (session.accessExpiresAt - REFRESH_SKEW_MS > this.now()) return session.accessToken
    return (await this.refresh(null)).accessToken
  }

  /** `stale` is the access token that was just refused (or null when we are renewing early). */
  refresh(stale: string | null): Promise<Session> {
    if (!this.inflightRefresh) {
      this.inflightRefresh = this.exclusive(() => this.rotate(stale)).finally(() => {
        this.inflightRefresh = null
      })
    }
    return this.inflightRefresh
  }

  private exclusive<T>(run: () => Promise<T>): Promise<T> {
    return this.locks ? this.locks.request(REFRESH_LOCK, run) : run()
  }

  private async rotate(stale: string | null): Promise<Session> {
    const current = this.sessions.read()
    if (!current) throw new SessionExpiredError()
    // Another tab may have renewed while we waited for the lock: use its result, don't spend the token twice.
    const usable = current.accessExpiresAt - REFRESH_SKEW_MS > this.now()
    if (usable && (stale === null || current.accessToken !== stale)) return current

    let response: Response
    try {
      response = await this.fetchFn(this.url('/v1/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refresh_token: current.refreshToken }),
      })
    } catch {
      throw new NetworkError()
    }
    if (response.status === 401) {
      this.sessions.clear()
      throw new SessionExpiredError()
    }
    if (!response.ok) throw await toApiError(response)
    const next = sessionFrom((await response.json()) as AuthResponse, this.now())
    this.sessions.write(next)
    return next
  }

  private async send(method: string, path: string, options: RequestOptions, token: string | null): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`
    if (options.json !== undefined) headers['Content-Type'] = 'application/json'
    try {
      return await this.fetchFn(this.target(path, options.query), {
        method,
        headers,
        body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
        signal: options.signal,
      })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e
      throw new NetworkError()
    }
  }

  private target(path: string, query?: RequestOptions['query']) {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null && v !== '') params.set(k, String(v))
    const qs = params.toString()
    return this.url(path) + (qs ? `?${qs}` : '')
  }

  private xhr(path: string, form: FormData, token: string, onProgress?: (fraction: number) => void) {
    return new Promise<{ status: number; text: string }>((resolve, reject) => {
      const req = new XMLHttpRequest()
      req.open('POST', this.url(path))
      req.setRequestHeader('Authorization', `Bearer ${token}`)
      req.setRequestHeader('Accept', 'application/json')
      if (onProgress) req.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total)
      req.onload = () => resolve({ status: req.status, text: req.responseText })
      req.onerror = () => reject(new NetworkError())
      req.send(form)
    })
  }
}
