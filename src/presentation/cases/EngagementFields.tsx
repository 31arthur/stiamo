import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { CaseType, Engagement } from '@/domain/cases/LegalCase'
import { COUNSEL_KIND_LABELS, counselLabel } from '@/domain/counsel/Counsel'
import { useEditor } from '@/presentation/app/create'
import { DateInput, Field, NativeSelect } from '@/presentation/components/form'
import { useEntities } from '@/presentation/data/hooks'

export const emptyEngagement = (counselId = ''): Engagement => ({ counselId, proBono: false })

/** The brief to outside counsel: who, what for, and on what terms. */
export function EngagementFields({ value, onChange, caseType, idPrefix = 'eng' }: { value: Engagement; onChange: (e: Engagement) => void; caseType?: CaseType; idPrefix?: string }) {
  const { data: counsel } = useEntities('counsel')
  const editor = useEditor()
  const options = [...counsel].sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active') || a.name.localeCompare(b.name))
  const chosen = counsel.find((c) => c.id === value.counselId)
  const patch = (p: Partial<Engagement>) => onChange({ ...value, ...p })

  if (counsel.length === 0) {
    return (
      <div className="grid justify-items-start gap-2 rounded-xl border border-dashed p-4 text-sm">
        <p className="text-muted-foreground">You haven’t added any outside advocates or law firms yet.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => editor.open({ kind: 'counsel' })}>
          <Plus /> Add counsel
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-4 rounded-xl border bg-muted/30 p-3 sm:p-4">
      <Field label="Counsel" htmlFor={`${idPrefix}-counsel`}>
        <NativeSelect id={`${idPrefix}-counsel`} value={value.counselId} onChange={(e) => patch({ counselId: e.target.value })}>
          <option value="">Choose…</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {counselLabel(c)} · {COUNSEL_KIND_LABELS[c.kind]}
              {c.city ? ` · ${c.city}` : ''}
              {c.status === 'inactive' ? ' (not available)' : ''}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {chosen && caseType && chosen.expertise.length > 0 && !chosen.expertise.includes(caseType) && (
        <p className="-mt-2 text-xs text-warning">Not usually briefed on this kind of case.</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Briefed on" htmlFor={`${idPrefix}-on`}>
          <DateInput id={`${idPrefix}-on`} value={value.engagedOn} onChange={(engagedOn) => patch({ engagedOn })} />
        </Field>
        <Field label="Terms">
          <div className="grid gap-2">
            <button type="button" role="switch" aria-checked={value.proBono} onClick={() => patch({ proBono: !value.proBono, fee: !value.proBono ? undefined : value.fee })} className="flex h-9 items-center gap-2.5 text-sm font-medium">
              <span className={cn('relative h-5 w-9 rounded-full transition-colors', value.proBono ? 'bg-foreground' : 'bg-muted-foreground/30')}>
                <span className={cn('absolute top-0.5 size-4 rounded-full bg-background shadow transition-all', value.proBono ? 'left-[1.125rem]' : 'left-0.5')} />
              </span>
              Pro bono
            </button>
          </div>
        </Field>
      </div>
      {!value.proBono && (
        <Field label="Agreed fee" htmlFor={`${idPrefix}-fee`} hint="In words, as agreed — e.g. ₹25,000 fixed + ₹3,000 per hearing">
          <Input id={`${idPrefix}-fee`} value={value.fee ?? ''} onChange={(e) => patch({ fee: e.target.value || undefined })} />
        </Field>
      )}
      <Field label="Scope of the brief" htmlFor={`${idPrefix}-scope`} hint="What they are to do: appear at all hearings, draft and file only…">
        <Input id={`${idPrefix}-scope`} value={value.scope ?? ''} onChange={(e) => patch({ scope: e.target.value || undefined })} />
      </Field>
      <Field label="Notes" htmlFor={`${idPrefix}-notes`}>
        <Textarea id={`${idPrefix}-notes`} value={value.notes ?? ''} onChange={(e) => patch({ notes: e.target.value || undefined })} className="min-h-16" />
      </Field>
    </div>
  )
}
