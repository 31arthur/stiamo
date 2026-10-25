import type { Hearing, LegalCase } from '../cases/LegalCase'
import type { FollowUp } from '../followups/FollowUp'
import type { Goal } from '../goals/Goal'
import type { Meeting } from '../meetings/Meeting'
import type { ActionPlan } from '../plans/ActionPlan'
import type { Task } from '../tasks/Task'
import type { Clock, IdGenerator, Repository } from './Repository'
import type { EntityKind } from './types'

export interface EntityMap {
  task: Task
  meeting: Meeting
  followUp: FollowUp
  case: LegalCase
  hearing: Hearing
  plan: ActionPlan
  goal: Goal
}

export type Repositories = { [K in EntityKind]: Repository<EntityMap[K]> }

/** A record together with its kind, e.g. for undo snapshots. */
export type AnyEntity = { [K in EntityKind]: { kind: K; entity: EntityMap[K] } }[EntityKind]

/** Everything a use case needs from the outside world. */
export interface DomainEnv {
  repos: Repositories
  clock: Clock
  ids: IdGenerator
}
