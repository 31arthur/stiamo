import { useCallback, useMemo } from 'react'
import type { LucideIcon } from 'lucide-react'
import { KIND_LABEL } from '@/domain/activity/describe'
import type { Outcome } from '@/domain/shared/outcome'
import type { EntityKind, EntityRef } from '@/domain/shared/types'
import type { WorkspaceId } from '@/domain/shared/workspace'
import { counselLabel } from '@/domain/counsel/Counsel'
import { useEntities } from '@/presentation/data/hooks'
import { KIND_META, MEETING_KIND_ICON } from './kinds'

export interface RecordInfo {
  ref: EntityRef
  title: string
  kindLabel: string
  icon: LucideIcon
  outcome?: Outcome
  workspace?: WorkspaceId
  /** Extra context, e.g. a case reference or a date. */
  subtitle?: string
}

/** Resolves any reference to what's needed to show it: title, icon, status, workspace. */
export function useRecordLookup() {
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

  const index = useMemo(() => {
    const map = new Map<string, RecordInfo>()
    const put = (info: RecordInfo) => map.set(`${info.ref.kind}:${info.ref.id}`, info)
    const base = (kind: EntityKind, id: string) => ({ ref: { kind, id }, kindLabel: KIND_LABEL[kind], icon: KIND_META[kind].icon })
    for (const t of tasks) put({ ...base('task', t.id), title: t.title, outcome: t.outcome, workspace: t.workspace, subtitle: t.dueDate })
    for (const m of meetings)
      put({ ...base('meeting', m.id), title: m.title, kindLabel: m.kind === 'appointment' ? 'Appointment' : 'Meeting', icon: MEETING_KIND_ICON[m.kind], outcome: m.outcome, workspace: m.workspace, subtitle: m.slot.date })
    for (const f of followUps) put({ ...base('followUp', f.id), title: f.title, outcome: f.outcome, workspace: f.workspace, subtitle: f.due?.date })
    for (const c of cases) put({ ...base('case', c.id), title: c.title, workspace: 'sb', subtitle: c.reference })
    for (const h of hearings) {
      const c = cases.find((x) => x.id === h.caseId)
      put({ ...base('hearing', h.id), title: `${h.purpose}`, outcome: h.outcome, workspace: 'sb', subtitle: [c?.reference, h.date].filter(Boolean).join(' · ') })
    }
    for (const p of plans) put({ ...base('plan', p.id), title: p.title, workspace: p.workspace, subtitle: p.dueDate })
    for (const g of goals) put({ ...base('goal', g.id), title: g.title, workspace: g.workspace })
    for (const c of counsel) put({ ...base('counsel', c.id), title: counselLabel(c), kindLabel: c.kind === 'firm' ? 'Law firm' : 'Advocate', workspace: 'sb', subtitle: c.city })
    for (const c of clients) put({ ...base('client', c.id), title: c.name, workspace: 'fsa', subtitle: c.contactName })
    for (const p of projects) put({ ...base('project', p.id), title: p.title, workspace: 'fsa', subtitle: clients.find((c) => c.id === p.clientId)?.name })
    return map
  }, [tasks, meetings, followUps, cases, hearings, plans, goals, counsel, clients, projects])

  const lookup = useCallback((ref: EntityRef | undefined) => (ref ? index.get(`${ref.kind}:${ref.id}`) : undefined), [index])
  return { lookup, all: index }
}
