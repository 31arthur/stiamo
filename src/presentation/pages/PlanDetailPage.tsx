import { lazy, Suspense, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { ArrowLeft, Calendar, CircleDot, Gauge, Layers, ListChecks, Loader2, Target, Waypoints } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { PLAN_STATUS_LABELS, planProgress } from '@/domain/plans/ActionPlan'
import type { ActionPlan, PlanStatus } from '@/domain/plans/ActionPlan'
import type { ID, RichDoc } from '@/domain/shared/types'
import { AttachmentsPanel } from '@/presentation/attachments/AttachmentsPanel'
import { useAttachments } from '@/presentation/attachments/useAttachments'
import { ConfirmDelete } from '@/presentation/components/confirm'
import { friendlyDate } from '@/presentation/components/dates'
import { DateInput, NativeSelect } from '@/presentation/components/form'
import { ProgressBar } from '@/presentation/components/progress'
import { RefChip } from '@/presentation/components/RefChip'
import { Tabs } from '@/presentation/components/tabs'
import { WS_STYLE, WorkspacePicker } from '@/presentation/components/workspace'
import { useAction, useEntities, useEntity, useSave, useToday } from '@/presentation/data/hooks'
import { easeOutExpo } from '@/presentation/motion/presets'
import { useDocumentTitle } from '@/presentation/layout/useDocumentTitle'
import { PlanSteps } from '@/presentation/plans/PlanSteps'
import { ThreadPanel } from '@/presentation/relations/ThreadPanel'

const PlanEditor = lazy(() => import('@/presentation/editor/PlanEditor'))

const COVER: Record<string, string> = {
  personal: 'from-ws-personal/35 via-ws-personal/10',
  sb: 'from-ws-sb/35 via-ws-sb/10',
  fsa: 'from-ws-fsa/35 via-ws-fsa/10',
  media: 'from-ws-media/35 via-ws-media/10',
}

export function PlanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const plan = useEntity('plan', id)
  const { isLoading } = useEntities('plan')
  if (!plan) return isLoading ? null : <Navigate to="/plans" replace />
  return <PlanPage key={plan.id} plan={plan} />
}

/** A plan as a page: properties, tracked steps, and a free-form block document below. */
function PlanPage({ plan: p }: { plan: ActionPlan }) {
  useDocumentTitle(p.title)
  const today = useToday()
  const navigate = useNavigate()
  const { data: tasks } = useEntities('task')
  const { data: goals } = useEntities('goal')
  const save = useSave('plan')
  const remove = useAction<ID, void>((s, userId, id) => s.plans.remove(userId, id), { success: 'Plan deleted — its steps were kept as tasks' })
  const toggleGoal = useAction<{ goalId: ID; linked: boolean }, void>((s, userId, a) => (a.linked ? s.plans.unlink(userId, p.id, a.goalId) : s.plans.link(userId, p.id, a.goalId)))
  const editedThisSession = useRef(false)
  const saveDoc = useAction<RichDoc, void>((s, userId, doc) => {
    const first = !editedThisSession.current
    editedThisSession.current = true
    return s.plans.saveDoc(userId, p.id, doc, first)
  })
  const files = useAttachments({ kind: 'plan', id: p.id })

  const prog = planProgress(p.id, tasks)
  const linkedGoals = goals.filter((g) => g.planIds.includes(p.id))
  const overdue = p.dueDate && p.dueDate < today && p.status === 'active'

  return (
    <article className="mx-auto w-full max-w-4xl">
      <div className="mb-3 flex items-center justify-between">
        <Link to="/plans" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Action plans
        </Link>
        <ConfirmDelete
          what={p.title}
          onConfirm={async () => {
            await remove.run(p.id)
            navigate('/plans')
          }}
        />
      </div>

      <motion.div initial={{ opacity: 0, scaleY: 0.9 }} animate={{ opacity: 1, scaleY: 1 }} transition={{ duration: 0.5, ease: easeOutExpo }} className={cn('h-24 origin-top rounded-2xl bg-gradient-to-br to-transparent sm:h-32', COVER[p.workspace])} />
      <div className="-mt-7 ml-3 flex size-14 items-center justify-center rounded-2xl border bg-background shadow-float sm:ml-4">
        <ListChecks className={cn('size-7', WS_STYLE[p.workspace].text)} />
      </div>

      <InlineText value={p.title} onCommit={(title) => title && save.run({ ...p, title })} className="mt-3 font-display text-4xl leading-tight tracking-tight sm:text-5xl" placeholder="Untitled plan" aria-label="Plan title" />
      <InlineText value={p.objective} multiline onCommit={(objective) => save.run({ ...p, objective })} className="mt-1 text-base text-muted-foreground" placeholder="Add an objective — what does success look like?" aria-label="Objective" />

      {/* Properties, Notion-style */}
      <dl className="mt-5 grid gap-y-1 text-sm">
        <Property icon={CircleDot} label="Status">
          <NativeSelect value={p.status} onChange={(e) => save.run({ ...p, status: e.target.value as PlanStatus })} className="h-8 w-40 border-transparent hover:border-input" aria-label="Status">
            {(Object.keys(PLAN_STATUS_LABELS) as PlanStatus[]).map((s) => (
              <option key={s} value={s}>
                {PLAN_STATUS_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </Property>
        <Property icon={Calendar} label="Due">
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-44">
              <DateInput value={p.dueDate} onChange={(dueDate) => save.run({ ...p, dueDate })} />
            </div>
            {p.dueDate && <span className={cn('text-xs', overdue ? 'text-destructive' : 'text-muted-foreground')}>{overdue ? 'Overdue' : friendlyDate(p.dueDate, today)}</span>}
          </div>
        </Property>
        <Property icon={Layers} label="Workspace">
          <WorkspacePicker id="plan-page-ws" value={p.workspace} onChange={(workspace) => save.run({ ...p, workspace })} />
        </Property>
        <Property icon={Gauge} label="Progress">
          <div className="flex w-full max-w-xs items-center gap-3">
            <ProgressBar value={prog.progress ?? 0} barClassName={WS_STYLE[p.workspace].bar} />
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {prog.done}/{prog.total} steps
            </span>
          </div>
        </Property>
        {(p.origin || p.caseId) && (
          <Property icon={Waypoints} label="From">
            <div className="flex flex-wrap gap-1.5">
              {p.origin && <RefChip refTo={p.origin} />}
              {p.caseId && p.origin?.kind !== 'case' && <RefChip refTo={{ kind: 'case', id: p.caseId }} />}
            </div>
          </Property>
        )}
        <Property icon={Target} label="Goals">
          <div className="flex flex-wrap gap-1.5">
            {goals.map((g) => {
              const linked = g.planIds.includes(p.id)
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={linked}
                  onClick={() => toggleGoal.run({ goalId: g.id, linked })}
                  className={cn('rounded-full border px-2.5 py-0.5 text-xs transition-colors', linked ? 'border-foreground bg-foreground text-background' : 'border-dashed text-muted-foreground hover:text-foreground')}
                >
                  {g.title}
                </button>
              )
            })}
            {goals.length === 0 && <span className="text-xs text-muted-foreground">No goals yet</span>}
            {linkedGoals.length === 0 && goals.length > 0 && <span className="self-center text-[11px] text-muted-foreground">Tap to link</span>}
          </div>
        </Property>
      </dl>

      <section className="mt-8">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <ListChecks className="size-4" /> Steps
          <span className="font-normal text-muted-foreground tabular-nums">
            {prog.done}/{prog.total}
          </span>
        </h2>
        <div className="rounded-xl border bg-card/60 p-1.5">
          <PlanSteps planId={p.id} />
        </div>
      </section>

      <section className="mt-8 border-t pt-6">
        <Suspense
          fallback={
            <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading the page editor…
            </div>
          }
        >
          <PlanEditor owner={{ kind: 'plan', id: p.id }} ownerTitle={p.title} initial={p.doc} onSave={(doc) => saveDoc.run(doc)} />
        </Suspense>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Type <kbd className="rounded border bg-muted px-1">/</kbd> for headings, lists, to-dos, tables, images, files, video and drawings. Saves automatically.
        </p>
      </section>

      <section className="mt-10 rounded-2xl border bg-card/70 p-4 sm:p-5">
        <Tabs
          tabs={[
            { id: 'files', label: <>Files {files.length > 0 && <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] tabular-nums">{files.length}</span>}</>, content: <AttachmentsPanel owner={{ kind: 'plan', id: p.id }} /> },
            { id: 'thread', label: 'Thread & history', content: <ThreadPanel root={{ kind: 'plan', id: p.id }} /> },
          ]}
        />
      </section>
    </article>
  )
}

function Property({ icon: Icon, label, children }: { icon: typeof Calendar; label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] items-center gap-2 rounded-lg px-1 py-1 hover:bg-muted/40 sm:grid-cols-[9rem_1fr]">
      <dt className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" /> {label}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}

/** Text that looks like a heading until you click it, then saves on blur/Enter. */
function InlineText({ value, onCommit, className, placeholder, multiline, ...aria }: { value: string; onCommit: (v: string) => void; className?: string; placeholder: string; multiline?: boolean; 'aria-label': string }) {
  const [draft, setDraft] = useState(value)
  const commit = () => draft.trim() !== value && onCommit(draft.trim())
  const base = cn('w-full resize-none bg-transparent outline-none placeholder:text-muted-foreground/50', className)
  return multiline ? (
    <textarea value={draft} placeholder={placeholder} onBlur={commit} rows={1} onChange={(e) => setDraft(e.target.value)} className={cn(base, 'field-sizing-content')} {...aria} />
  ) : (
    <input value={draft} placeholder={placeholder} onBlur={commit} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} className={base} {...aria} />
  )
}
