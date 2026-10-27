import { useMemo, useState } from 'react'
import { addMonths, format, isSameMonth, isWeekend, parseISO, startOfMonth } from 'date-fns'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ActionMenu } from '@/presentation/components/ActionMenu'
import { cn } from '@/lib/utils'
import type { AgendaEntry } from '@/domain/agenda/agenda'
import { buildMonthGrid } from '@/domain/agenda/monthGrid'
import { formatClock } from "@/domain/shared/time"
import type { ISODate } from '@/domain/shared/types'
import { WORKSPACE_IDS, WORKSPACES } from '@/domain/shared/workspace'
import { useEditor } from '@/presentation/app/create'
import type { EditorRequest } from '@/presentation/app/create'
import { useWorkspaceFilter } from '@/presentation/app/workspaceFilter'
import { entryIcon, entryLabel } from '@/presentation/components/kinds'
import { LensNotice } from '@/presentation/components/LensNotice'
import { OUTCOME_STYLE } from '@/presentation/components/outcome'
import { WS_STYLE, WorkspaceDot } from '@/presentation/components/workspace'
import { useAgenda, useToday } from '@/presentation/data/hooks'
import { CREATE_MENU } from '@/presentation/layout/createMenu'
import { easeOutExpo, spring } from '@/presentation/motion/presets'
import { useIsCompact } from '@/presentation/layout/useMediaQuery'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_VISIBLE = 4

const slide = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 40, filter: 'blur(6px)' }),
  center: { opacity: 1, x: 0, filter: 'blur(0px)' },
  exit: (dir: number) => ({ opacity: 0, x: dir * -40, filter: 'blur(6px)' }),
}

export function CalendarPage() {
  const today = useToday()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [direction, setDirection] = useState(0)
  const grid = useMemo(() => buildMonthGrid(month), [month])
  const { data: entries } = useAgenda(grid.from, grid.to)
  const { matches } = useWorkspaceFilter()
  const compact = useIsCompact()
  const [selected, setSelected] = useState(today)

  const byDate = useMemo(() => {
    const map = new Map<ISODate, AgendaEntry[]>()
    for (const e of entries) if (matches(e.workspace)) map.set(e.date, [...(map.get(e.date) ?? []), e])
    return map
  }, [entries, matches])

  const goTo = (target: Date) => {
    const next = startOfMonth(target)
    setDirection(Math.sign(next.getTime() - month.getTime()))
    setMonth(next)
  }

  const monthPrefix = format(month, 'yyyy-MM')
  const inMonth = entries.filter((e) => e.date.startsWith(monthPrefix) && matches(e.workspace))
  const hearings = inMonth.filter((e) => e.kind === 'hearing').length
  const meetings = inMonth.filter((e) => e.kind === 'meeting').length

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="relative h-14 overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false} custom={direction}>
              <motion.h1
                key={monthPrefix}
                initial={{ y: direction >= 0 ? 40 : -40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: direction >= 0 ? -40 : 40, opacity: 0 }}
                transition={{ duration: 0.45, ease: easeOutExpo }}
                className="font-display text-5xl leading-tight tracking-tight"
              >
                {format(month, 'MMMM')} <span className="text-muted-foreground italic">{format(month, 'yyyy')}</span>
              </motion.h1>
            </AnimatePresence>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="tabular-nums">{meetings} meetings & appointments</span>
            <span className="tabular-nums">· {hearings} hearings</span>
            <span className="tabular-nums">· {inMonth.length - meetings - hearings} tasks & follow-ups</span>
            <span className="flex items-center gap-3 border-l pl-3">
              {WORKSPACE_IDS.map((ws) => (
                <span key={ws} className="flex items-center gap-1 text-xs">
                  <WorkspaceDot ws={ws} /> {WORKSPACES[ws].short}
                </span>
              ))}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => goTo(new Date())}>
            Today
          </Button>
          <div className="flex rounded-full border bg-background p-0.5">
            <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label="Previous month" onClick={() => goTo(addMonths(month, -1))}>
              <ChevronLeft />
            </Button>
            <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label="Next month" onClick={() => goTo(addMonths(month, 1))}>
              <ChevronRight />
            </Button>
          </div>
        </div>
      </div>

      <LensNotice items={entries.filter((e) => e.date.startsWith(monthPrefix))} />

      <div className="overflow-hidden rounded-2xl border bg-card/80 shadow-float backdrop-blur">
        <div className="grid grid-cols-7 border-b text-center text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2.5">
              {d}
            </div>
          ))}
        </div>
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div key={monthPrefix} custom={direction} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.4, ease: easeOutExpo }}>
            {grid.weeks.map((week) => (
              <div key={week[0]} className="grid grid-cols-7 border-b last:border-b-0">
                {week.map((day) => (
                  compact ? (
                    <CompactDayCell key={day} day={day} month={month} today={today} selected={day === selected} entries={byDate.get(day) ?? []} onSelect={() => setSelected(day)} />
                  ) : (
                    <DayCell key={day} day={day} month={month} today={today} entries={byDate.get(day) ?? []} />
                  )
                ))}
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
      {compact && <SelectedDay day={selected} today={today} entries={byDate.get(selected) ?? []} />}
    </>
  )
}

/** Phone layout: a dot per item, colour = workspace; tap a day to list it below. */
function CompactDayCell({ day, month, today, selected, entries, onSelect }: { day: ISODate; month: Date; today: ISODate; selected: boolean; entries: AgendaEntry[]; onSelect: () => void }) {
  const date = parseISO(day)
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${format(date, 'EEEE d MMMM')}, ${entries.length} item${entries.length === 1 ? '' : 's'}`}
      className={cn('flex h-14 flex-col items-center gap-1 border-r pt-1.5 last:border-r-0', !isSameMonth(date, month) && 'text-muted-foreground/50')}
    >
      <span
        className={cn(
          'flex size-7 items-center justify-center rounded-full text-xs tabular-nums transition-colors',
          day === today && 'font-semibold text-ws-sb',
          selected && 'bg-foreground font-semibold text-background',
        )}
      >
        {format(date, 'd')}
      </span>
      <span className="flex gap-0.5">
        {entries.slice(0, 4).map((e) => (
          <span key={e.key} className={cn('size-1.5 rounded-full', WS_STYLE[e.workspace].dot, e.outcome.status !== 'open' && 'opacity-40')} />
        ))}
      </span>
    </button>
  )
}

function SelectedDay({ day, today, entries }: { day: ISODate; today: ISODate; entries: AgendaEntry[] }) {
  const navigate = useNavigate()
  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl">{format(parseISO(day), day === today ? "'Today', d MMM" : 'EEEE d MMM')}</h2>
        <Button variant="outline" size="sm" className="rounded-full" onClick={() => navigate(`/today/${day}`)}>
          Plan day
        </Button>
      </div>
      {entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Nothing on this day.</p>
      ) : (
        <ul className="grid gap-1.5">
          {entries.map((e) => (
            <EntryChip key={e.key} entry={e} large />
          ))}
        </ul>
      )}
    </section>
  )
}

function DayCell({ day, month, today, entries }: { day: ISODate; month: Date; today: ISODate; entries: AgendaEntry[] }) {
  const navigate = useNavigate()
  const editor = useEditor()
  const date = parseISO(day)
  const isToday = day === today
  const visible = entries.slice(0, MAX_VISIBLE)
  const hidden = entries.length - visible.length

  const presets = (kind: EditorRequest['kind']): EditorRequest => {
    switch (kind) {
      case 'task':
        return { kind, value: { dueDate: day } }
      case 'followUp':
        return { kind, value: { due: { date: day } } }
      case 'appointment':
      case 'meeting':
        return { kind, value: { slot: { date: day, start: 10 * 60, duration: kind === 'appointment' ? 45 : 60 } } }
      default:
        return { kind } as EditorRequest
    }
  }

  return (
    <div className={cn('group relative flex min-h-32 flex-col gap-1 border-r p-1.5 transition-colors last:border-r-0 hover:bg-muted/40', !isSameMonth(date, month) && 'bg-muted/25 text-muted-foreground/70', isSameMonth(date, month) && isWeekend(date) && 'bg-muted/15')}>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(`/today/${day}`)}
          aria-label={`Plan ${format(date, 'EEEE d MMMM')}`}
          className={cn('relative flex size-7 items-center justify-center rounded-full text-xs tabular-nums transition-colors hover:bg-foreground hover:text-background', isToday && 'bg-foreground font-semibold text-background')}
        >
          {isToday && <motion.span className="absolute inset-0 rounded-full ring-2 ring-foreground/30" animate={{ scale: [1, 1.35], opacity: [0.8, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }} />}
          {format(date, 'd')}
        </button>
        <ActionMenu
          trigger={
            <motion.button
              type="button"
              whileHover={{ rotate: 90 }}
              transition={spring.snappy}
              aria-label={`Add on ${day}`}
              className="flex size-6 items-center justify-center rounded-full text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-foreground hover:text-background focus-visible:opacity-100 data-popup-open:opacity-100"
            />
          }
          triggerContent={<Plus className="size-3.5" />}
          contentProps={{ align: 'end', className: 'w-44' }}
          items={CREATE_MENU.slice(0, 4).map((c) => ({ key: c.kind, label: c.label, icon: <c.icon />, onSelect: () => editor.open(presets(c.kind)) }))}
        />
      </div>
      <ul className="flex flex-col gap-0.5">
        {visible.map((e) => (
          <EntryChip key={e.key} entry={e} />
        ))}
        {hidden > 0 && (
          <li>
            <button type="button" onClick={() => navigate(`/today/${day}`)} className="px-1.5 text-[11px] text-muted-foreground hover:text-foreground">
              +{hidden} more
            </button>
          </li>
        )}
      </ul>
    </div>
  )
}

function EntryChip({ entry: e, large = false }: { entry: AgendaEntry; large?: boolean }) {
  const { openRef } = useEditor()
  const Icon = entryIcon(e)
  const ws = WS_STYLE[e.workspace]
  const closed = e.outcome.status !== 'open'
  const StatusIcon = OUTCOME_STYLE[e.outcome.status].icon
  return (
    <motion.li layout initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={spring.snappy}>
      <button
        type="button"
        onClick={() => openRef(e.ref)}
        title={`${entryLabel(e)}: ${e.title}${e.subtitle ? ` — ${e.subtitle}` : ''}`}
        className={cn('flex w-full items-center gap-1 rounded-md px-1 py-0.5 text-left text-[11.5px] font-medium transition-[filter] hover:brightness-95', large && 'gap-2 rounded-xl px-3 py-2.5 text-sm', ws.soft, e.kind === 'hearing' && 'ring-1 ring-ws-sb/40')}
      >
        {closed ? <StatusIcon className={cn('size-3 shrink-0', OUTCOME_STYLE[e.outcome.status].className)} /> : <Icon className={cn('size-3 shrink-0', ws.text)} />}
        {e.slot && <span className="shrink-0 text-foreground/50 tabular-nums">{formatClock(e.slot.start)}</span>}
        <span className={cn('truncate text-foreground/85', closed && 'line-through opacity-60')}>{e.title}</span>
      </button>
    </motion.li>
  )
}

