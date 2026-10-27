import { useMemo } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Container } from '@/di/container'
import { buildAgenda } from '@/domain/agenda/agenda'
import { RelationGraph } from '@/domain/relations/graph'
import type { EntityMap, StoreKind } from '@/domain/shared/registry'
import type { EntityKind, ID, ISODate } from '@/domain/shared/types'
import { useServices } from '@/presentation/app/services'
import { useAuth } from '@/presentation/auth/AuthProvider'
import { entitiesKey } from './live'

export function useUserId(): ID {
  const { user } = useAuth()
  if (!user) throw new Error('No signed-in user')
  return user.id
}

export { useToday } from './clock'

const EMPTY: never[] = []

/**
 * All records of one kind for the signed-in user. Filled and kept current by LiveDataProvider's
 * subscriptions, so this never fetches on its own.
 */
export function useEntities<K extends StoreKind>(kind: K) {
  const userId = useUserId()
  const { crud } = useServices()
  // Data arrives through live subscriptions; the fetch is only a fallback for explicit refetches.
  const query = useQuery<EntityMap[K][]>({
    queryKey: entitiesKey(kind, userId),
    queryFn: () => crud[kind].list(userId) as Promise<EntityMap[K][]>,
    enabled: false,
  })
  return { data: query.data ?? (EMPTY as EntityMap[K][]), isLoading: query.data === undefined }
}

export function useEntity<K extends StoreKind>(kind: K, id: ID | undefined): EntityMap[K] | undefined {
  const { data } = useEntities(kind)
  return useMemo(() => data.find((e) => e.id === id), [data, id])
}

/** The unified agenda for a date range, derived live from the cached collections. */
export function useAgenda(from: ISODate, to: ISODate) {
  const tasks = useEntities('task')
  const meetings = useEntities('meeting')
  const followUps = useEntities('followUp')
  const hearings = useEntities('hearing')
  const cases = useEntities('case')
  const data = useMemo(
    () => buildAgenda({ tasks: tasks.data, meetings: meetings.data, followUps: followUps.data, hearings: hearings.data, cases: cases.data }, from, to),
    [tasks.data, meetings.data, followUps.data, hearings.data, cases.data, from, to],
  )
  return { data, isLoading: tasks.isLoading || meetings.isLoading || followUps.isLoading || hearings.isLoading }
}

interface ActionOptions<TResult> {
  /** Toast shown on success; a function receives the result. */
  success?: string | ((result: TResult) => string | undefined)
}

/**
 * Wraps a use-case call as a mutation; errors become toasts. No manual refresh is needed:
 * live subscriptions deliver the change to every screen (and every device).
 */
export function useAction<TArgs, TResult>(run: (services: Container, userId: ID, args: TArgs) => Promise<TResult>, options: ActionOptions<TResult> = {}) {
  const services = useServices()
  const userId = useUserId()
  const mutation = useMutation({
    mutationFn: (args: TArgs) => run(services, userId, args),
    onSuccess: (result) => {
      const message = typeof options.success === 'function' ? options.success(result) : options.success
      if (message) toast.success(message)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Something went wrong'),
  })
  return { run: mutation.mutateAsync, pending: mutation.isPending }
}

/** Generic create/update for a kind. */
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

/** The live relationship graph over every record and hand-made link. */
export function useGraph() {
  const tasks = useEntities('task').data
  const meetings = useEntities('meeting').data
  const followUps = useEntities('followUp').data
  const cases = useEntities('case').data
  const hearings = useEntities('hearing').data
  const plans = useEntities('plan').data
  const goals = useEntities('goal').data
  const counsel = useEntities('counsel').data
  const clients = useEntities('client').data
  const projects = useEntities('project').data
  const links = useEntities('link').data
  return useMemo(
    () => new RelationGraph({ tasks, meetings, followUps, cases, hearings, plans, goals, counsel, clients, projects, links }),
    [tasks, meetings, followUps, cases, hearings, plans, goals, counsel, clients, projects, links],
  )
}
