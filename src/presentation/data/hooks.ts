import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Container } from '@/di/container'
import type { EntityMap } from '@/domain/shared/registry'
import { toISODate } from '@/domain/shared/time'
import type { EntityKind, ID, ISODate } from '@/domain/shared/types'
import { useServices } from '@/presentation/app/services'
import { useAuth } from '@/presentation/auth/AuthProvider'

export function useUserId(): ID {
  const { user } = useAuth()
  if (!user) throw new Error('No signed-in user')
  return user.id
}

export const useToday = (): ISODate => toISODate(new Date())

/** All records of one kind for the signed-in user. */
export function useEntities<K extends EntityKind>(kind: K) {
  const { crud } = useServices()
  const userId = useUserId()
  const query = useQuery({
    queryKey: ['entities', kind, userId],
    queryFn: () => crud[kind].list(userId) as Promise<EntityMap[K][]>,
  })
  return { data: query.data ?? (EMPTY as EntityMap[K][]), isLoading: query.isLoading }
}
const EMPTY: never[] = []

export function useEntity<K extends EntityKind>(kind: K, id: ID | undefined): EntityMap[K] | undefined {
  const { data } = useEntities(kind)
  return useMemo(() => data.find((e) => e.id === id), [data, id])
}

export function useAgenda(from: ISODate, to: ISODate) {
  const { agenda } = useServices()
  const userId = useUserId()
  const query = useQuery({ queryKey: ['agenda', userId, from, to], queryFn: () => agenda.range(userId, from, to) })
  return { data: query.data ?? EMPTY, isLoading: query.isLoading, queryKey: ['agenda', userId, from, to] as const }
}

interface ActionOptions<TResult> {
  /** Toast shown on success; a function receives the result. */
  success?: string | ((result: TResult) => string | undefined)
}

/**
 * Wraps a use-case call as a mutation: errors become toasts and every success refreshes all reads
 * (everything is linked — a hearing write-up touches cases, plans, tasks and the agenda).
 */
export function useAction<TArgs, TResult>(
  run: (services: Container, userId: ID, args: TArgs) => Promise<TResult>,
  options: ActionOptions<TResult> = {},
) {
  const services = useServices()
  const userId = useUserId()
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: (args: TArgs) => run(services, userId, args),
    onSuccess: (result) => {
      const message = typeof options.success === 'function' ? options.success(result) : options.success
      if (message) toast.success(message)
      return client.invalidateQueries()
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Something went wrong'),
  })
  return { run: mutation.mutateAsync, pending: mutation.isPending }
}

/** Generic create/update/remove for a kind. */
export function useSave<K extends EntityKind>(kind: K, success?: string) {
  return useAction<EntityMap[K] | Omit<EntityMap[K], 'id' | 'userId' | 'createdAt' | 'updatedAt'>, EntityMap[K]>(
    (s, userId, input) =>
      ('createdAt' in input ? s.crud[kind].update(input as never) : s.crud[kind].create(userId, input as never)) as Promise<EntityMap[K]>,
    { success },
  )
}

export function useRemove(kind: EntityKind, success = 'Deleted') {
  return useAction<ID, void>((s, userId, id) => s.crud[kind].remove(userId, id), { success })
}
