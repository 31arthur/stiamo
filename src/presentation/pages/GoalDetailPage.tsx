import { useState } from 'react'
import type { FormEvent } from 'react'
import { format, parseISO } from 'date-fns'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, Link2, Minus, Pencil, Plus, Trophy, Unlink } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { goalProgress, HEALTH_LABELS, HORIZON_LABELS, keyResultProgress } from '@/domain/goals/Goal'
import type { CheckIn, Goal, KeyResult } from '@/domain/goals/Goal'
import { planProgress } from '@/domain/plans/ActionPlan'
import type { ID } from '@/domain/shared/types'
import { useEditor } from '@/presentation/app/create'
import { ConfirmDelete } from '@/presentation/components/confirm'
import { friendlyDate } from '@/presentation/components/dates'
import { NativeSelect } from '@/presentation/components/form'
import { Meta, Section } from '@/presentation/components/layout'
import { ProgressBar, ProgressRing } from '@/presentation/components/progress'
import { WS_STYLE, WorkspaceBadge } from '@/presentation/components/workspace'
import { useAction, useEntities, useEntity, useRemove, useSave, useToday } from '@/presentation/data/hooks'
import { HEALTH_STYLE } from '@/presentation/goals/health'
import { spring } from '@/presentation/motion/presets'

export function GoalDetailPage() {
  const { id } = useParams<{ id: string }>()
  const goal = useEntity('goal', id)
  const { isLoading } = useEntities('goal')
  if (!goal) return isLoading ? null : <Navigate to="/goals" replace />
  return <GoalDetail key={goal.id} goal={goal} />
}

const CONFIDENCE = ['', 'Won’t make it', 'Unlikely', 'Toss-up', 'Likely', 'Certain'] as const

function GoalDetail({ goal: g }: { goal: Goal }) {
  const today = useToday()
  const navigate = useNavigate()
  const editor = useEditor()
  const { data: tasks } = useEntities('task')
  const { data: plans } = useEntities('plan')
  const save = useSave('goal')
  const remove = useRemove('goal', 'Goal deleted')
  const link = useAction<{ planId: ID; on: boolean }, void>((s, userId, a) => (a.on ? s.plans.link(userId, a.planId, g.id) : s.plans.unlink(userId, a.planId, g.id)), {
    success: (_r) => 'Plans updated',
  })
  const gp = goalProgress(g, tasks, today)
  const linked = plans.filter((p) => g.planIds.includes(p.id))
  const available = plans.filter((p) => !g.planIds.includes(p.id) && p.status !== 'abandoned')

  const setKr = (kr: KeyResult, current: number) => save.run({ ...g, keyResults: g.keyResults.map((k) => (k.id === kr.id ? { ...k, current } : k)) })

  return (
    <>
      <div className="flex items-center justify-between">
        <Link to="/goals" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Goals
        </Link>
        <div className="flex gap-1">
          {g.status === 'active' ? (
            <Button variant="outline" size="sm" onClick={() => save.run({ ...g, status: 'achieved' })}>
              <Trophy /> Mark achieved
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => save.run({ ...g, status: 'active' })}>
              Reactivate
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => editor.open({ kind: 'goal', value: g })}>
            <Pencil /> Edit
          </Button>
          <ConfirmDelete
            what={g.title}
            onConfirm={async () => {
              await remove.run(g.id)
              navigate('/goals')
            }}
          />
        </div>
      </div>

      <header className="flex flex-wrap items-center gap-6">
        <ProgressRing value={gp.progress} size={120} stroke={9} ringClassName={HEALTH_STYLE[gp.health].ring} label={<span className="text-xl">{Math.round(gp.progress * 100)}%</span>} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded-md px-2 py-0.5 text-xs font-semibold', HEALTH_STYLE[gp.health].chip)}>{HEALTH_LABELS[gp.health]}</span>
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs">{HORIZON_LABELS[g.horizon]}</span>
            {g.workspace ? <WorkspaceBadge ws={g.workspace} /> : <span className="rounded-md bg-muted px-2 py-0.5 text-xs">Cross-cutting</span>}
          </div>
          <h1 className="mt-1 font-display text-4xl leading-tight tracking-tight sm:text-5xl">{g.title}</h1>
          {g.description && <p className="mt-1 max-w-3xl text-muted-foreground">{g.description}</p>}
        </div>
      </header>

      <Section>
        <div className="grid gap-5 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
          <div>
            <div className="mb-2 flex justify-between text-xs text-muted-foreground">
              <span>Progress vs. time — the tick shows where you’d be if progress kept pace with the calendar</span>
            </div>
            <ProgressBar value={gp.progress} marker={gp.elapsed} className="h-2.5" barClassName={HEALTH_STYLE[gp.health].bar} />
          </div>
          <Meta label="Started">{format(parseISO(g.startDate), 'd MMM yyyy')}</Meta>
          <Meta label="Target">{format(parseISO(g.targetDate), 'd MMM yyyy')}</Meta>
          <Meta label="Time left">{gp.daysLeft >= 0 ? `${gp.daysLeft} days` : `${-gp.daysLeft} days over`}</Meta>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
          <div className="rounded-lg bg-muted/50 p-2.5">
            <div className="text-muted-foreground">Key results</div>
            <div className="text-lg font-semibold tabular-nums">{gp.keyResults === null ? '—' : `${Math.round(gp.keyResults * 100)}%`}</div>
          </div>
          <div className="rounded-lg bg-muted/50 p-2.5">
            <div className="text-muted-foreground">Linked plans</div>
            <div className="text-lg font-semibold tabular-nums">{gp.plans === null ? '—' : `${Math.round(gp.plans * 100)}%`}</div>
          </div>
          <div className="rounded-lg bg-muted/50 p-2.5">
            <div className="text-muted-foreground">Time elapsed</div>
            <div className="text-lg font-semibold tabular-nums">{Math.round(gp.elapsed * 100)}%</div>
          </div>
        </div>
      </Section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Key results" description="Update the current value as things move" bodyClassName="grid gap-3">
          {g.keyResults.length === 0 && <p className="text-sm text-muted-foreground">Add measurable key results via Edit.</p>}
          {g.keyResults.map((kr) => (
            <div key={kr.id} className="grid gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{kr.label}</span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon-xs" aria-label={`Decrease ${kr.label}`} onClick={() => setKr(kr, kr.current - 1)}>
                    <Minus />
                  </Button>
                  <input
                    key={kr.current}
                    type="number"
                    defaultValue={kr.current}
                    onBlur={(e) => Number(e.target.value) !== kr.current && setKr(kr, Number(e.target.value))}
                    className="w-16 rounded-md bg-muted px-1.5 py-0.5 text-center text-sm font-semibold tabular-nums outline-none focus:ring-2 focus:ring-ring/40"
                    aria-label={`${kr.label} current value`}
                  />
                  <Button variant="ghost" size="icon-xs" aria-label={`Increase ${kr.label}`} onClick={() => setKr(kr, kr.current + 1)}>
                    <Plus />
                  </Button>
                  <span className="w-20 text-right text-xs text-muted-foreground tabular-nums">
                    of {kr.target}
                    {kr.unit && ` ${kr.unit}`}
                  </span>
                </div>
              </div>
              <ProgressBar value={keyResultProgress(kr)} />
            </div>
          ))}
        </Section>

        <Section
          title="Action plans"
          description="The work that moves this goal"
          actions={
            <Button variant="ghost" size="sm" onClick={() => editor.open({ kind: 'plan', value: { workspace: g.workspace ?? 'personal', origin: { kind: 'goal', id: g.id } }, extras: { goalIds: [g.id] } })}>
              <Plus /> New plan
            </Button>
          }
          bodyClassName="grid gap-2 p-2"
        >
          <AnimatePresence initial={false}>
            {linked.map((p) => {
              const prog = planProgress(p.id, tasks)
              return (
                <motion.div key={p.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={spring.soft} className="group flex items-center gap-3 rounded-xl border p-3">
                  <div className={cn('h-10 w-1 rounded-full', WS_STYLE[p.workspace].bar)} />
                  <div className="min-w-0 flex-1">
                    <Link to={`/plans/${p.id}`} className="truncate text-sm font-medium hover:underline">
                      {p.title}
                    </Link>
                    <ProgressBar value={prog.progress ?? 0} className="mt-1.5" />
                    <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                      {prog.done}/{prog.total} steps done{p.dueDate && ` · due ${friendlyDate(p.dueDate, today)}`}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon-sm" aria-label={`Unlink ${p.title}`} className="opacity-0 group-hover:opacity-100" onClick={() => link.run({ planId: p.id, on: false })}>
                    <Unlink />
                  </Button>
                </motion.div>
              )
            })}
          </AnimatePresence>
          {available.length > 0 && (
            <div className="flex items-center gap-2 px-1 pt-1">
              <Link2 className="size-4 text-muted-foreground" />
              <NativeSelect value="" onChange={(e) => e.target.value && link.run({ planId: e.target.value, on: true })} aria-label="Link an existing plan" className="h-8 text-xs">
                <option value="">Link an existing plan…</option>
                {available.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
        </Section>
      </div>

      <CheckIns goal={g} />
    </>
  )
}

function CheckIns({ goal: g }: { goal: Goal }) {
  const today = useToday()
  const save = useSave('goal', 'Check-in added')
  const [confidence, setConfidence] = useState<CheckIn['confidence']>(3)
  const [note, setNote] = useState('')

  async function add(e: FormEvent) {
    e.preventDefault()
    await save.run({ ...g, checkIns: [{ id: crypto.randomUUID(), date: today, confidence, note: note.trim() }, ...g.checkIns] })
    setNote('')
  }

  return (
    <Section title="Check-ins" description="A regular honest read on how likely this is">
      <form onSubmit={add} className="grid gap-3 rounded-xl bg-muted/40 p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
        <div className="flex gap-1" role="radiogroup" aria-label="Confidence">
          {([1, 2, 3, 4, 5] as const).map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={confidence === c}
              title={CONFIDENCE[c]}
              onClick={() => setConfidence(c)}
              className={cn('size-8 rounded-lg text-sm font-semibold transition-colors', confidence === c ? 'bg-foreground text-background' : 'bg-background text-muted-foreground hover:text-foreground')}
            >
              {c}
            </button>
          ))}
        </div>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={`${CONFIDENCE[confidence]} — what’s helping or blocking?`} />
        <Button type="submit" size="sm">
          Add check-in
        </Button>
      </form>
      <ol className="mt-4 grid gap-3">
        {g.checkIns.map((c) => (
          <li key={c.id} className="flex items-start gap-3">
            <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold', c.confidence >= 4 ? 'bg-success/12 text-success' : c.confidence <= 2 ? 'bg-destructive/10 text-destructive' : 'bg-warning/15 text-warning')}>
              {c.confidence}
            </span>
            <div>
              <div className="text-xs text-muted-foreground">
                {friendlyDate(c.date, today)} · {CONFIDENCE[c.confidence]}
              </div>
              {c.note && <div className="text-sm">{c.note}</div>}
            </div>
          </li>
        ))}
      </ol>
    </Section>
  )
}
