import { useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { motion } from 'motion/react'
import { AlertTriangle, Lock, Pin } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgendaEntry } from '@/domain/agenda/agenda'
import { DAY_END, MIN_DURATION, SLOT_MINUTES, snapToSlot } from '@/domain/planner/dayPlan'
import type { ScheduledEntry } from '@/domain/planner/dayPlan'
import type { OutcomeTarget } from '@/domain/shared/RecordOutcomeUseCase'
import { formatClock, formatDuration } from '@/domain/shared/time'
import { entryIcon, entryLabel } from '@/presentation/components/kinds'
import { OutcomeControl } from '@/presentation/components/outcome'
import { WS_STYLE } from '@/presentation/components/workspace'
import { spring } from '@/presentation/motion/presets'
import { dragId, minuteToY, PX_PER_MINUTE } from './geometry'

export interface TimelineBlockActions {
  onMove: (entry: AgendaEntry, start: number) => void
  onResize: (entry: ScheduledEntry, duration: number) => void
  onUnschedule: (entry: AgendaEntry) => void
  onOpen: (entry: AgendaEntry) => void
}

interface TimelineBlockProps extends TimelineBlockActions {
  entry: ScheduledEntry
  column: number
  columns: number
  conflict: boolean
  isPast: boolean
  /** Skip the position spring (right after a drop, where the overlay already showed the landing). */
  instant: boolean
  /** Stagger used when many blocks move at once (reflow). */
  delay: number
}

export function TimelineBlock({ entry, column, columns, conflict, isPast, instant, delay, ...actions }: TimelineBlockProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: dragId(entry.key), data: { entry }, disabled: !entry.movable })
  const [liveDuration, setLiveDuration] = useState<number | null>(null)
  const duration = liveDuration ?? entry.slot.duration
  const ws = WS_STYLE[entry.workspace]
  const Icon = entryIcon(entry)
  const closed = entry.outcome.status !== 'open'
  const compact = duration < 40
  const height = Math.max(duration * PX_PER_MINUTE - 3, 16)
  const geometry = {
    top: minuteToY(entry.slot.start),
    height,
    left: `calc(${(column / columns) * 100}% + 4px)`,
    width: `calc(${100 / columns}% - 8px)`,
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!entry.movable) return
    const step = e.altKey ? SLOT_MINUTES * 4 : SLOT_MINUTES
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const dir = e.key === 'ArrowUp' ? -1 : 1
      if (e.shiftKey) actions.onResize(entry, Math.max(MIN_DURATION, entry.slot.duration + dir * step))
      else actions.onMove(entry, entry.slot.start + dir * step)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      actions.onOpen(entry)
    } else if ((e.key === 'Backspace' || e.key === 'Delete') && entry.kind !== 'meeting') {
      e.preventDefault()
      actions.onUnschedule(entry)
    }
  }

  function startResize(e: PointerEvent<HTMLDivElement>) {
    e.stopPropagation()
    e.preventDefault()
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    const originY = e.clientY
    const base = entry.slot.duration
    const max = DAY_END - entry.slot.start
    const next = (y: number) => Math.min(max, Math.max(MIN_DURATION, snapToSlot(base + (y - originY) / PX_PER_MINUTE)))
    const onMove = (ev: globalThis.PointerEvent) => setLiveDuration(next(ev.clientY))
    const onUp = (ev: globalThis.PointerEvent) => {
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      const d = next(ev.clientY)
      if (d !== base) actions.onResize(entry, d)
      setLiveDuration(null)
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
  }

  return (
    <motion.div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onKeyDown={handleKeyDown}
      aria-label={`${entryLabel(entry)}: ${entry.title}, ${formatClock(entry.slot.start)} to ${formatClock(entry.slot.start + duration)}`}
      aria-roledescription="time block"
      aria-describedby="timeline-block-help"
      // Mount already in place; only later moves (drag, reflow, resize) animate.
      initial={{ opacity: 0, scale: 0.96, ...geometry }}
      animate={{ opacity: isDragging ? 0.35 : 1, scale: 1, ...geometry }}
      transition={instant || liveDuration !== null ? { duration: 0, opacity: { duration: 0.15 } } : { ...spring.soft, delay, opacity: { duration: 0.15 } }}
      className={cn(
        'group/block absolute z-10 flex touch-manipulation overflow-hidden rounded-lg border border-black/5 text-left outline-none select-none dark:border-white/5',
        'shadow-[0_1px_2px_oklch(0_0_0/6%)] transition-shadow hover:z-20 hover:shadow-float focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-ring',
        entry.movable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
        ws.soft,
        entry.kind === 'hearing' && 'bg-[repeating-linear-gradient(135deg,transparent_0_8px,oklch(0_0_0/3%)_8px_16px)]',
        isDragging && 'border-dashed border-current shadow-none',
        isPast && !closed && 'saturate-50',
        closed && 'opacity-70',
        conflict && 'ring-2 ring-destructive/60',
      )}
    >
      <span className={cn('w-1 shrink-0', ws.bar)} />
      <div className={cn('flex min-w-0 flex-1 gap-1.5 pr-6 pl-1.5', compact ? 'items-center' : 'flex-col py-1')}>
        <div className="flex min-w-0 items-center gap-1">
          <span onPointerDown={(e) => e.stopPropagation()} className="contents">
            <OutcomeControl target={entry.kind as OutcomeTarget} id={entry.ref.id} outcome={entry.outcome} size="sm" />
          </span>
          <Icon className={cn('size-3.5 shrink-0', ws.text)} />
          <button
            type="button"
            tabIndex={-1}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => actions.onOpen(entry)}
            className={cn('truncate text-[13px] font-medium text-foreground hover:underline', closed && 'line-through decoration-foreground/40')}
          >
            {entry.title}
          </button>
        </div>
        <div className={cn('flex shrink-0 items-center gap-1.5 text-[11px] text-foreground/60 tabular-nums', compact ? 'ml-auto' : 'pl-6')}>
          <span>
            {formatClock(entry.slot.start)}
            {!compact && ` – ${formatClock(entry.slot.start + duration)}`}
          </span>
          {!compact && <span className="opacity-70">· {formatDuration(duration)}</span>}
          {conflict && <AlertTriangle className="size-3 text-destructive" aria-label="Overlaps another block" />}
        </div>
        {!compact && duration >= 45 && entry.subtitle && <p className="truncate pl-6 text-[11px] text-foreground/55">{entry.subtitle}</p>}
      </div>
      {entry.pinned && (
        <span className="absolute top-1 right-1.5 text-foreground/50" title={entry.movable ? 'Fixed time — reflow flows around it' : 'Set by the court'}>
          {entry.movable ? <Pin className="size-3" /> : <Lock className="size-3" />}
        </span>
      )}
      {entry.movable && (
        <div onPointerDown={startResize} aria-hidden className="absolute inset-x-0 bottom-0 flex h-2.5 cursor-ns-resize touch-none items-end justify-center opacity-0 group-hover/block:opacity-100 pointer-coarse:h-4 pointer-coarse:opacity-100">
          <span className="mb-0.5 h-1 w-8 rounded-full bg-foreground/30" />
        </div>
      )}
      {liveDuration !== null && (
        <span className="absolute right-2 bottom-1.5 rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background tabular-nums">{formatDuration(liveDuration)}</span>
      )}
    </motion.div>
  )
}
