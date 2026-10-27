import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, TokenInput } from '@/presentation/components/form'

export interface DiaryDetail {
  bench?: string
  order?: string
  submissions?: string
  authorities: string[]
  evidence?: string
  reflections?: string
}

/**
 * What a court diary carries beyond "what happened": the bench, the order and directions, what was
 * argued, the authorities cited, the evidence, and your own read of it for the next time.
 */
export function DiaryFields({ value, onChange, idPrefix, show }: { value: DiaryDetail; onChange: (patch: Partial<DiaryDetail>) => void; idPrefix: string; show?: (keyof DiaryDetail)[] }) {
  const text = (v: string) => v || undefined
  const on = (k: keyof DiaryDetail) => !show || show.includes(k)
  return (
    <div className="grid gap-4">
      {on('order') && <Field label="Order & directions" htmlFor={`${idPrefix}-order`} hint="The operative order in a few lines — dates fixed, who must do what by when">
        <Textarea id={`${idPrefix}-order`} value={value.order ?? ''} onChange={(e) => onChange({ order: text(e.target.value) })} className="min-h-16" placeholder="e.g. Reply to be filed within two weeks; rejoinder one week after. List on 12 Dec for arguments." />
      </Field>}
      {on('bench') && <Field label="Bench" htmlFor={`${idPrefix}-bench`}>
        <Input id={`${idPrefix}-bench`} value={value.bench ?? ''} onChange={(e) => onChange({ bench: text(e.target.value) })} placeholder="e.g. Hon’ble Justice A. Rao, Court 4" />
      </Field>}
      {on('submissions') && <Field label="Submissions" htmlFor={`${idPrefix}-subs`} hint="What each side argued, and how the bench reacted">
        <Textarea id={`${idPrefix}-subs`} value={value.submissions ?? ''} onChange={(e) => onChange({ submissions: text(e.target.value) })} className="min-h-20" />
      </Field>}
      {on('authorities') && <Field label="Authorities cited" htmlFor={`${idPrefix}-auth`} hint="Press Enter after each — judgments, sections, rules">
        <TokenInput id={`${idPrefix}-auth`} values={value.authorities} onChange={(authorities) => onChange({ authorities })} placeholder="e.g. Bandhua Mukti Morcha v. Union of India" />
      </Field>}
      {on('evidence') && <Field label="Evidence" htmlFor={`${idPrefix}-evid`} hint="Witnesses examined or still to come; documents exhibited">
        <Textarea id={`${idPrefix}-evid`} value={value.evidence ?? ''} onChange={(e) => onChange({ evidence: text(e.target.value) })} className="min-h-16" />
      </Field>}
      {on('reflections') && <Field label="Reflections" htmlFor={`${idPrefix}-refl`} hint="For yourself: the bench’s leaning, what to do differently, what to watch">
        <Textarea id={`${idPrefix}-refl`} value={value.reflections ?? ''} onChange={(e) => onChange({ reflections: text(e.target.value) })} className="min-h-16" />
      </Field>}
    </div>
  )
}
