import { useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, Check, Pin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DAY_END, isPinned, MIN_DURATION, SLOT_MINUTES, snapToSlot } from '@/domain/planner/dayPlan'
import type { ScheduledItem } from '@/domain/planner/dayPlan'
import { formatDuration, formatMinutes, ITEM_TYPE_STYLES } from '@/presentation/calendar/itemStyles'
import { spring } from '@/presentation/motion/presets'
import { dragId, minuteToY, PX_PER_MINUTE } from './geometry'

export interface TimelineBlockActions {
  onMove: (item: ScheduledItem, start: number) => void
  onResize: (item: ScheduledItem, duration: number) => void
  onToggleComplete: (item: ScheduledItem) => void
  onTogglePin: (item: ScheduledItem) => void
  onUnschedule: (item: ScheduledItem) => void
}

interface TimelineBlockProps extends TimelineBlockActions {
  item: ScheduledItem
  column: number
  columns: number
  conflict: boolean
  isPast: boolean
  /** Skip the position spring (e.g. right after a drop, where the overlay already showed the landing). */
  instant: boolean
  /** Stagger index used when many blocks move at once (reflow). */
  delay: number
}

export function TimelineBlock({ item, column, columns, conflict, isPast, instant, delay, ...actions }: TimelineBlockProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId(item.id),
    data: { item },
  })
  const [liveDuration, setLiveDuration] = useState<number | null>(null)
  const duration = liveDuration ?? item.schedule.duration
  const style = ITEM_TYPE_STYLES[item.type]
  const pinned = isPinned(item)
  const compact = duration < 40
  const height = Math.max(duration * PX_PER_MINUTE - 3, 18)

  function handleKeyDown(e: KeyboardEvent) {
    const step = e.altKey ? SLOT_MINUTES * 4 : SLOT_MINUTES
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const dir = e.key === 'ArrowUp' ? -1 : 1
      if (e.shiftKey) actions.onResize(item, Math.max(MIN_DURATION, item.schedule.duration + dir * step))
      else actions.onMove(item, item.schedule.start + dir * step)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      actions.onToggleComplete(item)
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      actions.onUnschedule(item)
    } else if (e.key.toLowerCase() === 'p') {
      actions.onTogglePin(item)
    }
  }

  function startResize(e: PointerEvent<HTMLDivElement>) {
    e.stopPropagation()
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const originY = e.clientY
    const base = item.schedule.duration
    const max = DAY_END - item.schedule.start
    const target = e.currentTarget
    const onMove = (ev: globalThis.PointerEvent) => {
      const next = snapToSlot(base + (ev.clientY - originY) / PX_PER_MINUTE)
      setLiveDuration(Math.min(max, Math.max(MIN_DURATION, next)))
    }
    const onUp = (ev: globalThis.PointerEvent) => {
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      const next = Math.min(max, Math.max(MIN_DURATION, snapToSlot(base + (ev.clientY - originY) / PX_PER_MINUTE)))
      if (next !== base) actions.onResize(item, next)
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
      aria-label={`${item.title}, ${formatMinutes(item.schedule.start)} to ${formatMinutes(item.schedule.start + duration)}`}
      aria-roledescription="time block"
      aria-describedby="timeline-block-help"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{
        opacity: isDragging ? 0.35 : 1,
        scale: 1,
        top: minuteToY(item.schedule.start),
        height,
        left: `calc(${(column / columns) * 100}% + 4px)`,
        width: `calc(${100 / columns}% - 8px)`,
      }}
      transition={
        instant || liveDuration !== null
          ? { duration: 0, opacity: { duration: 0.15 } }
          : { ...spring.soft, delay, opacity: { duration: 0.15 } }
      }
      whileHover={isDragging ? undefined : { y: -1 }}
      className={cn(
        'group/block absolute z-10 flex cursor-grab touch-none overflow-hidden rounded-lg border border-black/5 text-left outline-none select-none active:cursor-grabbing dark:border-white/5',
        'shadow-[0_1px_2px_oklch(0_0_0/6%)] transition-shadow hover:z-20 hover:shadow-float focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-ring',
        style.chip,
        isDragging && 'border-dashed border-current shadow-none',
        isPast && !item.completed && 'saturate-50',
        item.completed && 'opacity-70',
        conflict && 'ring-2 ring-destructive/60',
      )}
    >
      <span className={cn('w-1 shrink-0', style.accent)} />
      <div className={cn('flex min-w-0 flex-1 gap-1.5 pr-6 pl-2', compact ? 'items-center py-0' : 'flex-col py-1.5')}>
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => actions.onToggleComplete(item)}
            aria-label={item.completed ? 'Mark as not done' : 'Mark as done'}
            aria-pressed={item.completed}
            tabIndex={-1}
            className={cn(
              'flex size-4 shrink-0 items-center justify-center rounded-full border-[1.5px] border-current transition-colors',
              item.completed && style.accent,
            )}
          >
            <AnimatePresence>
              {item.completed && (
                <motion.span initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={spring.snappy}>
                  <Check className="size-2.5 text-white" strokeWidth={4} />
                </motion.span>
              )}
            </AnimatePresence>
          </button>
          <span className={cn('truncate text-[13px] font-medium text-foreground', item.completed && 'line-through decoration-foreground/40')}>
            {item.title}
          </span>
        </div>
        <div className={cn('flex shrink-0 items-center gap-1.5 text-[11px] tabular-nums opacity-80', compact && 'ml-auto')}>
          <span>
            {formatMinutes(item.schedule.start)}
            {!compact && ` – ${formatMinutes(item.schedule.start + duration)}`}
          </span>
          {!compact && <span className="opacity-60">· {formatDuration(duration)}</span>}
          {conflict && <AlertTriangle className="size-3 text-destructive" aria-label="Overlaps another block" />}
        </div>
        {!compact && duration >= 75 && item.notes && <p className="line-clamp-2 text-[11px] text-foreground/60">{item.notes}</p>}
      </div>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => actions.onTogglePin(item)}
        tabIndex={-1}
        aria-label={pinned ? 'Unpin' : 'Pin to this time'}
        className={cn(
          'absolute top-1 right-1 flex size-5 items-center justify-center rounded-md transition-opacity hover:bg-black/5 dark:hover:bg-white/10',
          pinned ? 'opacity-80' : 'opacity-0 group-hover/block:opacity-60',
        )}
      >
        <Pin className={cn('size-3', pinned && 'fill-current')} />
      </button>
      <div
        onPointerDown={startResize}
        aria-hidden
        className="absolute inset-x-0 bottom-0 flex h-2.5 cursor-ns-resize items-end justify-center opacity-0 group-hover/block:opacity-100"
      >
        <span className="mb-0.5 h-1 w-8 rounded-full bg-current opacity-40" />
      </div>
      {liveDuration !== null && (
        <span className="absolute right-2 bottom-1.5 rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background tabular-nums">
          {formatDuration(liveDuration)}
        </span>
      )}
    </motion.div>
  )
}
