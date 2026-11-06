import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import type { Contact, ContactsStatus } from '@/domain/contacts/Contacts'
import type { WorkspaceScope } from '@/domain/shared/workspace'
import { useServices } from '@/presentation/app/services'
import { useUserId } from '@/presentation/data/hooks'

/** Google contacts live in the Stiamo backend. */
export function useContactsAvailable() {
  return useServices().backend === 'api'
}

/** The Google accounts linked for contacts. A server that doesn't have the service yet answers with an error, which the panel explains. */
export function useContactsStatus() {
  const { contacts } = useServices()
  const userId = useUserId()
  const enabled = useContactsAvailable()
  return useQuery<ContactsStatus>({ queryKey: ['contacts', userId, 'status'], queryFn: () => contacts.status(), enabled, staleTime: 30_000, retry: false })
}

const EMPTY: Contact[] = []

/** One workspace's contacts (or everyone's), matching what was typed. `limit` grows as more are asked for. */
export function useContactList(scope: WorkspaceScope, q: string, limit: number, enabled: boolean) {
  const { contacts } = useServices()
  const userId = useUserId()
  const query = useQuery({ queryKey: ['contacts', userId, 'list', scope, q, limit], queryFn: () => contacts.list(scope, q, limit), enabled, staleTime: 60_000, placeholderData: (prev) => prev, retry: false })
  return { items: query.data?.items ?? EMPTY, total: query.data?.total ?? 0, loading: query.isLoading, error: query.error instanceof Error ? query.error.message : null }
}

/** Reads the contacts again now, for one account link or all of them, then refreshes what is shown. */
export function useContactsSync() {
  const { contacts } = useServices()
  const client = useQueryClient()
  const userId = useUserId()
  const [syncing, setSyncing] = useState(false)
  const sync = useCallback(
    async (accountId?: string) => {
      setSyncing(true)
      try {
        return await contacts.sync(accountId)
      } finally {
        setSyncing(false)
        await client.invalidateQueries({ queryKey: ['contacts', userId] })
      }
    },
    [contacts, client, userId],
  )
  return { sync, syncing }
}
