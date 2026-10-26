import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { StoreKind } from '@/domain/shared/registry'
import { useServices } from '@/presentation/app/services'
import { useAuth } from '@/presentation/auth/AuthProvider'

export const LIVE_KINDS: StoreKind[] = ['task', 'meeting', 'followUp', 'case', 'hearing', 'plan', 'goal', 'counsel', 'link', 'activity', 'attachment']

export const entitiesKey = (kind: StoreKind, userId: string) => ['entities', kind, userId] as const

export interface SyncState {
  /** Every collection has delivered its first snapshot. */
  ready: boolean
  online: boolean
  /** The most recent subscription error (missing database, rules…), if any. */
  error: string | null
  mode: 'supabase' | 'local'
}

const SyncContext = createContext<SyncState>({ ready: false, online: true, error: null, mode: 'local' })

/**
 * Opens one live subscription per collection for the signed-in user and pours every snapshot into the
 * query cache. Screens read from that cache, so edits — here or on another device — appear instantly.
 */
export function LiveDataProvider({ children }: { children: ReactNode }) {
  const services = useServices()
  const { user } = useAuth()
  const client = useQueryClient()
  const [seen, setSeen] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    if (!user) return
    const first = new Set<StoreKind>()
    const unsubscribes = LIVE_KINDS.map((kind) =>
      services.live.subscribe(
        kind,
        user.id,
        (items) => {
          client.setQueryData(entitiesKey(kind, user.id), items)
          if (!first.has(kind)) {
            first.add(kind)
            setSeen(first.size)
          }
          setError(null)
        },
        (e) => setError(e.message),
      ),
    )
    return () => {
      unsubscribes.forEach((u) => u())
      setSeen(0)
    }
  }, [services, user, client])

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  const state: SyncState = { ready: seen === LIVE_KINDS.length, online, error, mode: services.backend }
  return <SyncContext.Provider value={state}>{children}</SyncContext.Provider>
}

export const useSync = () => useContext(SyncContext)
