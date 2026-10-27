import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { addDays, format, isValid, parseISO } from 'date-fns'
import { DndContext, DragOverlay, MouseSensor, pointerWithin, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent, DragMoveEvent, DragStartEvent } from '@dnd-kit/core'
import { AnimatePresence, motion } from 'motion/react'
import { AlertCircle, CalendarClock, ChevronLeft, ChevronRight, Gavel, PhoneCall, Sparkles, SquareCheck, Users, Waves } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { buildAgenda } from '@/domain/agenda/agenda'
import type { AgendaEntry } from '@/domain/agenda/agenda'
import { clampBlock, DAY_START, snapToSlot } from '@/domain/planner/dayPlan'
import type { Block, ScheduledEntry } from '@/domain/planner/dayPlan'
import { OPEN } from '@/domain/shared/outcome'
import { formatClock, formatDuration, toISODate } from '@/domain/shared/time'
import type { ISODate } from '@/domain/shared/types'
import { useAttention } from '@/presentation/app/attention'
import { useEditor } from '@/presentation/app/create'
import type { EditorRequest } from '@/presentation/app/create'
import { useWorkspaceFilter } from '@/presentation/app/workspaceFilter'
import { friendlyDate } from '@/presentation/components/dates'
import { Section } from '@/presentation/components/layout'
import { OutcomeControl } from '@/presentation/components/outcome'
import { ProgressRing } from '@/presentation/components/progress'
import { useEntities, useSave, useToday } from '@/presentation/data/hooks'
import { easeOutExpo, spring } from '@/presentation/motion/presets'
import { DragGhost } from '@/presentation/planner/DragGhost'
import { minuteToY, TIMELINE_DROP_ID, TRAY_DROP_ID, yToMinute } from '@/presentation/planner/geometry'
import { NowNext } from '@/presentation/planner/NowNext'
import { Timeline } from '@/presentation/planner/Timeline'
import { UnplannedTray } from '@/presentation/planner/UnplannedTray'
import { useDayPlanner } from '@/presentation/planner/useDayPlanner'
import { useNow } from '@/presentation/planner/useNow'

const WORKDAY_START = 9 * 60
const GAPS = [0, 5, 10]
const GAP_KEY = 'stiamo.planner-gap'

function readGap(): number {
  try {
    const raw = localStorage.getItem(GAP_KEY)
    return raw !== null && GAPS.includes(Number(raw)) ? Number(raw) : 5
  } catch {
    return 5
  }
}

export function TodayPage() {
  const params = useParams<{ date?: string }>()
  // `/today` follows the clock, so a tab left open past midnight moves on to the new day.
  const today = useToday()
  const parsed = params.date ? parseISO(params.date) : parseISO(today)
  if (!isValid(parsed)) return <Navigate to="/today" replace />
  return <DayPlanner date={toISODate(parsed)} />
}

function DayPlanner({ date }: { date: ISODate }) {
  const today = useToday()
  const navigate = useNavigate()
  const editor = useEditor()
  const { matches, scope } = useWorkspaceFilter()
  const planner = useDayPlanner(date)
  const { data: tasks } = useEntities('task')
  const quickSave = useSave('task')
  const day = parseISO(date)
  const isToday = date === today
  const clock = useNow()
  const now = isToday ? clock : null

  // The workspace lens applies to the planner too.
  const plan = useMemo(() => {
    const keep = (e: AgendaEntry) => matches(e.workspace)
    return { ...planner.plan, scheduled: planner.plan.scheduled.filter(keep), unplanned: planner.plan.unplanned.filter(keep) }
  }, [planner.plan, matches])

  const carryOver = useMemo(
    () =>
      date >= today
        ? tasks
            .filter((t) => matches(t.workspace) && t.outcome.status === 'open' && t.dueDate && t.dueDate < date && !(t.slot && t.slot.date >= date))
            .map((t) => buildAgenda({ tasks: [t], meetings: [], followUps: [], hearings: [], cases: [] }, t.dueDate!, t.dueDate!)[0])
            .filter(Boolean)
        : [],
    [tasks, matches, date, today],
  )

  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<AgendaEntry | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [preview, setPreview] = useState<Block | null>(null)
  const [instantKey, setInstantKey] = useState<string | null>(null)
  const [reflowing, setReflowing] = useState(false)
  const [gap, setGap] = useState(readGap)
  const [addAt, setAddAt] = useState<number | null>(null)
  const [direction, setDirection] = useState(0)

  // Mouse: drag after a small move. Touch: long-press to pick up, so the timeline still scrolls.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  )

  // Bring the useful part of the day into view when a day loads.
  useEffect(() => {
    if (!planner.ready || !scrollRef.current) return
    const first = plan.scheduled[0]?.slot.start
    const target = isToday ? clock - 90 : (first ?? WORKDAY_START) - 45
    scrollRef.current.scrollTo({ top: Math.max(0, minuteToY(target)), behavior: 'smooth' })
    // Only when the day changes, not on every tick or edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planner.ready, date])

  const { undo } = planner
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).closest('input, textarea, select, [role=dialog]')) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
      } else if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'r') {
        runReflow(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  async function runReflow(includeUnplanned: boolean) {
    setReflowing(true)
    await planner.reflow(now ?? WORKDAY_START, gap, includeUnplanned)
    setTimeout(() => setReflowing(false), 900)
  }

  function chooseGap(value: number) {
    setGap(value)
    try {
      localStorage.setItem(GAP_KEY, String(value))
    } catch {
      // Preference only.
    }
  }

  function goToDay(offset: number | null) {
    const target = offset === null ? parseISO(today) : addDays(day, offset)
    setDirection(Math.sign(target.getTime() - day.getTime()))
    navigate(`/today/${toISODate(target)}`)
  }

  // --- Drag & drop -----------------------------------------------------------------------------

  const onDragStart = ({ active }: DragStartEvent) => setDragging((active.data.current?.entry as AgendaEntry) ?? null)

  const onDragMove = ({ active, over }: DragMoveEvent) => {
    setOverId((over?.id as string) ?? null)
    const entry = active.data.current?.entry as AgendaEntry | undefined
    const rect = active.rect.current.translated
    const content = contentRef.current
    if (!entry || !rect || !content || over?.id !== TIMELINE_DROP_ID) return setPreview(null)
    const start = snapToSlot(yToMinute(rect.top - content.getBoundingClientRect().top))
    const next = clampBlock({ start, duration: entry.slot?.duration ?? entry.duration })
    setPreview((prev) => (prev?.start === next.start && prev.duration === next.duration ? prev : next))
  }

  const onDragEnd = ({ over }: DragEndEvent) => {
    const entry = dragging
    const sameSpot = entry?.slot && entry.date === date && preview?.start === entry.slot.start
    if (entry && over?.id === TIMELINE_DROP_ID && preview && !sameSpot) {
      setInstantKey(entry.key)
      planner.schedule(entry, preview)
      requestAnimationFrame(() => requestAnimationFrame(() => setInstantKey(null)))
    } else if (entry?.slot && over?.id === TRAY_DROP_ID) {
      planner.unschedule(entry)
    }
    resetDrag()
  }

  const resetDrag = () => {
    setDragging(null)
    setPreview(null)
    setOverId(null)
  }

  const blockActions = {
    onMove: (entry: AgendaEntry, start: number) => entry.slot && planner.schedule(entry, { start, duration: entry.slot.duration }),
    onResize: (entry: ScheduledEntry, duration: number) => planner.schedule(entry, { start: entry.slot.start, duration }),
    onUnschedule: planner.unschedule,
    onOpen: (entry: AgendaEntry) => editor.openRef(entry.ref),
  }

  const visible = [...plan.scheduled, ...plan.unplanned]
  const closed = visible.filter((e) => e.outcome.status !== 'open').length
  const remaining = plan.scheduled.filter((e) => e.outcome.status === 'open' && (now === null || e.slot.start + e.slot.duration > now)).reduce((s, e) => s + e.slot.duration, 0)
  const planned = plan.scheduled.reduce((s, e) => s + e.slot.duration, 0)
  const conflicts = plan.scheduled.filter((e) => plan.conflicts.has(e.key)).length

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd} onDragCancel={resetDrag}>
      <div className="flex min-h-[600px] flex-col gap-4 xl:h-[calc(100vh-3rem)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-end gap-5">
            {/* Enter-only: the new day slides in as the old one is replaced, so the heading can never be left showing the previous day. */}
            <div className="relative h-[4.5rem] min-w-60 overflow-hidden">
              <motion.div
                key={date}
                initial={{ y: direction * 40, opacity: 0, filter: 'blur(6px)' }}
                animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                transition={{ duration: 0.4, ease: easeOutExpo }}
              >
                <div className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{isToday ? 'Today' : friendlyDate(date, today)}</div>
                <h1 className="font-display text-5xl leading-none tracking-tight">
                  {format(day, 'EEEE')} <span className="text-muted-foreground italic">{format(day, 'd MMM')}</span>
                </h1>
              </motion.div>
            </div>
            <ProgressRing value={visible.length ? closed / visible.length : 0} label={`${closed}/${visible.length}`} />
            <div className="hidden text-xs text-muted-foreground md:block">
              <div>
                <span className="font-medium text-foreground tabular-nums">{formatDuration(planned)}</span> on the timeline
              </div>
              <div>
                <span className="font-medium text-foreground tabular-nums">{formatDuration(remaining)}</span> {isToday ? 'still ahead' : 'planned'}
              </div>
              <AnimatePresence>
                {conflicts > 0 && (
                  <motion.div initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="font-medium text-destructive">
                    {conflicts} overlapping
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-full border bg-background p-0.5 text-xs" role="radiogroup" aria-label="Buffer between blocks">
              <span className="pr-1 pl-2.5 text-muted-foreground">Buffer</span>
              {GAPS.map((g) => (
                <button key={g} role="radio" aria-checked={gap === g} onClick={() => chooseGap(g)} className={cn('relative rounded-full px-2.5 py-1 font-medium tabular-nums', gap === g ? 'text-background' : 'text-muted-foreground hover:text-foreground')}>
                  {gap === g && <motion.span layoutId="gap-pill" transition={spring.snappy} className="absolute inset-0 rounded-full bg-foreground" />}
                  <span className="relative">{g}m</span>
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => runReflow(false)} title="Pack flexible blocks back-to-back around fixed ones (R)">
              <Waves /> Reflow {isToday ? 'from now' : 'day'}
            </Button>
            <Button size="sm" className="rounded-full" onClick={() => runReflow(true)} disabled={plan.unplanned.length === 0}>
              <Sparkles /> Auto-plan
            </Button>
            <div className="flex items-center rounded-full border bg-background p-0.5">
              <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label="Previous day" onClick={() => goToDay(-1)}>
                <ChevronLeft />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="min-w-24 rounded-full px-2 text-xs"
                onClick={() => goToDay(null)}
                disabled={isToday}
                title={isToday ? undefined : 'Back to today'}
                aria-label={isToday ? 'Today' : `${friendlyDate(date, today)} — back to today`}
              >
                {friendlyDate(date, today)}
              </Button>
              <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label="Next day" onClick={() => goToDay(1)}>
                <ChevronRight />
              </Button>
            </div>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[280px_1fr] xl:grid-cols-[280px_1fr_300px]">
          <aside className="flex min-h-0 flex-col gap-4 max-lg:max-h-96">
            {isToday && now !== null && <NowNext scheduled={plan.scheduled} now={now} />}
            <UnplannedTray
              entries={plan.unplanned}
              carryOver={carryOver}
              ready={planner.ready}
              acceptingBlock={!!dragging?.slot && dragging.kind !== 'meeting'}
              quickAddWorkspace={scope === 'all' ? 'personal' : scope}
              onQuickAdd={(title) => quickSave.run({ title, notes: '', workspace: scope === 'all' ? 'personal' : scope, priority: 'normal', estimate: 30, dueDate: date, outcome: OPEN })}
              onOpen={blockActions.onOpen}
            />
          </aside>

          <motion.section
            key={date}
            initial={{ opacity: 0, x: direction * 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: easeOutExpo }}
            className="relative min-h-0 overflow-hidden rounded-2xl border bg-card/80 shadow-float backdrop-blur max-xl:h-[72vh]"
          >
            <Timeline
              plan={plan}
              now={now}
              preview={preview && dragging ? { ...preview, workspace: dragging.workspace } : null}
              isDragging={!!dragging}
              instantKey={instantKey}
              reflowing={reflowing}
              scrollRef={scrollRef}
              contentRef={contentRef}
              onAddAt={(start) => setAddAt(Math.max(start, DAY_START))}
              {...blockActions}
            />
          </motion.section>

          <AttentionRail className="lg:col-span-2 xl:col-span-1" />
        </div>

        <p className="hidden text-center text-[11px] text-muted-foreground lg:block">
          Drag to move · drag the bottom edge to resize · click empty time to add · <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> nudge · <Kbd>⇧</Kbd>+<Kbd>↑↓</Kbd> resize · <Kbd>R</Kbd> reflow · <Kbd>Ctrl</Kbd>+<Kbd>Z</Kbd> undo · pinned blocks (meetings, hearings, confirmations) stay put on reflow
        </p>
      </div>

      <DragOverlay dropAnimation={null}>{dragging && <DragGhost entry={dragging} overTimeline={overId === TIMELINE_DROP_ID} />}</DragOverlay>

      <AddAtTimeDialog
        date={date}
        start={addAt}
        onClose={() => setAddAt(null)}
        onPick={(request) => {
          setAddAt(null)
          editor.open(request)
        }}
      />
    </DndContext>
  )
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="mx-0.5 rounded border bg-muted px-1 py-px font-sans text-[10px]">{children}</kbd>
}

function AddAtTimeDialog({ date, start, onClose, onPick }: { date: ISODate; start: number | null; onClose: () => void; onPick: (r: EditorRequest) => void }) {
  const s = start ?? 0
  const options: { label: string; hint: string; icon: typeof Users; request: EditorRequest }[] = [
    { label: 'Task', hint: 'Block time for work', icon: SquareCheck, request: { kind: 'task', value: { dueDate: date, slot: { date, start: s, duration: 30 } } } },
    { label: 'Follow-up', hint: 'A call or message', icon: PhoneCall, request: { kind: 'followUp', value: { due: { date, time: s } } } },
    { label: 'Appointment', hint: 'With a client / party', icon: CalendarClock, request: { kind: 'appointment', value: { slot: { date, start: s, duration: 45 } } } },
    { label: 'Meeting', hint: 'Agenda-driven', icon: Users, request: { kind: 'meeting', value: { slot: { date, start: s, duration: 60 } } } },
  ]
  return (
    <Dialog open={start !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl font-normal tracking-tight">Add at {formatClock(s)}</DialogTitle>
          <DialogDescription>{format(parseISO(date), 'EEEE d MMMM')}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {options.map((o) => (
            <motion.button
              key={o.label}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onPick(o.request)}
              className="flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-shadow hover:shadow-float"
            >
              <o.icon className="size-4" />
              <span className="text-sm font-medium">{o.label}</span>
              <span className="text-[11px] text-muted-foreground">{o.hint}</span>
            </motion.button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Things that slipped and need a decision — shown next to the day so they're handled while planning. */
function AttentionRail({ className }: { className?: string }) {
  const today = useToday()
  const attention = useAttention()
  const { data: cases } = useEntities('case')
  const items = attention.hearingsToRecord.length + attention.meetingsToRecord.length + attention.dueFollowUps.length

  return (
    <Section
      title={
        <span className="flex items-center gap-2">
          <AlertCircle className="size-4 text-destructive" /> Needs attention
          <span className="text-xs font-normal text-muted-foreground tabular-nums">{items}</span>
        </span>
      }
      className={cn('min-h-0 overflow-hidden', className)}
      bodyClassName="scrollbar-thin grid max-h-[calc(100%-3rem)] content-start gap-3 overflow-y-auto p-2"
    >
      {items === 0 && <p className="p-3 text-center text-sm text-muted-foreground">Nothing slipping. Nice.</p>}
      {attention.hearingsToRecord.map((h) => {
        const c = cases.find((x) => x.id === h.caseId)
        return (
          <Link key={h.id} to={`/cases/${h.caseId}`} className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/5 p-2.5 text-sm hover:bg-destructive/10">
            <Gavel className="mt-0.5 size-4 shrink-0 text-destructive" />
            <span className="min-w-0">
              <span className="block font-medium">Write up hearing</span>
              <span className="block truncate text-xs text-muted-foreground">
                {c?.reference} · {friendlyDate(h.date, today)} · {h.purpose}
              </span>
            </span>
          </Link>
        )
      })}
      {attention.meetingsToRecord.map((m) => (
        <div key={m.id} className="flex items-start gap-2 rounded-xl border p-2.5 text-sm">
          <OutcomeControl target="meeting" id={m.id} outcome={m.outcome} size="sm" />
          <Link to={`/meetings/${m.id}`} className="min-w-0 hover:underline">
            <span className="block truncate font-medium">{m.title}</span>
            <span className="block text-xs text-muted-foreground">
              Record outcome · {friendlyDate(m.slot.date, today)} {formatClock(m.slot.start)}
            </span>
          </Link>
        </div>
      ))}
      {attention.dueFollowUps.map((f) => (
        <div key={f.id} className="flex items-start gap-2 rounded-xl border p-2.5 text-sm">
          <OutcomeControl target="followUp" id={f.id} outcome={f.outcome} size="sm" />
          <div className="min-w-0">
            <span className="block truncate font-medium">{f.title}</span>
            <span className={cn('block text-xs', f.due && f.due.date < today ? 'text-destructive' : 'text-muted-foreground')}>
              {f.due ? friendlyDate(f.due.date, today) : 'Anytime'}
              {f.due?.time !== undefined && ` ${formatClock(f.due.time)}`}
              {f.contact && ` · ${f.contact}`}
            </span>
          </div>
        </div>
      ))}
    </Section>
  )
}
