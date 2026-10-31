import { useEffect, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { DriveMatch } from '@/domain/drive/Drive'
import { useServices } from '@/presentation/app/services'
import { useUserId } from '@/presentation/data/hooks'

/** The value, once it has stopped changing for `ms`: so typing doesn't send a search per keystroke. */
export function useDebounced<T>(value: T, ms = 350): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return settled
}

/** Whether Drive search can be used here (it needs the Stiamo backend, a connected Drive, and your email on the list). */
export function useDriveStatus() {
  const services = useServices()
  const userId = useUserId()
  const enabled = services.backend === 'api'
  const query = useQuery({
    queryKey: ['drive', 'status', userId],
    queryFn: () => services.drive.status().catch(() => ({ available: false })),
    enabled,
    staleTime: 5 * 60_000,
  })
  return { available: enabled && query.data?.available === true, folder: (query.data as { folder?: string } | undefined)?.folder }
}

/** Files whose name or contents contain every word. Pages are fetched on request (`fetchNextPage`). */
/** With `minChars` of 0 an empty search lists the newest files. */
export function useDriveSearch(text: string, enabled: boolean, minChars = 2) {
  const services = useServices()
  const userId = useUserId()
  const query = text.trim()
  const result = useInfiniteQuery({
    queryKey: ['drive', 'search', userId, query],
    queryFn: ({ pageParam }) => services.drive.search(query, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextPageToken,
    enabled: enabled && query.length >= minChars,
    staleTime: 60_000,
  })
  return {
    files: result.data?.pages.flatMap((p) => p.items) ?? [],
    loading: result.isFetching && !result.isFetchingNextPage,
    loadingMore: result.isFetchingNextPage,
    hasMore: result.hasNextPage,
    loadMore: () => void result.fetchNextPage(),
    error: result.error instanceof Error ? result.error.message : null,
  }
}

/** Files that mention any of the details of a record, best match first. */
export function useDriveSuggestions(terms: string[], enabled: boolean) {
  const services = useServices()
  const userId = useUserId()
  const result = useQuery<DriveMatch[]>({
    queryKey: ['drive', 'suggest', userId, terms.join('\u0001')],
    queryFn: () => services.drive.suggest(terms),
    enabled: enabled && terms.length > 0,
    staleTime: 60_000,
  })
  return { matches: result.data ?? [], loading: result.isFetching, error: result.error instanceof Error ? result.error.message : null }
}
