import type { EntityRef } from '@/domain/shared/types'
import type { WorkspaceId } from '@/domain/shared/workspace'
import { LINKS_BY_WORKSPACE } from '@/domain/stories/Stories'
import { useEntities } from '@/presentation/data/hooks'

export interface Linkable {
  ref: EntityRef
  kind: string
  label: string
}

/** The records a workspace's stories can cover: cases for S&B, projects and clients for FSA, nothing elsewhere. */
export function useLinkables(workspace: WorkspaceId): Linkable[] {
  const { data: cases } = useEntities('case')
  const { data: projects } = useEntities('project')
  const { data: clients } = useEntities('client')
  const kinds = LINKS_BY_WORKSPACE[workspace]
  const out: Linkable[] = []
  if (kinds.includes('case')) for (const c of cases) out.push({ ref: { kind: 'case', id: c.id }, kind: 'Case', label: `${c.reference} · ${c.title}` })
  if (kinds.includes('project'))
    for (const p of projects) out.push({ ref: { kind: 'project', id: p.id }, kind: 'Project', label: `${clients.find((x) => x.id === p.clientId)?.name ?? 'Client'} · ${p.title}` })
  if (kinds.includes('client')) for (const c of clients) out.push({ ref: { kind: 'client', id: c.id }, kind: 'Client', label: c.name })
  return out.sort((a, b) => a.label.localeCompare(b.label))
}
