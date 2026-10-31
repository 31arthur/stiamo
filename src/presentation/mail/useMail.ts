import { useEffect, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import type { LiveState, MailAccount, MailAccountChanges, MailMessage, MailPage, MailSummary, NewMailAccount } from '@/domain/mail/Mail'
import { useServices } from '@/presentation/app/services'
import { useUserId } from '@/presentation/data/hooks'

/** Mail lives in the Stiamo backend. */
export function useMailAvailable() {
  return useServices().backend === 'api'
}

/** Mail is read from the server each time, so a cached answer is only good for a moment. */
const FRESH = 20_000

export function useMailAccounts() {
  const { mail } = useServices()
  const userId = useUserId()
  const enabled = useMailAvailable()
  const query = useQuery<MailAccount[]>({ queryKey: ['mail', userId, 'accounts'], queryFn: () => mail.accounts(), enabled, staleTime: 60_000 })
  return { accounts: query.data ?? [], loading: enabled && query.isLoading, error: query.error instanceof Error ? query.error.message : null }
}

export function useFolders(accountId: string | undefined) {
  const { mail } = useServices()
  const userId = useUserId()
  return useQuery({ queryKey: ['mail', userId, accountId, 'folders'], queryFn: () => mail.folders(accountId!), enabled: !!accountId, staleTime: FRESH })
}

export function useMessages(accountId: string | undefined, folder: string, q: string) {
  const { mail } = useServices()
  const userId = useUserId()
  const query = useInfiniteQuery({
    queryKey: ['mail', userId, accountId, 'list', folder, q],
    queryFn: ({ pageParam }) => mail.page(accountId!, folder, { before: pageParam, q }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => last.nextBefore ?? undefined,
    enabled: !!accountId,
    staleTime: FRESH,
  })
  const pages = query.data?.pages ?? []
  return {
    messages: pages.flatMap((p) => p.messages),
    total: pages[0]?.total ?? 0,
    loading: query.isLoading,
    refreshing: query.isFetching && !query.isLoading && !query.isFetchingNextPage,
    more: query.hasNextPage,
    loadingMore: query.isFetchingNextPage,
    loadMore: () => void query.fetchNextPage(),
    error: query.error instanceof Error ? query.error.message : null,
  }
}

export function useMessage(accountId: string | undefined, folder: string, uid: number | undefined) {
  const { mail } = useServices()
  const userId = useUserId()
  return useQuery<MailMessage>({ queryKey: ['mail', userId, accountId, 'msg', folder, uid], queryFn: () => mail.message(accountId!, folder, uid!), enabled: !!accountId && uid !== undefined, staleTime: 5 * 60_000 })
}

export interface UnifiedSummary extends MailSummary {
  accountId: string
}

type Cursors = Record<string, number | null | undefined>

/**
 * The inboxes of several mailboxes read together, newest first. Each mailbox is paged separately (its own "before"), the pages are
 * merged by date, and one mailbox being unreachable doesn't hide the others: its problem is reported alongside.
 */
export function useUnifiedMessages(accounts: MailAccount[], q: string, enabled: boolean) {
  const { mail } = useServices()
  const userId = useUserId()
  const ids = accounts.map((a) => a.id)
  const query = useInfiniteQuery({
    queryKey: ['mail', userId, 'unified', ids.join(','), q],
    queryFn: async ({ pageParam }) => {
      const cursors: Cursors = pageParam ?? {}
      const asked = accounts.filter((a) => cursors[a.id] !== null)
      const results = await Promise.allSettled(asked.map((a) => mail.page(a.id, 'INBOX', { before: cursors[a.id] ?? undefined, q })))
      const next: Cursors = {}
      const items: UnifiedSummary[] = []
      const problems: string[] = []
      let total = 0
      asked.forEach((a, i) => {
        const r = results[i]
        if (r.status === 'fulfilled') {
          items.push(...r.value.messages.map((m) => ({ ...m, accountId: a.id })))
          next[a.id] = r.value.nextBefore
          total += r.value.total
        } else {
          next[a.id] = null
          problems.push(`${a.label}: ${r.reason instanceof Error ? r.reason.message : 'couldn’t be read'}`)
        }
      })
      for (const a of accounts) if (!(a.id in next)) next[a.id] = null
      return { items, next, problems, total }
    },
    initialPageParam: undefined as Cursors | undefined,
    getNextPageParam: (last) => (Object.values(last.next).some((v) => typeof v === 'number') ? last.next : undefined),
    enabled: enabled && accounts.length > 0,
    staleTime: FRESH,
  })
  const pages = query.data?.pages ?? []
  const when = (m: MailSummary) => (m.date ? Date.parse(m.date) : 0)
  return {
    messages: pages.flatMap((p) => p.items).sort((x, y) => when(y) - when(x)),
    total: pages[0]?.total ?? 0,
    problems: pages.flatMap((p) => p.problems),
    loading: query.isLoading,
    refreshing: query.isFetching && !query.isLoading && !query.isFetchingNextPage,
    more: query.hasNextPage,
    loadingMore: query.isFetchingNextPage,
    loadMore: () => void query.fetchNextPage(),
  }
}

const WORST: LiveState[] = ['auth', 'down', 'connecting', 'live']

/**
 * Keeps folders live. For each mailbox the server holds an IMAP IDLE connection and tells us the moment something arrives, so the
 * list is asked for again only then (nothing is polled). Returns the state of the feed: the worst one when there are several.
 */
export function useLiveFolders(accountIds: string[], folder: string): LiveState {
  const { mail } = useServices()
  const userId = useUserId()
  const client = useQueryClient()
  const [states, setStates] = useState<Record<string, LiveState>>({})
  const key = accountIds.join(',')

  useEffect(() => {
    const abort = new AbortController()
    const down = new Set<string>()
    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = (id: string) => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        void client.invalidateQueries({ queryKey: ['mail', userId, id, 'list', folder] })
        void client.invalidateQueries({ queryKey: ['mail', userId, id, 'folders'] })
        void client.invalidateQueries({ queryKey: ['mail', userId, 'unified'] })
      }, 250)
    }
    for (const id of key ? key.split(',') : []) {
      mail.watch(
        id,
        folder,
        (e) => {
          if (e.type === 'changed') return refresh(id)
          setStates((prev) => ({ ...prev, [id]: e.state }))
          // Whatever arrived while the feed was down is picked up as soon as it is back.
          if (e.state === 'down') down.add(id)
          else if (e.state === 'live' && down.delete(id)) refresh(id)
        },
        abort.signal,
      )
    }
    return () => {
      abort.abort()
      clearTimeout(timer)
    }
  }, [key, folder, mail, client, userId])

  const current = accountIds.map((id) => states[id] ?? 'connecting')
  return WORST.find((s) => current.includes(s)) ?? 'connecting'
}

/** One mailbox's folder, kept live. */
export const useLiveFolder = (accountId: string | undefined, folder: string) => useLiveFolders(accountId ? [accountId] : [], folder)

export function useMailActions() {
  const { mail } = useServices()
  const userId = useUserId()
  const client = useQueryClient()
  const accountsKey = ['mail', userId, 'accounts']
  const refreshAccounts = () => client.invalidateQueries({ queryKey: accountsKey })

  return {
    connect: useMutation({ mutationFn: (a: NewMailAccount) => mail.connect(a), onSuccess: refreshAccounts }),
    edit: useMutation({ mutationFn: (v: { id: string; changes: MailAccountChanges }) => mail.edit(v.id, v.changes), onSuccess: refreshAccounts }),
    disconnect: useMutation({
      mutationFn: (id: string) => mail.disconnect(id),
      onSuccess: async (_r, id) => {
        client.removeQueries({ queryKey: ['mail', userId, id] })
        await refreshAccounts()
      },
    }),
    test: useMutation({ mutationFn: (id: string) => mail.test(id), onSettled: refreshAccounts }),
    /** Marks a message seen or flagged. The list and the open message change at once; the server follows. */
    mark: useMutation({
      mutationFn: (v: { accountId: string; folder: string; uid: number; seen?: boolean; flagged?: boolean }) => mail.mark(v.accountId, v.folder, v.uid, { seen: v.seen, flagged: v.flagged }),
      onMutate: (v) => {
        const patch = { ...(v.seen !== undefined && { seen: v.seen }), ...(v.flagged !== undefined && { flagged: v.flagged }) }
        client.setQueriesData<InfiniteData<MailPage>>({ queryKey: ['mail', userId, v.accountId, 'list', v.folder] }, (data) => data && { ...data, pages: data.pages.map((p) => ({ ...p, messages: p.messages.map((m) => (m.uid === v.uid ? { ...m, ...patch } : m)) })) })
        client.setQueriesData<InfiniteData<{ items: UnifiedSummary[] }>>({ queryKey: ['mail', userId, 'unified'] }, (data) => data && { ...data, pages: data.pages.map((p) => ({ ...p, items: p.items.map((m) => (m.accountId === v.accountId && m.uid === v.uid ? { ...m, ...patch } : m)) })) })
        client.setQueryData<MailMessage>(['mail', userId, v.accountId, 'msg', v.folder, v.uid], (m) => m && { ...m, ...patch })
      },
      onSettled: (_d, _e, v) => client.invalidateQueries({ queryKey: ['mail', userId, v.accountId, 'folders'] }),
    }),
  }
}
