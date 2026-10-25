import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { addDays, format, isToday as isTodayDate, isValid, parseISO } from 'date-fns'
import { DndContext, DragOverlay, PointerSensor, pointerWithin, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent, DragMoveEvent, DragStartEvent } from '@dnd-kit/core'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, Sparkles, Undo2, Waves } from 'lucide-react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { container } from '@/di/container'
import type { CalendarItem, CalendarItemType, TimeBlock } from '@/domain/calendar/entities/CalendarItem'
import { DATE_FORMAT } from '@/domain/calendar/monthGrid'
import { clampBlock, DAY_START, DEFAULT_DURATION, snapToSlot } from '@/domain/planner/dayPlan'
import type { ScheduledItem } from '@/domain/planner/dayPlan'
import { useAuth } from '@/presentation/auth/AuthProvider'
import { AddItemDialog } from '@/presentation/calendar/AddItemDialog'
import { formatDuration } from '@/presentation/calendar/itemStyles'
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

export function DayPlannerPage() {
  const params = useParams<{ date?: string }>()
  const parsed = params.date ? parseISO(params.date) : new Date()
  if (!isValid(parsed)) return <Navigate to="/day" replace />
  return <DayPlanner key="planner" date={format(parsed, DATE_FORMAT)} />
}

function DayPlanner({ date }: { date: string }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const planner = useDayPlanner(container, user!.id, date)
  const { plan } = planner
  const day = parseISO(date)
  const isToday = isTodayDate(day)
  const clock = useNow()
  const now = isToday ? clock : null

  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<CalendarItem | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [preview, setPreview] = useState<TimeBlock | null>(null)
  const [instantId, setInstantId] = useState<string | null>(null)
  const [reflowing, setReflowing] = useState(false)
  const [gap, setGap] = useState(readGap)
  const [adding, setAdding] = useState<{ start?: number } | null>(null)
  const [direction, setDirection] = useState(0)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Bring the useful part of the day into view whenever a day loads.
  useEffect(() => {
    if (!planner.ready || !scrollRef.current) return
    const first = plan.scheduled[0]?.schedule.start
    const target = isToday ? clock - 90 : (first ?? WORKDAY_START) - 45
    scrollRef.current.scrollTo({ top: Math.max(0, minuteToY(target)), behavior: 'smooth' })
    // Only on day change, not on every clock tick or edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planner.ready, date])

  // Undo and reflow shortcuts.
  const { undo, reflow } = planner
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, [role=dialog]')) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
      } else if (!e.metaKey && !e.ctrlKey && e.key.toLowerCase() === 'r') {
        runReflow(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  async function runReflow(includeUnplanned: boolean) {
    setReflowing(true)
    await reflow(now ?? WORKDAY_START, gap, includeUnplanned)
    setTimeout(() => setReflowing(false), 900)
  }

  function chooseGap(value: number) {
    setGap(value)
    try {
      localStorage.setItem(GAP_KEY, String(value))
    } catch {
      // Preference only; ignore storage failures.
    }
  }

  function goToDay(offset: number | null) {
    const target = offset === null ? new Date() : addDays(day, offset)
    setDirection(Math.sign(target.getTime() - day.getTime()))
    navigate(`/day/${format(target, DATE_FORMAT)}`)
  }

  // --- Drag & drop -------------------------------------------------------------------------------

  const onDragStart = ({ active }: DragStartEvent) => setDragging(active.data.current?.item ?? null)

  const onDragMove = ({ active, over }: DragMoveEvent) => {
    setOverId((over?.id as string) ?? null)
    const item = active.data.current?.item as CalendarItem | undefined
    const rect = active.rect.current.translated
    const content = contentRef.current
    if (!item || !rect || !content || over?.id !== TIMELINE_DROP_ID) return setPreview(null)
    const start = snapToSlot(yToMinute(rect.top - content.getBoundingClientRect().top))
    const next = clampBlock({ start, duration: item.schedule?.duration ?? DEFAULT_DURATION[item.type] })
    setPreview((prev) => (prev?.start === next.start && prev.duration === next.duration ? prev : next))
  }

  const onDragEnd = ({ over }: DragEndEvent) => {
    const item = dragging
    if (item && over?.id === TIMELINE_DROP_ID && preview && preview.start !== item.schedule?.start) {
      setInstantId(item.id)
      planner.schedule(item, preview)
      requestAnimationFrame(() => requestAnimationFrame(() => setInstantId(null)))
    } else if (item?.schedule && over?.id === TRAY_DROP_ID) {
      planner.unschedule(item)
    }
    resetDrag()
  }

  const resetDrag = () => {
    setDragging(null)
    setPreview(null)
    setOverId(null)
  }

  const blockActions = {
    onMove: (item: ScheduledItem, start: number) => planner.schedule(item, { ...item.schedule, start }),
    onResize: planner.resize,
    onToggleComplete: planner.toggleComplete,
    onTogglePin: planner.togglePin,
    onUnschedule: planner.unschedule,
  }

  const total = planner.items.length
  const done = plan.completedCount
  const remainingMinutes = plan.scheduled
    .filter((i) => !i.completed && (now === null || i.schedule.start + i.schedule.duration > now))
    .reduce((sum, i) => sum + i.schedule.duration, 0)

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd} onDragCancel={resetDrag}>
      <div className="flex h-[calc(100vh-7rem)] min-h-[560px] flex-col gap-4">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-end gap-5">
            <div className="relative h-[4.5rem] min-w-64 overflow-hidden">
              <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                <motion.div
                  key={date}
                  initial={{ y: direction * 50, opacity: 0, filter: 'blur(6px)' }}
                  animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                  exit={{ y: direction * -50, opacity: 0, filter: 'blur(6px)' }}
                  transition={{ duration: 0.45, ease: easeOutExpo }}
                >
                  <div className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                    {isToday ? 'Today' : format(day, 'yyyy')}
                  </div>
                  <h1 className="font-display text-5xl leading-none tracking-tight">
                    {format(day, 'EEEE')} <span className="text-muted-foreground italic">{format(day, 'd MMM')}</span>
                  </h1>
                </motion.div>
              </AnimatePresence>
            </div>
            <ProgressRing done={done} total={total} />
            <div className="hidden text-xs text-muted-foreground md:block">
              <div>
                <span className="font-medium text-foreground tabular-nums">{formatDuration(plan.plannedMinutes)}</span> planned
              </div>
              <div>
                <span className="font-medium text-foreground tabular-nums">{formatDuration(remainingMinutes)}</span> {isToday ? 'still ahead' : 'open'}
              </div>
              <AnimatePresence>
                {plan.conflicts.size > 0 && (
                  <motion.div initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="font-medium text-destructive">
                    {plan.conflicts.size} overlapping
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-full border bg-background p-0.5 text-xs" role="radiogroup" aria-label="Buffer between blocks">
              <span className="pr-1 pl-2.5 text-muted-foreground">Buffer</span>
              {GAPS.map((g) => (
                <button
                  key={g}
                  role="radio"
                  aria-checked={gap === g}
                  onClick={() => chooseGap(g)}
                  className={cn('relative rounded-full px-2.5 py-1 font-medium tabular-nums', gap === g ? 'text-background' : 'text-muted-foreground hover:text-foreground')}
                >
                  {gap === g && <motion.span layoutId="gap-pill" transition={spring.snappy} className="absolute inset-0 rounded-full bg-foreground" />}
                  <span className="relative">{g}m</span>
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => runReflow(false)} title="Pack flexible blocks back-to-back around pinned meetings (R)">
              <Waves /> Reflow {isToday ? 'from now' : 'day'}
            </Button>
            <Button size="sm" className="rounded-full" onClick={() => runReflow(true)} disabled={plan.unplanned.length === 0}>
              <Sparkles /> Auto-plan
            </Button>
            <div className="flex items-center rounded-full border bg-background p-0.5">
              <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label="Previous day" onClick={() => goToDay(-1)}>
                <ChevronLeft />
              </Button>
              <Button variant="ghost" size="sm" className="rounded-full px-2 text-xs" onClick={() => goToDay(null)} disabled={isToday}>
                Today
              </Button>
              <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label="Next day" onClick={() => goToDay(1)}>
                <ChevronRight />
              </Button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[300px_1fr]">
          <aside className="flex min-h-0 flex-col gap-4 max-lg:max-h-80">
            {isToday && now !== null && <NowNext scheduled={plan.scheduled} now={now} />}
            <UnplannedTray
              items={plan.unplanned}
              ready={planner.ready}
              acceptingBlock={!!dragging?.schedule}
              onQuickAdd={(title, type: CalendarItemType) => planner.add({ title, type, notes: '', date })}
              onDelete={planner.remove}
            />
          </aside>

          <motion.section
            key={date}
            initial={{ opacity: 0, x: direction * 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: easeOutExpo }}
            className="relative min-h-0 overflow-hidden rounded-2xl border bg-card/80 shadow-float backdrop-blur max-lg:h-[70vh]"
          >
            <Timeline
              plan={plan}
              now={now}
              preview={preview && dragging ? { ...preview, type: dragging.type } : null}
              isDragging={!!dragging}
              instantId={instantId}
              reflowing={reflowing}
              scrollRef={scrollRef}
              contentRef={contentRef}
              onAddAt={(start) => setAdding({ start: Math.max(start, DAY_START) })}
              {...blockActions}
            />
          </motion.section>
        </div>

        <p className="hidden text-center text-[11px] text-muted-foreground lg:block">
          Drag to move · drag the bottom edge to resize · click empty time to add · <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> nudge · <Kbd>⇧</Kbd>+<Kbd>↑↓</Kbd> resize · <Kbd>P</Kbd> pin · <Kbd>R</Kbd> reflow · <Kbd>Ctrl</Kbd>+<Kbd>Z</Kbd> undo
        </p>
      </div>

      <DragOverlay dropAnimation={null}>{dragging && <DragGhost item={dragging} overTimeline={overId === TIMELINE_DROP_ID} />}</DragOverlay>

      <Toast notice={planner.notice} onUndo={planner.undo} onDismiss={planner.dismissNotice} />

      <AddItemDialog
        date={adding ? date : null}
        start={adding?.start}
        onClose={() => setAdding(null)}
        onSubmit={planner.add}
      />
    </DndContext>
  )
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="mx-0.5 rounded border bg-muted px-1 py-px font-sans text-[10px]">{children}</kbd>
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 18
  const c = 2 * Math.PI * r
  const ratio = total ? done / total : 0
  return (
    <div className="relative size-12 shrink-0" title={`${done} of ${total} done`}>
      <svg viewBox="0 0 44 44" className="size-full -rotate-90">
        <circle cx="22" cy="22" r={r} className="fill-none stroke-muted" strokeWidth="4" />
        <motion.circle
          cx="22"
          cy="22"
          r={r}
          className="fill-none stroke-foreground"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - ratio) }}
          transition={spring.gentle}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums">
        {done}/{total}
      </span>
    </div>
  )
}

function Toast({ notice, onUndo, onDismiss }: { notice: ReturnType<typeof useDayPlanner>['notice']; onUndo: () => void; onDismiss: () => void }) {
  useEffect(() => {
    if (!notice) return
    const id = setTimeout(onDismiss, 5000)
    return () => clearTimeout(id)
  }, [notice, onDismiss])

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4" aria-live="polite">
      <AnimatePresence mode="popLayout">
        {notice && (
          <motion.div
            key={notice.id}
            layout
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97, transition: { duration: 0.15 } }}
            transition={spring.soft}
            className="pointer-events-auto flex max-w-md items-center gap-3 rounded-full bg-foreground py-2 pr-2 pl-4 text-sm text-background shadow-lift"
          >
            <span className="truncate">{notice.message}</span>
            {notice.canUndo && (
              <button
                onClick={onUndo}
                className="flex shrink-0 items-center gap-1 rounded-full bg-background/15 px-3 py-1 text-xs font-medium hover:bg-background/25"
              >
                <Undo2 className="size-3" /> Undo
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
