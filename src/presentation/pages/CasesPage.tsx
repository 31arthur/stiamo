import { useMemo, useState } from 'react'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { motion } from 'motion/react'
import { AlertCircle, Plus } from 'lucide-react'
import { Link } from '@/presentation/routing'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CASE_STATUS_LABELS, CASE_TYPES, caseTypeOf, hearingsOf, nextHearing } from '@/domain/cases/LegalCase'
import type { CaseStatus } from '@/domain/cases/LegalCase'
import { counselLabel } from '@/domain/counsel/Counsel'
import { coversCase, planProgress } from '@/domain/plans/ActionPlan'
import { formatClock } from '@/domain/shared/time'
import { useEditor } from '@/presentation/app/create'
import { friendlyDate, relativeDays } from '@/presentation/components/dates'
import { Segmented } from '@/presentation/components/form'
import { EmptyState, PageHeader, Section, Stat } from '@/presentation/components/layout'
import { OutcomeBadge } from '@/presentation/components/outcome'
import { ProgressBar } from '@/presentation/components/progress'
import { useEntities, useStepPool, useToday } from '@/presentation/data/hooks'
import { stagger } from '@/presentation/motion/presets'

export const CASE_STATUS_TONE: Record<CaseStatus, string> = {
  active: 'bg-success/12 text-success',
  on_hold: 'bg-warning/15 text-warning',
  disposed: 'bg-muted text-muted-foreground',
  closed: 'bg-muted text-muted-foreground',
}

export function CasesPage() {
  const today = useToday()
  const { open } = useEditor()
  const { data: cases } = useEntities('case')
  const { data: hearings } = useEntities('hearing')
  const { data: plans } = useEntities('plan')
  const { data: tasks } = useEntities('task')
  const pool = useStepPool()
  const { data: counsel } = useEntities('counsel')
  const counselNames = useMemo(() => new Map(counsel.map((k) => [k.id, counselLabel(k)])), [counsel])
  const [filter, setFilter] = useState<'active' | 'all'>('active')

  const rows = useMemo(
    () =>
      cases
        .filter((c) => filter === 'all' || c.status === 'active' || c.status === 'on_hold')
        .map((c) => {
          const list = hearingsOf(c.id, hearings)
          const next = nextHearing(c.id, hearings, today)
          const last = [...list].reverse().find((h) => h.date < today)
          const unrecorded = list.filter((h) => h.date < today && h.outcome.status === 'open')
          const casePlans = plans.filter((p) => coversCase(p, c.id) && p.status === 'active')
          const prog = casePlans.map((p) => planProgress(p.id, pool))
          const openSteps = prog.reduce((s, p) => s + (p.total - p.closed), 0)
          const totalSteps = prog.reduce((s, p) => s + p.total, 0)
          return { c, next, last, unrecorded, openSteps, totalSteps, progress: totalSteps ? 1 - openSteps / totalSteps : null }
        })
        .sort((a, b) => b.unrecorded.length - a.unrecorded.length || (a.next?.date ?? '9999').localeCompare(b.next?.date ?? '9999')),
    [cases, hearings, plans, tasks, filter, today],
  )

  const thisWeek = hearings.filter((h) => h.outcome.status === 'open' && h.date >= today && differenceInCalendarDays(parseISO(h.date), parseISO(today)) <= 7).length
  const toRecord = rows.reduce((s, r) => s + r.unrecorded.length, 0)

  return (
    <>
      <PageHeader
        eyebrow="S&B Consultants · Legal"
        title="Cases"
        description="Every matter with its hearings, running summary and the action plans for each next stage."
        actions={
          <Button onClick={() => open({ kind: 'case' })}>
            <Plus /> Open a case
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Active matters" value={cases.filter((c) => c.status === 'active').length} />
        <Stat label="Hearings in 7 days" value={thisWeek} tone={thisWeek ? 'warning' : 'default'} />
        <Stat label="Hearings to write up" value={toRecord} tone={toRecord ? 'danger' : 'success'} />
        <Stat label="Open plan steps" value={rows.reduce((s, r) => s + r.openSteps, 0)} />
      </div>
      <Segmented label="Filter" value={filter} onChange={setFilter} options={[{ value: 'active', label: 'Active & on hold' }, { value: 'all', label: 'All cases' }]} />

      {rows.length === 0 ? (
        <Section>
          <EmptyState title="No cases yet." action={<Button onClick={() => open({ kind: 'case' })}>Open a case</Button>} />
        </Section>
      ) : (
        <motion.div variants={stagger(0.04)} initial="hidden" animate="show" className="overflow-hidden rounded-2xl border bg-card/80">
          <div className="hidden grid-cols-[minmax(0,2.4fr)_minmax(0,1.3fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_120px] gap-4 border-b px-4 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase md:grid">
            <span>Matter</span>
            <span>Court · stage</span>
            <span>Next hearing</span>
            <span>Last hearing</span>
            <span>Plans</span>
          </div>
          {rows.map(({ c, next, last, unrecorded, totalSteps, openSteps, progress }) => (
            <motion.div key={c.id} variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}>
              <Link
                to={`/cases/${c.id}`}
                className="grid gap-2 border-b px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/40 md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.3fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_120px] md:items-center md:gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">{c.reference}</span>
                    <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-medium', CASE_STATUS_TONE[c.status])}>{CASE_STATUS_LABELS[c.status]}</span>
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium">{CASE_TYPES[caseTypeOf(c.type)].label}</span>
                  </div>
                  <div className="truncate font-medium">{c.title}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {c.organization ?? '—'}
                    {c.client ? ` · for ${c.client}` : ''}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">{c.engagement ? `With ${counselNames.get(c.engagement.counselId) ?? 'outside counsel'}${c.engagement.proBono ? ' · pro bono' : ''}` : 'Handled by us'}</div>
                </div>
                <div className="min-w-0 text-sm">
                  <div className="truncate">{c.court ?? '—'}</div>
                  <div className="truncate text-xs text-muted-foreground">{[c.courtNumber, c.stage].filter(Boolean).join(' · ') || '—'}</div>
                </div>
                <div className="text-sm">
                  {next ? (
                    <>
                      <div className="font-medium tabular-nums">
                        {friendlyDate(next.date, today)}
                        {next.time !== undefined && ` · ${formatClock(next.time)}`}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {relativeDays(next.date, today)} · {next.purpose}
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not listed</span>
                  )}
                </div>
                <div className="text-sm">
                  {unrecorded.length > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">
                      <AlertCircle className="size-3" /> Write up {friendlyDate(unrecorded[0].date, today)}
                    </span>
                  ) : last ? (
                    <OutcomeBadge outcome={last.outcome} target="hearing" />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
                <div>
                  {progress !== null ? (
                    <>
                      <ProgressBar value={progress} />
                      <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                        {totalSteps - openSteps}/{totalSteps} steps
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">No plan</span>
                  )}
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
    </>
  )
}
