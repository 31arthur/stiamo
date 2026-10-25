import type { Entity, EntityRef } from '../shared/types'

/**
 * A connection you make by hand between any two records — e.g. a case and every meeting held about it,
 * a goal and a hearing, two related tasks. Links are undirected.
 */
export interface Link extends Entity {
  a: EntityRef
  b: EntityRef
  note?: string
}

export const linkTouches = (link: Link, ref: EntityRef) =>
  (link.a.kind === ref.kind && link.a.id === ref.id) || (link.b.kind === ref.kind && link.b.id === ref.id)

export const otherEnd = (link: Link, ref: EntityRef): EntityRef => (link.a.kind === ref.kind && link.a.id === ref.id ? link.b : link.a)
