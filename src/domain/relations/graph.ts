import { hearingCaseIds } from '../cases/LegalCase'
import type { Hearing, LegalCase } from '../cases/LegalCase'
import type { FollowUp } from '../followups/FollowUp'
import type { Client, Project } from '../clients/Client'
import type { Counsel } from '../counsel/Counsel'
import type { Goal } from '../goals/Goal'
import type { Meeting } from '../meetings/Meeting'
import { planCaseIds, planHearingIds } from '../plans/ActionPlan'
import type { ActionPlan } from '../plans/ActionPlan'
import type { EntityKind, EntityRef, ID } from '../shared/types'
import type { Task } from '../tasks/Task'
import type { Link } from './Link'

/** How two records are connected. Parent → child for structure; `linked` is a hand-made peer link. */
export type RelationKind =
  | 'step' // plan → task
  | 'about' // case/meeting/… → follow-up, meeting, task
  | 'spawned' // record → task/follow-up created as its further action
  | 'hearing' // case → hearing
  | 'next_hearing' // hearing → hearing
  | 'plan' // case/hearing/meeting/goal → action plan
  | 'prep' // meeting → preparation plan
  | 'goal' // goal → plan it's served by
  | 'counsel' // counsel → case they're briefed on
  | 'project' // client → project
  | 'linked'

export const RELATION_LABELS: Record<RelationKind, string> = {
  step: 'Step',
  about: 'About',
  spawned: 'Further action',
  hearing: 'Hearing',
  next_hearing: 'Next hearing',
  plan: 'Action plan',
  prep: 'Preparation',
  goal: 'Serves goal',
  counsel: 'Engaged counsel',
  project: 'Project',
  linked: 'Linked',
}

export interface Edge {
  parent: EntityRef
  child: EntityRef
  kind: RelationKind
  /** Set on hand-made links so they can be removed. */
  linkId?: ID
}

export interface GraphSources {
  tasks: Task[]
  meetings: Meeting[]
  followUps: FollowUp[]
  cases: LegalCase[]
  hearings: Hearing[]
  plans: ActionPlan[]
  goals: Goal[]
  counsel: Counsel[]
  clients: Client[]
  projects: Project[]
  links: Link[]
}

/** Records that other records are "about": a case, a client, a project. */
const ABOUT_KINDS = new Set<EntityKind>(['case', 'client', 'project'])

export const refKey = (r: EntityRef) => `${r.kind}:${r.id}`

export interface Neighbor {
  ref: EntityRef
  kind: RelationKind
  direction: 'parent' | 'child' | 'peer'
  linkId?: ID
}

export interface ThreadNode {
  ref: EntityRef
  kind?: RelationKind
  children: ThreadNode[]
}

export interface Thread {
  /** Chain(s) of records above the root, nearest first. */
  ancestors: Neighbor[]
  /** Everything that grew out of the root, as a tree. */
  tree: ThreadNode
  peers: Neighbor[]
  /** Every record in the thread, root included. */
  members: EntityRef[]
}

/** The connection graph over all records: structural relations plus hand-made links. */
export class RelationGraph {
  private readonly up = new Map<string, Edge[]>()
  private readonly down = new Map<string, Edge[]>()
  private readonly peers = new Map<string, Edge[]>()
  private readonly exists = new Set<string>()

  constructor(src: GraphSources) {
    const reg = (kind: EntityKind, ids: { id: ID }[]) => ids.forEach((e) => this.exists.add(`${kind}:${e.id}`))
    reg('task', src.tasks)
    reg('meeting', src.meetings)
    reg('followUp', src.followUps)
    reg('case', src.cases)
    reg('hearing', src.hearings)
    reg('plan', src.plans)
    reg('goal', src.goals)
    reg('counsel', src.counsel)
    reg('client', src.clients)
    reg('project', src.projects)

    const ref = (kind: EntityKind, id: ID): EntityRef => ({ kind, id })
    for (const t of src.tasks) {
      if (t.planId) this.add({ parent: ref('plan', t.planId), child: ref('task', t.id), kind: 'step' })
      // A step's plan is its parent; its `related` (the plan's origin) would only duplicate the path.
      if (t.related && !t.planId) {
        this.add({ parent: t.related, child: ref('task', t.id), kind: ABOUT_KINDS.has(t.related.kind) ? 'about' : 'spawned' })
      }
    }
    for (const f of src.followUps) {
      if (f.planId) this.add({ parent: ref('plan', f.planId), child: ref('followUp', f.id), kind: 'step' })
      else if (f.subject) this.add({ parent: f.subject, child: ref('followUp', f.id), kind: ABOUT_KINDS.has(f.subject.kind) || f.subject.kind === 'meeting' ? 'about' : 'spawned' })
    }
    for (const m of src.meetings) {
      if (m.planId) this.add({ parent: ref('plan', m.planId), child: ref('meeting', m.id), kind: 'step' })
      else if (m.related) this.add({ parent: m.related, child: ref('meeting', m.id), kind: 'about' })
      if (m.prepPlanId) this.add({ parent: ref('meeting', m.id), child: ref('plan', m.prepPlanId), kind: 'prep' })
    }
    for (const h of src.hearings) {
      for (const cid of hearingCaseIds(h)) this.add({ parent: ref('case', cid), child: ref('hearing', h.id), kind: 'hearing' })
      if (h.nextHearingId) this.add({ parent: ref('hearing', h.id), child: ref('hearing', h.nextHearingId), kind: 'next_hearing' })
    }
    for (const p of src.plans) {
      const origin = p.origin
      if (origin && !(origin.kind === 'meeting' && src.meetings.some((m) => m.id === origin.id && m.prepPlanId === p.id))) {
        this.add({ parent: origin, child: ref('plan', p.id), kind: 'plan' })
      }
      // The narrowest scope is the parent: a hearing sits under its case, a task is its own thing.
      // A plan shared by several hearings or cases hangs under each of them.
      const hearingIds = planHearingIds(p)
      for (const hid of hearingIds) this.add({ parent: ref('hearing', hid), child: ref('plan', p.id), kind: 'plan' })
      if (!p.taskId) {
        // Cases already reached through one of the plan's hearings don't need a second path.
        const viaHearing = new Set(src.hearings.filter((h) => hearingIds.includes(h.id)).flatMap((h) => hearingCaseIds(h)))
        for (const cid of planCaseIds(p)) {
          if (!viaHearing.has(cid) && !(origin?.kind === 'case' && origin.id === cid)) this.add({ parent: ref('case', cid), child: ref('plan', p.id), kind: 'plan' })
        }
      }
      if (p.taskId) this.add({ parent: ref('task', p.taskId), child: ref('plan', p.id), kind: 'plan' })
    }
    for (const c of src.cases) if (c.engagement) this.add({ parent: ref('counsel', c.engagement.counselId), child: ref('case', c.id), kind: 'counsel' })
    for (const pr of src.projects) this.add({ parent: ref('client', pr.clientId), child: ref('project', pr.id), kind: 'project' })
    for (const g of src.goals) for (const pid of g.planIds) this.add({ parent: ref('goal', g.id), child: ref('plan', pid), kind: 'goal' })
    for (const l of src.links) {
      const edge: Edge = { parent: l.a, child: l.b, kind: 'linked', linkId: l.id }
      this.push(this.peers, refKey(l.a), edge)
      this.push(this.peers, refKey(l.b), edge)
    }
  }

  private add(edge: Edge) {
    // Skip edges to records that no longer exist (deleted parents leave dangling ids behind).
    if (!this.exists.has(refKey(edge.parent)) || !this.exists.has(refKey(edge.child))) return
    this.push(this.down, refKey(edge.parent), edge)
    this.push(this.up, refKey(edge.child), edge)
  }

  private push(map: Map<string, Edge[]>, key: string, edge: Edge) {
    map.set(key, [...(map.get(key) ?? []), edge])
  }

  has(ref: EntityRef) {
    return this.exists.has(refKey(ref))
  }

  neighbors(ref: EntityRef): Neighbor[] {
    const key = refKey(ref)
    return [
      ...(this.up.get(key) ?? []).map((e): Neighbor => ({ ref: e.parent, kind: e.kind, direction: 'parent' })),
      ...(this.down.get(key) ?? []).map((e): Neighbor => ({ ref: e.child, kind: e.kind, direction: 'child' })),
      ...(this.peers.get(key) ?? [])
        .map((e): Neighbor => ({ ref: refKey(e.parent) === key ? e.child : e.parent, kind: 'linked', direction: 'peer', linkId: e.linkId }))
        .filter((n) => this.has(n.ref)),
    ]
  }

  /**
   * The thread around a record: what it belongs to (walking up), everything that came from it
   * (walking down, as a tree), and what's been linked to it by hand.
   */
  thread(root: EntityRef): Thread {
    const seen = new Set([refKey(root)])
    const ancestors: Neighbor[] = []
    let frontier = [root]
    for (let depth = 0; depth < 4 && frontier.length; depth++) {
      const next: EntityRef[] = []
      for (const r of frontier) {
        for (const e of this.up.get(refKey(r)) ?? []) {
          if (seen.has(refKey(e.parent))) continue
          seen.add(refKey(e.parent))
          ancestors.push({ ref: e.parent, kind: e.kind, direction: 'parent' })
          // Goals sit above many plans; show them but don't climb past them.
          if (e.parent.kind !== 'goal') next.push(e.parent)
        }
      }
      frontier = next
    }

    const build = (ref: EntityRef, kind?: RelationKind): ThreadNode => ({
      ref,
      kind,
      children: (this.down.get(refKey(ref)) ?? [])
        .filter((e) => !seen.has(refKey(e.child)) && (seen.add(refKey(e.child)), true))
        .map((e) => build(e.child, e.kind)),
    })
    const tree = build(root)

    const peers = this.neighbors(root).filter((n) => n.direction === 'peer' && !seen.has(refKey(n.ref)))
    peers.forEach((p) => seen.add(refKey(p.ref)))

    const members = [...seen].map((k) => {
      const i = k.indexOf(':')
      return { kind: k.slice(0, i) as EntityKind, id: k.slice(i + 1) }
    })
    return { ancestors, tree, peers, members }
  }
}
