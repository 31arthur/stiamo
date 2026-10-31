import { useEffect, useRef, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import type { LiveState, MailAccount, MailAccountChanges, MailMessage, MailPage, NewMailAccount } from '@/domain/mail/Mail'
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

/**
 * Keeps one folder live. The server holds an IMAP IDLE connection and tells us the moment something arrives, so the list is
 * asked for again only then (nothing is polled). Returns whether the feed is up.
 */
export function useLiveFolder(accountId: string | undefined, folder: string): LiveState {
  const { mail } = useServices()
  const userId = useUserId()
  const client = useQueryClient()
  const [state, setState] = useState<LiveState>('connecting')
  const wasDown = useRef(false)

  useEffect(() => {
    if (!accountId) return
    const abort = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        void client.invalidateQueries({ queryKey: ['mail', userId, accountId, 'list', folder] })
        void client.invalidateQueries({ queryKey: ['mail', userId, accountId, 'folders'] })
      }, 250)
    }
    mail.watch(
      accountId,
      folder,
      (e) => {
        if (e.type === 'changed') return refresh()
        setState(e.state)
        // Whatever arrived while the feed was down is picked up as soon as it is back.
        if (e.state === 'down') wasDown.current = true
        else if (e.state === 'live' && wasDown.current) {
          wasDown.current = false
          refresh()
        }
      },
      abort.signal,
    )
    return () => {
      abort.abort()
      clearTimeout(timer)
    }
  }, [accountId, folder, mail, client, userId])

  return state
}

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
        client.setQueryData<MailMessage>(['mail', userId, v.accountId, 'msg', v.folder, v.uid], (m) => m && { ...m, ...patch })
      },
      onSettled: (_d, _e, v) => client.invalidateQueries({ queryKey: ['mail', userId, v.accountId, 'folders'] }),
    }),
  }
}
