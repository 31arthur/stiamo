import { describe, expect, it, vi } from 'vitest'
import { InvalidCredentialsError } from '@/domain/auth/errors'
import { ApiAuthRepository } from './ApiAuthRepository'
import { ApiHttp, REFRESH_SKEW_MS } from './ApiHttp'
import type { AuthResponse } from './ApiHttp'
import { ApiRepository } from './ApiRepository'
import { ChangeBus } from './ChangeBus'
import { NetworkError, SessionExpiredError } from './errors'
import { MemorySessionStore } from './session'
import type { Session } from './session'

const BASE = 'https://api.test'
const USER = { id: 'u1', name: 'Ravi', email: 'ravi@example.com' }

const auth = (n: number, expiresIn = 900): AuthResponse => ({
  user: USER,
  tokens: { access_token: `access-${n}`, refresh_token: `refresh-${n}`, token_type: 'bearer', expires_in: expiresIn },
})

const session = (n: number, now: number, lifeMs = 900_000): Session => ({ accessToken: `access-${n}`, accessExpiresAt: now + lifeMs, refreshToken: `refresh-${n}`, user: USER })

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

interface Call {
  method: string
  path: string
  authorization: string | null
  body: unknown
}

/** A scripted backend: `routes` answer by "METHOD /path"; every call is recorded. */
function setup(routes: Record<string, (call: Call) => Response | Promise<Response>>, start?: Session) {
  let now = 1_000_000
  const calls: Call[] = []
  const sessions = new MemorySessionStore()
  if (start) sessions.write(start)
  const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const call: Call = {
      method: init?.method ?? 'GET',
      path: url.pathname + url.search,
      authorization: new Headers(init?.headers).get('Authorization'),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    }
    calls.push(call)
    const route = routes[`${call.method} ${url.pathname}`]
    if (!route) return json({ error: { code: 'not_found', message: 'nope' } }, 404)
    return route(call)
  }) as unknown as typeof fetch
  const http = new ApiHttp(BASE, sessions, { fetch: fetchFn, now: () => now, locks: null })
  return { http, sessions, calls, advance: (ms: number) => (now += ms), now: () => now }
}

describe('signed requests', () => {
  it('send the access token and need no refresh while it is fresh', async () => {
    const t = setup({ 'GET /v1/ping': () => json({ ok: true }) }, session(1, 1_000_000))
    expect(await t.http.get('/v1/ping')).toEqual({ ok: true })
    expect(t.calls).toHaveLength(1)
    expect(t.calls[0].authorization).toBe('Bearer access-1')
  })

  it('renew the token first when it is about to expire, and keep the rotated pair', async () => {
    const t = setup(
      { 'POST /v1/auth/refresh': (c) => (c.body as { refresh_token: string }).refresh_token === 'refresh-1' ? json(auth(2)) : json({}, 401), 'GET /v1/ping': () => json({ ok: true }) },
      session(1, 1_000_000, REFRESH_SKEW_MS - 1),
    )
    await t.http.get('/v1/ping')
    expect(t.calls.map((c) => c.path)).toEqual(['/v1/auth/refresh', '/v1/ping'])
    expect(t.calls[0].authorization).toBeNull() // the refresh token is the credential, not the access token
    expect(t.calls[1].authorization).toBe('Bearer access-2')
    expect(t.sessions.read()).toMatchObject({ accessToken: 'access-2', refreshToken: 'refresh-2' })
  })

  it('renew once and repeat the request when the server answers 401', async () => {
    let first = true
    const t = setup(
      {
        'POST /v1/auth/refresh': () => json(auth(2)),
        'GET /v1/ping': (c) => (c.authorization === 'Bearer access-2' ? json({ ok: true }) : ((first = false), json({ error: { code: 'unauthorized', message: 'no' } }, 401))),
      },
      session(1, 1_000_000),
    )
    expect(await t.http.get('/v1/ping')).toEqual({ ok: true })
    expect(first).toBe(false)
    expect(t.calls.map((c) => `${c.method} ${c.path}`)).toEqual(['GET /v1/ping', 'POST /v1/auth/refresh', 'GET /v1/ping'])
  })

  it('share one renewal between requests made at the same moment', async () => {
    const t = setup({ 'POST /v1/auth/refresh': () => json(auth(2)), 'GET /v1/a': () => json(1), 'GET /v1/b': () => json(2), 'GET /v1/c': () => json(3) }, session(1, 1_000_000, 1000))
    await Promise.all([t.http.get('/v1/a'), t.http.get('/v1/b'), t.http.get('/v1/c')])
    expect(t.calls.filter((c) => c.path === '/v1/auth/refresh')).toHaveLength(1) // spending a refresh token twice would look like theft
    expect(t.calls.filter((c) => c.authorization === 'Bearer access-2')).toHaveLength(3)
  })

  it('end the session when the server rejects the refresh token', async () => {
    const t = setup({ 'POST /v1/auth/refresh': () => json({ error: { code: 'unauthorized', message: 'used' } }, 401) }, session(1, 1_000_000, 1000))
    const changed = vi.fn()
    t.sessions.subscribe(changed)
    await expect(t.http.get('/v1/ping')).rejects.toBeInstanceOf(SessionExpiredError)
    expect(t.sessions.read()).toBeNull()
    expect(changed).toHaveBeenCalled()
  })

  it('keep the session when the renewal fails for another reason', async () => {
    const t = setup({ 'POST /v1/auth/refresh': () => json({ error: { code: 'x', message: 'down' } }, 503) }, session(1, 1_000_000, 1000))
    await expect(t.http.get('/v1/ping')).rejects.toThrow('down')
    expect(t.sessions.read()?.refreshToken).toBe('refresh-1')

    const offline = setup({}, session(1, 1_000_000, 1000))
    const http = new ApiHttp(BASE, offline.sessions, { fetch: (() => Promise.reject(new TypeError('failed'))) as unknown as typeof fetch, now: offline.now, locks: null })
    await expect(http.get('/v1/ping')).rejects.toBeInstanceOf(NetworkError)
    expect(offline.sessions.read()).not.toBeNull()
  })

  it('give up, and sign out, when a freshly renewed token is refused too', async () => {
    const t = setup({ 'POST /v1/auth/refresh': () => json(auth(2)), 'GET /v1/ping': () => json({}, 401) }, session(1, 1_000_000))
    await expect(t.http.get('/v1/ping')).rejects.toBeInstanceOf(SessionExpiredError)
    expect(t.sessions.read()).toBeNull()
  })

  it('use what another tab already renewed instead of spending the refresh token again', async () => {
    const sessions = new MemorySessionStore()
    sessions.write(session(1, 1_000_000, 1000))
    const calls: string[] = []
    // A lock that lets "another tab" finish first: by the time we hold it, the stored session is already fresh.
    const locks = {
      request: (async (_name: string, run: () => Promise<unknown>) => {
        sessions.write(session(2, 1_000_000))
        return run()
      }) as unknown as LockManager['request'],
    }
    const fetchFn = (async (input: RequestInfo | URL) => {
      calls.push(new URL(String(input)).pathname)
      return json({ ok: true })
    }) as unknown as typeof fetch
    const http = new ApiHttp(BASE, sessions, { fetch: fetchFn, now: () => 1_000_000, locks: { request: locks.request } })
    await http.get('/v1/ping')
    expect(calls).toEqual(['/v1/ping']) // no /refresh call at all
  })

  it('read errors written for people, and empty answers', async () => {
    const t = setup({ 'POST /v1/cases': () => json({ error: { code: 'validation_failed', message: 'Title is required' } }, 422), 'DELETE /v1/cases/1': () => new Response(null, { status: 204 }) }, session(1, 1_000_000))
    await expect(t.http.post('/v1/cases', {})).rejects.toMatchObject({ message: 'Title is required', status: 422, code: 'validation_failed' })
    expect(await t.http.delete('/v1/cases/1')).toBeUndefined()
  })

  it('refuse to send anything when nobody is signed in', async () => {
    const t = setup({})
    await expect(t.http.get('/v1/ping')).rejects.toBeInstanceOf(SessionExpiredError)
    expect(t.calls).toHaveLength(0)
  })
})

describe('signing in and out', () => {
  const repo = (routes: Parameters<typeof setup>[0], start?: Session) => {
    const t = setup(routes, start)
    return { ...t, repo: new ApiAuthRepository(t.http, t.sessions, t.now) }
  }

  it('login keeps both tokens and answers with the user', async () => {
    const t = repo({ 'POST /v1/auth/login': () => json(auth(1)) })
    expect(await t.repo.login({ email: 'ravi@example.com', password: 'secret123' })).toEqual(USER)
    expect(t.sessions.read()).toMatchObject({ accessToken: 'access-1', refreshToken: 'refresh-1', accessExpiresAt: t.now() + 900_000 })
    expect(t.calls[0].authorization).toBeNull()
    expect(t.calls[0].body).toEqual({ email: 'ravi@example.com', password: 'secret123' })
  })

  it('a wrong password is "invalid credentials", other failures keep their own message', async () => {
    const wrong = repo({ 'POST /v1/auth/login': () => json({ error: { code: 'unauthorized', message: 'Incorrect email or password.' } }, 401) })
    await expect(wrong.repo.login({ email: 'a@b.co', password: 'x' })).rejects.toBeInstanceOf(InvalidCredentialsError)
    expect(wrong.sessions.read()).toBeNull()
    const down = repo({ 'POST /v1/auth/login': () => json({ error: { code: 'x', message: 'Try later' } }, 503) })
    await expect(down.repo.login({ email: 'a@b.co', password: 'x' })).rejects.toThrow('Try later')
  })

  it('logout ends the session on the server and here, even when the server cannot be reached', async () => {
    const ok = repo({ 'POST /v1/auth/logout': () => new Response(null, { status: 204 }) }, session(1, 1_000_000))
    await ok.repo.logout()
    expect(ok.calls[0].body).toEqual({ refresh_token: 'refresh-1' })
    expect(ok.sessions.read()).toBeNull()

    const failing = repo({ 'POST /v1/auth/logout': () => json({}, 500) }, session(1, 1_000_000))
    await failing.repo.logout()
    expect(failing.sessions.read()).toBeNull()
  })

  it('knows who is signed in, and confirms with the server', async () => {
    const none = repo({})
    expect(await none.repo.getCurrentUser()).toBeNull()

    const live = repo({ 'GET /v1/users/me': () => json({ ...USER, name: 'Ravi K' }) }, session(1, 1_000_000))
    expect(await live.repo.getCurrentUser()).toEqual({ ...USER, name: 'Ravi K' })
    expect(live.sessions.read()?.user.name).toBe('Ravi K')

    const revoked = repo({ 'POST /v1/auth/refresh': () => json({}, 401), 'GET /v1/users/me': () => json({}, 401) }, session(1, 1_000_000))
    expect(await revoked.repo.getCurrentUser()).toBeNull()
    expect(revoked.sessions.read()).toBeNull()
  })

  it('stays signed in as the stored user while the server cannot be reached', async () => {
    const t = setup({}, session(1, 1_000_000))
    const offline = new ApiHttp(BASE, t.sessions, { fetch: (() => Promise.reject(new TypeError('offline'))) as unknown as typeof fetch, now: t.now, locks: null })
    expect(await new ApiAuthRepository(offline, t.sessions, t.now).getCurrentUser()).toEqual(USER)
    expect(t.sessions.read()).not.toBeNull()
  })

  it('reports a change of person or sign-out, but not routine token renewals', async () => {
    const t = repo({ 'POST /v1/auth/login': () => json(auth(1)) })
    const heard: (string | null)[] = []
    t.repo.onChange((u) => heard.push(u?.id ?? null))
    await t.repo.login({ email: 'ravi@example.com', password: 'secret123' })
    t.sessions.write({ ...t.sessions.read()!, accessToken: 'renewed', refreshToken: 'renewed-too' })
    t.sessions.clear()
    expect(heard).toEqual(['u1', null])
  })

  it('does not pretend password reset exists', async () => {
    await expect(repo({}).repo.resetPassword()).rejects.toThrow(/isn’t available/)
  })
})

describe('reading collections', () => {
  it('pages through everything', async () => {
    const t = setup(
      {
        'GET /v1/tasks': (c) => {
          const after = new URL(BASE + c.path).searchParams.get('after')
          return after ? json({ items: [{ id: 't3' }], nextCursor: null }) : json({ items: [{ id: 't1' }, { id: 't2' }], nextCursor: 't2' })
        },
      },
      session(1, 1_000_000),
    )
    const repo = new ApiRepository<never>(t.http, 'task', new ChangeBus())
    expect((await repo.list('u1')).map((x: { id: string }) => x.id)).toEqual(['t1', 't2', 't3'])
    expect(t.calls[1].path).toContain('after=t2')
  })

  it('treats a missing record as null, and keeps read-only collections read-only', async () => {
    const t = setup({}, session(1, 1_000_000))
    expect(await new ApiRepository<never>(t.http, 'task', new ChangeBus()).get('u1', 'nope')).toBeNull()
    await expect(new ApiRepository<never>(t.http, 'activity', new ChangeBus(), false).remove('u1', 'a')).rejects.toThrow(/own action/)
  })
})

describe('change bus', () => {
  it('turns a burst of writes into one refresh', async () => {
    vi.useFakeTimers()
    const bus = new ChangeBus(50)
    const refresh = vi.fn()
    bus.onChange(refresh)
    bus.touch()
    bus.touch()
    bus.touch()
    vi.advanceTimersByTime(60)
    expect(refresh).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})

describe('live views', () => {
  const browserStubs = () => {
    const noop = { addEventListener() {}, removeEventListener() {} }
    vi.stubGlobal('document', { visibilityState: 'visible', ...noop })
    vi.stubGlobal('window', noop)
  }

  it('catch up with a write that happened while a fetch was already under way', async () => {
    browserStubs()
    let version = 1
    const releaseFirst: { run?: () => void } = {}
    let calls = 0
    const t = setup(
      {
        'GET /v1/tasks': async () => {
          calls++
          const seen = version // what this fetch reads
          if (calls === 1) await new Promise<void>((resolve) => (releaseFirst.run = resolve)) // the first fetch is slow
          return json({ items: [{ id: 't1', title: `v${seen}` }], nextCursor: null })
        },
      },
      session(1, 1_000_000),
    )
    const bus = new ChangeBus(0)
    const heard: string[] = []
    const stop = new ApiRepository<{ id: string; title: string } & never>(t.http, 'task', bus).subscribe('u1', (items) => heard.push((items[0] as { title: string }).title))

    await vi.waitFor(() => expect(calls).toBe(1))
    version = 2 // a write lands while the slow fetch is still waiting...
    bus.touch()
    await new Promise((r) => setTimeout(r, 10))
    releaseFirst.run?.() // ...and the slow fetch now returns what it read before the write
    await vi.waitFor(() => expect(heard).toContain('v2')) // the screen still ends up with the new data
    expect(heard.at(-1)).toBe('v2')
    stop()
    vi.unstubAllGlobals()
  })
})

describe('errors people can act on', () => {
  it('say so when the server has no such address, or is not up', async () => {
    const t = setup({ 'GET /v1/gone': () => new Response('404 page not found', { status: 404 }), 'GET /v1/down': () => new Response('', { status: 503 }) }, session(1, 1_000_000))
    await expect(t.http.get('/v1/gone')).rejects.toMatchObject({ status: 404, message: expect.stringMatching(/no such address/) })
    await expect(t.http.get('/v1/down')).rejects.toMatchObject({ status: 503, message: expect.stringMatching(/unavailable/) })
  })

  it('keep the message the app itself sent', async () => {
    const t = setup({ 'GET /v1/tasks/x': () => json({ error: { code: 'not_found', message: 'Task not found.' } }, 404) }, session(1, 1_000_000))
    await expect(t.http.get('/v1/tasks/x')).rejects.toMatchObject({ message: 'Task not found.' })
  })
})
