import { format, parseISO } from 'date-fns'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { mergeCandidates } from '@/domain/cases/hearingDiary'
import { hearingCaseIds } from '@/domain/cases/LegalCase'
import type { Hearing } from '@/domain/cases/LegalCase'
import type { ID, ISODate } from '@/domain/shared/types'
import { Field } from '@/presentation/components/form'
import { useEntities } from '@/presentation/data/hooks'

/**
 * Connected cases taken up in the same sitting share one hearing and one record. Pick them here;
 * if one of them already has its own listing that day, say what will happen to it.
 */
export function HeardTogetherField({ hearing, value, onChange }: { hearing: { id: ID; caseId: ID; date: ISODate }; value: ID[]; onChange: (ids: ID[]) => void }) {
  const { data: cases } = useEntities('case')
  const { data: hearings } = useEntities('hearing')
  const others = cases.filter((c) => c.id !== hearing.caseId)

  const refOf = (id: ID) => cases.find((c) => c.id === id)?.reference ?? 'Case'
  const sameDay = hearings.filter((o) => o.id !== hearing.id && o.date === hearing.date && hearingCaseIds(o).some((id) => id !== hearing.caseId && value.includes(id)))
  const folded = mergeCandidates(hearing, value, hearings)
  const separate = sameDay.filter((o) => !folded.includes(o))
  const hasListing = (caseId: ID) => hearings.some((o) => o.id !== hearing.id && o.date === hearing.date && hearingCaseIds(o).includes(caseId))

  const note = (o: Hearing, verb: string) => `${hearingCaseIds(o).map(refOf).join(' + ')} · ${o.purpose} (${format(parseISO(o.date), 'd MMM')}) — ${verb}`

  return (
    <Field label="Heard together with" hint="Connected cases taken up in the same sitting share this hearing and one record">
      <div className="flex flex-wrap gap-1.5">
        {others.map((c) => {
          const on = value.includes(c.id)
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              title={`${c.title}${hasListing(c.id) ? ' — has its own listing on this date' : ''}`}
              onClick={() => onChange(on ? value.filter((id) => id !== c.id) : [...value, c.id])}
              className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors', on ? 'border-foreground bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
            >
              {c.reference}
              {hasListing(c.id) && <span className={cn('size-1.5 rounded-full', on ? 'bg-background' : 'bg-ws-sb')} aria-label="has a listing the same day" />}
            </button>
          )
        })}
        {others.length === 0 && <span className="text-xs text-muted-foreground">No other cases yet</span>}
      </div>
      {(folded.length > 0 || separate.length > 0) && (
        <ul className="grid gap-1 text-xs text-muted-foreground">
          {folded.map((o) => (
            <li key={o.id} className="flex items-start gap-1.5">
              <Info className="mt-0.5 size-3.5 shrink-0" /> {note(o, 'the same day, not written up: it will be folded into this hearing')}
            </li>
          ))}
          {separate.map((o) => (
            <li key={o.id} className="flex items-start gap-1.5">
              <Info className="mt-0.5 size-3.5 shrink-0" /> {note(o, 'already written up on its own, so it stays separate')}
            </li>
          ))}
        </ul>
      )}
    </Field>
  )
}
