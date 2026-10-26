/** Opaque identifier. */
export type ID = string
/** Local calendar day, yyyy-MM-dd. */
export type ISODate = string
/** Instant, full ISO-8601 string. */
export type ISODateTime = string
/** Minutes from local midnight (0–1439) or a duration in minutes. */
export type Minutes = number

/** A timed occurrence on a specific day. */
export interface TimeSlot {
  date: ISODate
  start: Minutes
  duration: Minutes
}

/** Every persisted record belongs to one user and is time-stamped. */
export interface Entity {
  id: ID
  userId: ID
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

/** Fields the system manages; drafts omit them. */
export type Draft<T extends Entity> = Omit<T, keyof Entity> & Partial<Pick<T, 'id'>>

export type EntityKind = 'task' | 'meeting' | 'followUp' | 'case' | 'hearing' | 'plan' | 'goal' | 'counsel'

/** A typed pointer to another record, used for cross-entity links. */
export interface EntityRef {
  kind: EntityKind
  id: ID
}

/** Block-editor content, stored as-is (JSON). The domain treats it as opaque. */
export type RichDoc = unknown[]

export const sameRef = (a?: EntityRef, b?: EntityRef) => !!a && !!b && a.kind === b.kind && a.id === b.id
