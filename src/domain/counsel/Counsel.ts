import type { CaseType } from '../cases/LegalCase'
import type { Entity } from '../shared/types'

export type CounselKind = 'advocate' | 'firm'
export type CounselStatus = 'active' | 'inactive'

export const COUNSEL_KIND_LABELS: Record<CounselKind, string> = { advocate: 'Advocate', firm: 'Law firm' }

/**
 * An outside advocate or law firm we know and may brief on a case when we don't handle it ourselves.
 */
export interface Counsel extends Entity {
  kind: CounselKind
  name: string
  /** For an advocate: the chambers or firm they practise with. */
  firm?: string
  phone?: string
  email?: string
  city?: string
  /** Courts and forums they appear before, in words. */
  courts?: string
  /** The kinds of case they're good for. */
  expertise: CaseType[]
  /** Open to taking pro-bono matters. */
  proBono: boolean
  status: CounselStatus
  notes: string
}

/** "Adv. R. Iyer" or "Iyer & Partners" with the firm for advocates: used wherever counsel is named. */
export const counselLabel = (c: Pick<Counsel, 'name' | 'firm' | 'kind'>) => (c.kind === 'advocate' && c.firm ? `${c.name} (${c.firm})` : c.name)
