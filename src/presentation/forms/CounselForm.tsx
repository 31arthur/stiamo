import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { CASE_TYPE_ORDER, CASE_TYPES } from '@/domain/cases/LegalCase'
import type { CaseType } from '@/domain/cases/LegalCase'
import { COUNSEL_KIND_LABELS } from '@/domain/counsel/Counsel'
import type { Counsel, CounselKind, CounselStatus } from '@/domain/counsel/Counsel'
import { Field, Segmented } from '@/presentation/components/form'
import { useSave } from '@/presentation/data/hooks'
import { FormShell, usePatch } from './shared'

export type CounselDraft = Omit<Counsel, 'id' | 'userId' | 'createdAt' | 'updatedAt'>

export const newCounsel = (over: Partial<CounselDraft> = {}): CounselDraft => ({ kind: 'advocate', name: '', expertise: [], proBono: false, status: 'active', notes: '', ...over })

export function CounselForm({ initial, onDone }: { initial: Counsel | CounselDraft; onDone: (saved?: Counsel) => void }) {
  const [c, patch] = usePatch(initial)
  const editing = 'createdAt' in initial
  const save = useSave('counsel', editing ? 'Counsel updated' : 'Added to your counsel')
  const toggleType = (t: CaseType) => patch({ expertise: c.expertise.includes(t) ? c.expertise.filter((x) => x !== t) : [...c.expertise, t] })

  return (
    <FormShell submitLabel={editing ? 'Save' : 'Add counsel'} onCancel={() => onDone()} onSubmit={async () => onDone(await save.run(c))}>
      <Segmented<CounselKind>
        label="Kind"
        value={c.kind}
        onChange={(kind) => patch({ kind })}
        options={(Object.keys(COUNSEL_KIND_LABELS) as CounselKind[]).map((k) => ({ value: k, label: COUNSEL_KIND_LABELS[k] }))}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={c.kind === 'firm' ? 'Firm name' : 'Name'} htmlFor="co-name">
          <Input id="co-name" autoFocus value={c.name} onChange={(e) => patch({ name: e.target.value })} placeholder={c.kind === 'firm' ? 'e.g. Iyer & Partners' : 'e.g. Adv. R. Iyer'} />
        </Field>
        {c.kind === 'advocate' && (
          <Field label="Chambers / firm" htmlFor="co-firm">
            <Input id="co-firm" value={c.firm ?? ''} onChange={(e) => patch({ firm: e.target.value || undefined })} />
          </Field>
        )}
        <Field label="Phone" htmlFor="co-phone">
          <Input id="co-phone" type="tel" inputMode="tel" value={c.phone ?? ''} onChange={(e) => patch({ phone: e.target.value || undefined })} />
        </Field>
        <Field label="Email" htmlFor="co-email">
          <Input id="co-email" type="email" inputMode="email" value={c.email ?? ''} onChange={(e) => patch({ email: e.target.value || undefined })} />
        </Field>
        <Field label="City" htmlFor="co-city">
          <Input id="co-city" value={c.city ?? ''} onChange={(e) => patch({ city: e.target.value || undefined })} />
        </Field>
        <Field label="Appears before" htmlFor="co-courts" hint="Courts and forums">
          <Input id="co-courts" value={c.courts ?? ''} onChange={(e) => patch({ courts: e.target.value || undefined })} placeholder="e.g. Telangana HC, Labour Court" />
        </Field>
      </div>
      <Field label="Good for" hint="The kinds of case to brief them on">
        <div className="flex flex-wrap gap-1.5">
          {CASE_TYPE_ORDER.map((t) => {
            const on = c.expertise.includes(t)
            return (
              <button key={t} type="button" aria-pressed={on} onClick={() => toggleType(t)} className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors', on ? 'border-foreground bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}>
                {CASE_TYPES[t].label}
              </button>
            )
          })}
        </div>
      </Field>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <button type="button" role="switch" aria-checked={c.proBono} onClick={() => patch({ proBono: !c.proBono })} className="flex items-center gap-2.5 text-sm font-medium">
          <span className={cn('relative h-5 w-9 rounded-full transition-colors', c.proBono ? 'bg-foreground' : 'bg-muted-foreground/30')}>
            <span className={cn('absolute top-0.5 size-4 rounded-full bg-background shadow transition-all', c.proBono ? 'left-[1.125rem]' : 'left-0.5')} />
          </span>
          Takes pro bono matters
        </button>
        {editing && (
          <Segmented<CounselStatus> size="sm" label="Status" value={c.status} onChange={(status) => patch({ status })} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Not available' }]} />
        )}
      </div>
      <Field label="Notes" htmlFor="co-notes" hint="Fees they usually ask, how they like to be briefed, who referred them…">
        <Textarea id="co-notes" value={c.notes} onChange={(e) => patch({ notes: e.target.value })} className="min-h-20" />
      </Field>
    </FormShell>
  )
}
