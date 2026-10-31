import { useCallback, useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createLlmClient, readAiSettings, writeAiSettings } from '@/data/ai/store'
import type { AiSettings } from '@/data/ai/store'
import type { AiSelection, ModelInfo, ProviderId } from '@/domain/ai/types'
import { PROVIDER_IDS } from '@/domain/ai/types'
import { useUserId } from '@/presentation/data/hooks'

/** One copy of the settings per page, so the Providers tab and the agent agree without a reload. */
const listeners = new Set<() => void>()
let cache: { userId: string; value: AiSettings } | null = null

const load = (userId: string): AiSettings => {
  if (cache?.userId !== userId) cache = { userId, value: readAiSettings(userId) }
  return cache.value
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => void listeners.delete(l)
}

/** The keys that were entered and the model in use. Kept in this browser, for this user, and wiped at sign-out. */
export function useAiSettings() {
  const userId = useUserId()
  const settings = useSyncExternalStore(subscribe, () => load(userId))

  const update = useCallback(
    (next: AiSettings) => {
      cache = { userId, value: next }
      writeAiSettings(userId, next)
      listeners.forEach((l) => l())
    },
    [userId],
  )
  const setKey = useCallback(
    (provider: ProviderId, key: string | null) => {
      const current = load(userId)
      const keys = { ...current.keys }
      if (key) keys[provider] = key.trim()
      else delete keys[provider]
      // Removing the provider in use clears the choice that depended on it.
      update({ keys, selection: current.selection?.providerId === provider && !key ? undefined : current.selection })
    },
    [userId, update],
  )
  const setSelection = useCallback((selection: AiSelection | undefined) => update({ ...load(userId), selection }), [userId, update])

  const connected = PROVIDER_IDS.filter((id) => !!settings.keys[id])
  return { settings, connected, setKey, setSelection }
}

/** What a provider offers, asked of the provider itself so it is always current. */
export function useModels(provider: ProviderId | undefined, apiKey: string | undefined) {
  return useQuery<ModelInfo[]>({
    queryKey: ['ai', 'models', provider, apiKey?.slice(-6)],
    queryFn: ({ signal }) => createLlmClient(provider!, apiKey!).listModels(signal),
    enabled: !!provider && !!apiKey,
    staleTime: 10 * 60_000,
    retry: false,
  })
}
