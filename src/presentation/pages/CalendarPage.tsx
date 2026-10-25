import { useMemo, useState } from 'react'
import { addMonths, format, isSameMonth, isWeekend, parseISO, startOfMonth } from 'date-fns'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
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
import { OUTCOME_STYLE } from '@/presentation/components/outcome'
import { WS_STYLE, WorkspaceDot } from '@/presentation/components/workspace'
import { useAgenda, useToday } from '@/presentation/data/hooks'
import { CREATE_MENU } from '@/presentation/layout/createMenu'
import { easeOutExpo, spring } from '@/presentation/motion/presets'

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
                  <DayCell key={day} day={day} month={month} today={today} entries={byDate.get(day) ?? []} />
                ))}
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
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
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <motion.button
                type="button"
                whileHover={{ rotate: 90 }}
                transition={spring.snappy}
                aria-label={`Add on ${day}`}
                className="flex size-6 items-center justify-center rounded-full text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-foreground hover:text-background focus-visible:opacity-100 data-popup-open:opacity-100"
              />
            }
          >
            <Plus className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {CREATE_MENU.slice(0, 4).map((c) => (
              <DropdownMenuItem key={c.kind} onClick={() => editor.open(presets(c.kind))}>
                <c.icon /> {c.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
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

function EntryChip({ entry: e }: { entry: AgendaEntry }) {
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
        className={cn('flex w-full items-center gap-1 rounded-md px-1 py-0.5 text-left text-[11.5px] font-medium transition-[filter] hover:brightness-95', ws.soft, e.kind === 'hearing' && 'ring-1 ring-ws-sb/40')}
      >
        {closed ? <StatusIcon className={cn('size-3 shrink-0', OUTCOME_STYLE[e.outcome.status].className)} /> : <Icon className={cn('size-3 shrink-0', ws.text)} />}
        {e.slot && <span className="shrink-0 text-foreground/50 tabular-nums">{formatClock(e.slot.start)}</span>}
        <span className={cn('truncate text-foreground/85', closed && 'line-through opacity-60')}>{e.title}</span>
      </button>
    </motion.li>
  )
}

