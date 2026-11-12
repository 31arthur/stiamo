import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import type { Character, Story } from '@/domain/stories/Stories'
import { useServices } from '@/presentation/app/services'
import { useUserId } from '@/presentation/data/hooks'
import { toast } from '@/presentation/notifications/toast'

/** Stories live in the Stiamo backend. */
export function useStoriesAvailable() {
  return useServices().backend === 'api'
}

const NO_STORIES: Story[] = []
const NO_CHARACTERS: Character[] = []

export function useStoryList() {
  const { stories } = useServices()
  const userId = useUserId()
  const enabled = useStoriesAvailable()
  const q = useQuery({ queryKey: ['stories', userId, 'list'], queryFn: () => stories.stories(), enabled, staleTime: 30_000, retry: false })
  return { items: q.data ?? NO_STORIES, loading: q.isLoading, error: q.error instanceof Error ? q.error.message : null }
}

export function useTimeline(id: string | undefined) {
  const { stories } = useServices()
  const userId = useUserId()
  const available = useStoriesAvailable()
  return useQuery({ queryKey: ['stories', userId, 'timeline', id], queryFn: () => stories.timeline(id!), enabled: !!id && available, staleTime: 15_000, retry: false })
}

/** The editor's read of every story: its pace, how quiet, the step of the ladder, and its push score. */
export function useEditorOverview() {
  const { stories } = useServices()
  const userId = useUserId()
  return useQuery({ queryKey: ['stories', userId, 'editor'], queryFn: () => stories.editor(), enabled: useStoriesAvailable(), staleTime: 60_000, retry: false })
}

export function useArcTemplates() {
  const { stories } = useServices()
  const userId = useUserId()
  return useQuery({ queryKey: ['stories', userId, 'templates'], queryFn: () => stories.arcTemplates(), enabled: useStoriesAvailable(), staleTime: 60_000, retry: false })
}

export function useCharacters() {
  const { stories } = useServices()
  const userId = useUserId()
  const q = useQuery({ queryKey: ['stories', userId, 'characters'], queryFn: () => stories.characters(), enabled: useStoriesAvailable(), staleTime: 30_000, retry: false })
  return { items: q.data ?? NO_CHARACTERS, loading: q.isLoading, error: q.error instanceof Error ? q.error.message : null }
}

export function useParts() {
  const { stories } = useServices()
  const userId = useUserId()
  return useQuery({ queryKey: ['stories', userId, 'parts'], queryFn: () => stories.parts(), enabled: useStoriesAvailable(), staleTime: 30_000, retry: false })
}

export function useCharacterView(id: string | undefined) {
  const { stories } = useServices()
  const userId = useUserId()
  const available = useStoriesAvailable()
  return useQuery({ queryKey: ['stories', userId, 'character', id], queryFn: () => stories.character(id!), enabled: !!id && available, staleTime: 15_000, retry: false })
}

export function useEvidence() {
  const { stories } = useServices()
  const userId = useUserId()
  return useQuery({ queryKey: ['stories', userId, 'evidence'], queryFn: () => stories.evidence(), enabled: useStoriesAvailable(), staleTime: 30_000, retry: false })
}

export function useJobs(enabled = true) {
  const { stories } = useServices()
  const userId = useUserId()
  const available = useStoriesAvailable()
  return useQuery({ queryKey: ['stories', userId, 'jobs'], queryFn: () => stories.jobs(), enabled: enabled && available, staleTime: 60_000, retry: false })
}

/** Runs a change, says how it went, and refreshes everything about stories (they're linked: a chapter moves a story, makes tasks, adds people). */
export function useStoryAction() {
  const services = useServices()
  const client = useQueryClient()
  const userId = useUserId()
  const [busy, setBusy] = useState(false)
  const run = useCallback(
    async <T>(fn: (s: typeof services) => Promise<T>, messages: { success?: string; failure?: string } = {}): Promise<T | undefined> => {
      setBusy(true)
      try {
        const out = await fn(services)
        if (messages.success) toast.success(messages.success)
        return out
      } catch (e) {
        toast.error(messages.failure ?? 'That didn’t work', { description: e instanceof Error ? e.message : undefined })
        return undefined
      } finally {
        setBusy(false)
        await client.invalidateQueries({ queryKey: ['stories', userId] })
      }
    },
    [services, client, userId],
  )
  const refresh = useCallback(() => client.invalidateQueries({ queryKey: ['stories', userId] }), [client, userId])
  return { run, busy, refresh }
}
