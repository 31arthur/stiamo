import type { Repository } from '@/domain/shared/Repository'
import type { StoreKind } from '@/domain/shared/registry'
import type { Entity, ID } from '@/domain/shared/types'
import { ApiHttp } from './ApiHttp'
import { ApiError } from './errors'
import { ChangeBus } from './ChangeBus'

/** The backend route behind each collection. */
export const PATHS: Record<StoreKind, string> = {
  task: '/v1/tasks',
  meeting: '/v1/meetings',
  followUp: '/v1/follow-ups',
  case: '/v1/cases',
  hearing: '/v1/hearings',
  plan: '/v1/plans',
  goal: '/v1/goals',
  counsel: '/v1/counsel',
  client: '/v1/clients',
  project: '/v1/projects',
  link: '/v1/links',
  activity: '/v1/activity',
  attachment: '/v1/attachments',
}

const PAGE = 1000
/** How often an open screen asks again. Local writes refetch immediately; this catches changes from other devices. */
export const POLL_MS = 20_000

interface Page<T> {
  items: T[]
  nextCursor?: string | null
}

/**
 * One collection on the backend. Reads page through the list endpoint; `subscribe` keeps a live view by refetching
 * when something is written here, on a timer while the tab is visible, and when the tab or the network comes back.
 * Collections that are changed through dedicated actions (links, history, attachments) are read-only here.
 */
export class ApiRepository<T extends Entity> implements Repository<T> {
  constructor(
    private readonly http: ApiHttp,
    private readonly kind: StoreKind,
    private readonly bus: ChangeBus,
    private readonly writable = true,
  ) {}

  private get path() {
    return PATHS[this.kind]
  }

  async list(_userId: ID): Promise<T[]> {
    const items: T[] = []
    let after: string | null | undefined
    do {
      const page: Page<T> = await this.http.get<Page<T>>(this.path, { limit: PAGE, after })
      items.push(...page.items)
      after = page.nextCursor
    } while (after)
    return items
  }

  async get(_userId: ID, id: ID): Promise<T | null> {
    try {
      return await this.http.get<T>(`${this.path}/${encodeURIComponent(id)}`)
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 405)) return null
      throw e
    }
  }

  async save(entity: T): Promise<T> {
    this.assertWritable()
    const saved = await this.http.put<T>(`${this.path}/${encodeURIComponent(entity.id)}`, entity)
    this.bus.touch()
    return saved
  }

  async saveMany(entities: T[]): Promise<void> {
    for (const e of entities) await this.save(e)
  }

  async remove(_userId: ID, id: ID): Promise<void> {
    this.assertWritable()
    await this.http.delete(`${this.path}/${encodeURIComponent(id)}`)
    this.bus.touch()
  }

  subscribe(userId: ID, listener: (items: T[]) => void, onError?: (error: Error) => void): () => void {
    let stopped = false
    let running: Promise<void> | null = null
    // A write that lands while a fetch is already under way would otherwise be missed until the next poll,
    // because that fetch may have read the data just before the write. Ask for one more round straight after.
    let again = false
    let last = ''

    const fetchOnce = async () => {
      try {
        const items = await this.list(userId)
        if (stopped) return
        // Polling usually finds nothing new; don't wake every screen for that.
        const signature = JSON.stringify(items)
        if (signature !== last) {
          last = signature
          listener(items)
        }
      } catch (e) {
        if (!stopped) onError?.(e instanceof Error ? e : new Error(String(e)))
      }
    }

    const refresh = (): Promise<void> => {
      if (running) {
        again = true
        return running
      }
      running = (async () => {
        do {
          again = false
          await fetchOnce()
        } while (again && !stopped)
      })().finally(() => {
        running = null
      })
      return running
    }

    void refresh()
    const timer = setInterval(() => document.visibilityState === 'visible' && void refresh(), POLL_MS)
    const wake = () => document.visibilityState === 'visible' && void refresh()
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('online', wake)
    const offBus = this.bus.onChange(() => void refresh())

    return () => {
      stopped = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('online', wake)
      offBus()
    }
  }

  private assertWritable() {
    if (!this.writable) throw new Error('This is changed through its own action, not saved directly')
  }
}
