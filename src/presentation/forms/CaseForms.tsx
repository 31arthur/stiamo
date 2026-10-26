import { AnimatePresence, motion } from 'motion/react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { nextCaseNumber } from '@/domain/cases/caseNumber'
import { CASE_STATUS_LABELS, CASE_TYPE_ORDER, CASE_TYPES } from '@/domain/cases/LegalCase'
import { ORGANIZATION_CODES, ORGANIZATIONS, organizationName } from '@/domain/cases/Organization'
import type { OrganizationCode } from '@/domain/cases/Organization'
import type { CaseStatus, Hearing, LegalCase } from '@/domain/cases/LegalCase'
import { OPEN } from '@/domain/shared/outcome'
import { formatDuration } from '@/domain/shared/time'
import { ValidationError } from '@/domain/shared/errors'
import { emptyEngagement, EngagementFields } from '@/presentation/cases/EngagementFields'
import { DateInput, DURATION_PRESETS, Field, NativeSelect, Segmented, TimeInput } from '@/presentation/components/form'
import { useAction, useEntities, useSave, useToday } from '@/presentation/data/hooks'
import { FormShell, usePatch } from './shared'

/** A case being opened: no number yet (it's generated) and the organization is still to be chosen. */
export type CaseDraft = Omit<LegalCase, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'reference' | 'organization'> & { reference?: string; organization?: OrganizationCode }
export type HearingDraft = Omit<Hearing, 'id' | 'userId' | 'createdAt' | 'updatedAt'>

export const newCase = (): CaseDraft => ({ type: 'pow', title: '', status: 'active', summary: '' })

export const newHearing = (caseId: string, date: string): HearingDraft => ({ caseId, date, time: 10 * 60 + 30, duration: 60, purpose: '', outcome: OPEN })

export function CaseForm({ initial, onDone }: { initial: LegalCase | CaseDraft; onDone: (saved?: LegalCase) => void }) {
  const [c, patch] = usePatch(initial)
  const editing = 'createdAt' in initial
  const { data: cases } = useEntities('case')
  const update = useSave('case', 'Case updated')
  const open = useAction<CaseDraft, LegalCase>((s, userId, draft) => s.cases.open(userId, draft as Parameters<typeof s.cases.open>[1]), { success: (k) => `Case ${k.reference} opened` })

  // Show the number the case will get, so there are no surprises after saving.
  const year = c.filedOn ? Number(c.filedOn.slice(0, 4)) : new Date().getFullYear()
  const preview = !editing && c.organization ? nextCaseNumber(c.organization, year, cases) : null

  return (
    <FormShell
      submitLabel={editing ? 'Save' : 'Open case'}
      onCancel={() => onDone()}
      onSubmit={async () => {
        if (!editing && c.engagement && !c.engagement.counselId) throw new ValidationError('Choose the counsel, or switch back to “Handled by us”')
        onDone(editing ? await update.run(c as LegalCase) : await open.run(c))
      }}
    >
      {editing ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-sm">
          <span className="font-mono font-medium">{(c as LegalCase).reference}</span>
          <span className="text-muted-foreground">· filed for {organizationName(c.organization)}</span>
        </div>
      ) : (
        <Field label="Filed for" hint="The organization this case is filed on behalf of — its code starts the case number">
          <div role="radiogroup" aria-label="Organization" className="grid gap-1.5 sm:grid-cols-2">
            {ORGANIZATION_CODES.map((code) => {
              const selected = c.organization === code
              return (
                <button
                  key={code}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => patch({ organization: code })}
                  className={cn('flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors', selected ? 'border-foreground bg-muted' : 'hover:bg-muted/50')}
                >
                  <span className="w-14 shrink-0 font-mono text-xs font-semibold">{code}</span>
                  <span className="text-xs leading-tight text-muted-foreground">{ORGANIZATIONS[code].name}</span>
                </button>
              )
            })}
          </div>
        </Field>
      )}

      <AnimatePresence initial={false}>
        {preview && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl border border-dashed px-3 py-2">
              <span className="text-xs text-muted-foreground">Case number</span>
              <span className="font-mono text-base font-semibold">{preview}</span>
              <span className="text-xs text-muted-foreground">assigned when you open the case</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Field label="Type of case">
        <div role="radiogroup" aria-label="Type of case" className="grid gap-1.5 sm:grid-cols-2">
          {CASE_TYPE_ORDER.map((t) => {
            const selected = c.type === t
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => patch({ type: t })}
                className={cn('rounded-xl border px-3 py-2 text-left transition-colors', selected ? 'border-foreground bg-muted' : 'hover:bg-muted/50')}
              >
                <span className="block text-sm font-medium">{CASE_TYPES[t].label}</span>
                <span className="block text-[11px] leading-tight text-muted-foreground">{CASE_TYPES[t].description}</span>
              </button>
            )
          })}
        </div>
      </Field>

      {!editing && (
        <Field label="Handled by" hint="Most cases are handled by us; brief outside counsel when needed">
          <Segmented<'self' | 'counsel'>
            size="sm"
            label="Handled by"
            value={c.engagement ? 'counsel' : 'self'}
            onChange={(v) => patch({ engagement: v === 'counsel' ? (c.engagement ?? emptyEngagement()) : undefined })}
            options={[
              { value: 'self', label: 'Handled by us' },
              { value: 'counsel', label: 'Outside counsel' },
            ]}
          />
        </Field>
      )}
      {!editing && c.engagement && <EngagementFields value={c.engagement} onChange={(engagement) => patch({ engagement })} caseType={c.type} idPrefix="new-eng" />}

      <Field label="Title" htmlFor="case-title">
        <Input id="case-title" autoFocus value={c.title} onChange={(e) => patch({ title: e.target.value })} placeholder={c.type === 'public_interest' ? 'e.g. Unpaid wages of migrant construction workers' : 'e.g. 24 workers v. Sri Lakshmi Brick Works'} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={c.type === 'public_interest' ? 'On behalf of (group or cause)' : 'On behalf of (worker or group)'} htmlFor="case-client" hint="Leave blank when it's simply the organization">
          <Input id="case-client" value={c.client ?? ''} onChange={(e) => patch({ client: e.target.value || undefined })} />
        </Field>
        <Field label="Opposing party" htmlFor="case-opp">
          <Input id="case-opp" value={c.opposingParty ?? ''} onChange={(e) => patch({ opposingParty: e.target.value || undefined })} />
        </Field>
        <Field label="Court / forum" htmlFor="case-court">
          <Input id="case-court" value={c.court ?? ''} onChange={(e) => patch({ court: e.target.value || undefined })} />
        </Field>
        <Field label="Court’s case number" htmlFor="case-court-no" hint="Once the court gives it one">
          <Input id="case-court-no" value={c.courtNumber ?? ''} onChange={(e) => patch({ courtNumber: e.target.value || undefined })} placeholder="e.g. WP 1290/2026" />
        </Field>
        <Field label="Practice area" htmlFor="case-area">
          <Input id="case-area" value={c.practiceArea ?? ''} onChange={(e) => patch({ practiceArea: e.target.value || undefined })} placeholder="Labour, Commercial, Tax…" />
        </Field>
        <Field label="Stage" htmlFor="case-stage">
          <Input id="case-stage" value={c.stage ?? ''} onChange={(e) => patch({ stage: e.target.value || undefined })} placeholder="Notice, Pleadings, Evidence, Arguments…" />
        </Field>
        <Field label="Status" htmlFor="case-status">
          <NativeSelect id="case-status" value={c.status} onChange={(e) => patch({ status: e.target.value as CaseStatus })}>
            {(Object.keys(CASE_STATUS_LABELS) as CaseStatus[]).map((s) => (
              <option key={s} value={s}>
                {CASE_STATUS_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Filed on" htmlFor="case-filed" hint={editing ? undefined : 'The year goes in the case number'}>
          <DateInput id="case-filed" value={c.filedOn} onChange={(filedOn) => patch({ filedOn })} />
        </Field>
      </div>
      {!editing && (
        <Field label="Case summary" htmlFor="case-summary">
          <Textarea id="case-summary" value={c.summary} onChange={(e) => patch({ summary: e.target.value })} className="min-h-24" placeholder="Facts, issues, relief sought…" />
        </Field>
      )}
    </FormShell>
  )
}

export function HearingForm({ initial, onDone }: { initial: Hearing | HearingDraft; onDone: (saved?: Hearing) => void }) {
  const today = useToday()
  const [h, patch] = usePatch(initial)
  const editing = 'createdAt' in initial
  const save = useSave('hearing', editing ? 'Hearing updated' : 'Hearing listed')

  return (
    <FormShell submitLabel={editing ? 'Save' : 'Add hearing'} onCancel={() => onDone()} onSubmit={async () => onDone(await save.run(h))}>
      <Field label="Listed for" htmlFor="hr-purpose">
        <Input id="hr-purpose" autoFocus value={h.purpose} onChange={(e) => patch({ purpose: e.target.value })} placeholder="e.g. Cross-examination of PW-2" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Date" htmlFor="hr-date">
          <DateInput id="hr-date" value={h.date} onChange={(date) => patch({ date: date ?? today })} />
        </Field>
        <Field label="Time" htmlFor="hr-time">
          <TimeInput id="hr-time" value={h.time} onChange={(time) => patch({ time })} />
        </Field>
        <Field label="Block" htmlFor="hr-dur">
          <NativeSelect id="hr-dur" value={h.duration} onChange={(e) => patch({ duration: Number(e.target.value) })}>
            {[...new Set([...DURATION_PRESETS, 180, h.duration])].sort((a, b) => a - b).map((d) => (
              <option key={d} value={d}>
                {formatDuration(d)}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field label="Court room / bench" htmlFor="hr-forum">
        <Input id="hr-forum" value={h.forum ?? ''} onChange={(e) => patch({ forum: e.target.value || undefined })} />
      </Field>
    </FormShell>
  )
}
