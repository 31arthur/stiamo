import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('sonner', () => {
  const fn = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), dismiss: vi.fn(), loading: vi.fn(), promise: vi.fn() })
  return { toast: fn }
})

describe('notifications', () => {
  beforeEach(() => {
    vi.resetModules()
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) })
    vi.stubGlobal('window', { addEventListener: () => {}, removeEventListener: () => {} })
  })

  it('keeps what the toasts said, newest first, and counts only unread problems', async () => {
    const { toast } = await import('./toast')
    const store = await import('./store')
    const { toast: sonner } = await import('sonner')
    expect(store.useNotices).toBeTypeOf('function')
    toast.success('Saved')
    toast.error('The run failed', { description: 'OpenRouter says the account is out of credit.' })
    toast.warning('2 items could not be decided')
    expect(sonner.error).toHaveBeenCalledWith('The run failed', { description: 'OpenRouter says the account is out of credit.' })

    const list = JSON.parse(localStorage.getItem('stiamo.notices.v1') ?? '[]')
    expect(list.map((n: { title: string }) => n.title)).toEqual(['2 items could not be decided', 'The run failed', 'Saved'])
    expect(list[1]).toMatchObject({ level: 'error', detail: 'OpenRouter says the account is out of credit.', read: false })
    expect(store.unreadProblems(list)).toBe(2)

    store.markAllRead()
    expect(store.unreadProblems(JSON.parse(localStorage.getItem('stiamo.notices.v1') ?? '[]'))).toBe(0)
    store.clearNotices()
    expect(JSON.parse(localStorage.getItem('stiamo.notices.v1') ?? '[]')).toEqual([])
  })

  it('keeps at most a hundred', async () => {
    const store = await import('./store')
    for (let i = 0; i < 120; i++) store.record('info', `n${i}`)
    const list = JSON.parse(localStorage.getItem('stiamo.notices.v1') ?? '[]')
    expect(list).toHaveLength(100)
    expect(list[0].title).toBe('n119')
  })
})
