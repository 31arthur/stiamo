import type { SupabaseClient } from '@supabase/supabase-js'
import type { Repository } from '@/domain/shared/Repository'
import type { Entity, ID } from '@/domain/shared/types'
import { describeSupabaseError } from './errors'

const PAGE = 1000
const WRITE_BATCH = 500

interface Row<T> {
  id: string
  data: T
}

interface Listener<T> {
  userId: ID
  listener: (items: T[]) => void
}

/**
 * One aggregate stored as JSON documents in a Postgres table (`id`, `user_id`, `data`). Row-level
 * security scopes every query to the signed-in user. A per-user cache is kept in step with Realtime
 * events and with this client's own writes, so screens update the moment a write is confirmed.
 */
export class SupabaseRepository<T extends Entity> implements Repository<T> {
  private readonly cache = new Map<ID, Map<ID, T>>()
  private readonly listeners = new Set<Listener<T>>()

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly table: string,
  ) {}

  async list(userId: ID): Promise<T[]> {
    return this.fetchAll(userId)
  }

  async get(userId: ID, id: ID): Promise<T | null> {
    const { data, error } = await this.supabase.from(this.table).select('data').eq('user_id', userId).eq('id', id).maybeSingle()
    if (error) throw new Error(describeSupabaseError(error))
    return (data?.data as T | undefined) ?? null
  }

  async save(entity: T): Promise<T> {
    await this.upsert([entity])
    return entity
  }

  async saveMany(entities: T[]): Promise<void> {
    for (let i = 0; i < entities.length; i += WRITE_BATCH) await this.upsert(entities.slice(i, i + WRITE_BATCH))
  }

  async remove(userId: ID, id: ID): Promise<void> {
    const { error } = await this.supabase.from(this.table).delete().eq('user_id', userId).eq('id', id)
    if (error) throw new Error(describeSupabaseError(error))
    this.apply(userId, [], [id])
  }

  subscribe(userId: ID, listener: (items: T[]) => void, onError?: (error: Error) => void): () => void {
    const entry: Listener<T> = { userId, listener }
    this.listeners.add(entry)

    // Overlapping refreshes (initial load + first realtime connect) share one request.
    let inflight: Promise<void> | null = null
    const refresh = () =>
      (inflight ??= (async () => {
        try {
          this.cache.set(userId, new Map((await this.fetchAll(userId)).map((e) => [e.id, e])))
          this.emit(userId)
        } catch (e) {
          onError?.(e instanceof Error ? e : new Error(describeSupabaseError(e)))
        } finally {
          inflight = null
        }
      })())

    const channel = this.supabase
      .channel(`stiamo:${this.table}:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: this.table, filter: `user_id=eq.${userId}` }, (payload) => {
        if (payload.eventType === 'DELETE') this.apply(userId, [], [String((payload.old as { id?: string }).id)])
        else this.apply(userId, [(payload.new as Row<T>).data], [])
      })
      // Every (re)connection refetches, so nothing is missed while the socket was down.
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') void refresh()
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onError?.(new Error(err ? describeSupabaseError(err) : 'Live updates are unavailable — reconnecting…'))
      })

    // Show data right away; the realtime connection can take a moment to open.
    void refresh()

    return () => {
      this.listeners.delete(entry)
      void this.supabase.removeChannel(channel)
    }
  }

  private async fetchAll(userId: ID): Promise<T[]> {
    const items: T[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.supabase
        .from(this.table)
        .select('id, data')
        .eq('user_id', userId)
        .order('id')
        .range(from, from + PAGE - 1)
      if (error) throw new Error(describeSupabaseError(error))
      items.push(...(data as Row<T>[]).map((r) => r.data))
      if (data.length < PAGE) return items
    }
  }

  private async upsert(entities: T[]) {
    const rows = entities.map((e) => ({ id: e.id, user_id: e.userId, data: e, updated_at: e.updatedAt }))
    const { error } = await this.supabase.from(this.table).upsert(rows, { onConflict: 'user_id,id' })
    if (error) throw new Error(describeSupabaseError(error))
    for (const userId of new Set(entities.map((e) => e.userId))) this.apply(userId, entities.filter((e) => e.userId === userId), [])
  }

  /** Merges changes into the cache and tells subscribers (only when something actually changed). */
  private apply(userId: ID, upserts: T[], removals: ID[]) {
    const bucket = this.cache.get(userId) ?? new Map<ID, T>()
    let changed = false
    for (const e of upserts) {
      const current = bucket.get(e.id)
      if (!current || current.updatedAt !== e.updatedAt || JSON.stringify(current) !== JSON.stringify(e)) {
        bucket.set(e.id, e)
        changed = true
      }
    }
    for (const id of removals) changed = bucket.delete(id) || changed
    this.cache.set(userId, bucket)
    if (changed) this.emit(userId)
  }

  private emit(userId: ID) {
    const items = [...(this.cache.get(userId)?.values() ?? [])]
    for (const l of this.listeners) if (l.userId === userId) l.listener(items)
  }
}
