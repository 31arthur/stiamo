import { useState } from 'react'
import type { CSSProperties, MouseEvent, RefObject } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { AnimatePresence, motion } from 'motion/react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { blockEnd, DAY_END, DAY_START, SLOT_MINUTES } from '@/domain/planner/dayPlan'
import type { Block, DayPlan } from '@/domain/planner/dayPlan'
import { formatClock, formatDuration } from '@/domain/shared/time'
import type { WorkspaceId } from '@/domain/shared/workspace'
import { WS_STYLE } from '@/presentation/components/workspace'
import { spring } from '@/presentation/motion/presets'
import { HOUR_HEIGHT, minuteToY, PX_PER_MINUTE, TIMELINE_DROP_ID, yToMinute } from './geometry'
import { TimelineBlock } from './TimelineBlock'
import type { TimelineBlockActions } from './TimelineBlock'

interface TimelineProps extends TimelineBlockActions {
  plan: DayPlan
  /** Minutes since midnight when viewing today; null for other days. */
  now: number | null
  preview: (Block & { workspace: WorkspaceId }) | null
  isDragging: boolean
  instantKey: string | null
  reflowing: boolean
  scrollRef: RefObject<HTMLDivElement | null>
  contentRef: RefObject<HTMLDivElement | null>
  onAddAt: (minute: number) => void
}

const HOURS = Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) => DAY_START + i * 60)

export function Timeline({ plan, now, preview, isDragging, instantKey, reflowing, scrollRef, contentRef, onAddAt, ...actions }: TimelineProps) {
  const { setNodeRef, isOver } = useDroppable({ id: TIMELINE_DROP_ID })
  const [hoverMinute, setHoverMinute] = useState<number | null>(null)

  const setContentRef = (el: HTMLDivElement | null) => {
    setNodeRef(el)
    contentRef.current = el
  }

  const minuteFromPointer = (e: MouseEvent<HTMLDivElement>) =>
    Math.floor(yToMinute(e.clientY - e.currentTarget.getBoundingClientRect().top) / SLOT_MINUTES) * SLOT_MINUTES
  const onBackground = (e: MouseEvent<HTMLDivElement>) => e.target === e.currentTarget

  return (
    <div ref={scrollRef} className="scrollbar-thin relative h-full overflow-y-auto overscroll-contain">
      <p id="timeline-block-help" className="sr-only">
        Arrow keys move by 15 minutes, Alt for an hour. Shift plus arrows resizes. Enter opens. Delete takes it off the timeline.
      </p>
      <div className="relative flex" style={{ height: (DAY_END - DAY_START) * PX_PER_MINUTE + 16 }}>
        <div className="relative w-14 shrink-0 select-none" aria-hidden>
          {HOURS.map((m) => (
            <span key={m} className="absolute right-3 -translate-y-1/2 text-[11px] text-muted-foreground tabular-nums" style={{ top: minuteToY(m) + 8 }}>
              {m === DAY_START ? '' : formatClock(m)}
            </span>
          ))}
        </div>

        <div className="relative mt-2 flex-1">
          <div
            ref={setContentRef}
            className={cn('timeline-grid absolute inset-x-0 top-0 rounded-l-md border-l transition-colors', isOver && 'bg-muted/30')}
            style={{ '--hour-height': `${HOUR_HEIGHT}px`, height: (DAY_END - DAY_START) * PX_PER_MINUTE } as CSSProperties}
            onPointerMove={(e) => setHoverMinute(!isDragging && onBackground(e) ? minuteFromPointer(e) : null)}
            onPointerLeave={() => setHoverMinute(null)}
            onClick={(e) => onBackground(e) && onAddAt(minuteFromPointer(e))}
          >
            {now !== null && now > DAY_START && (
              <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-muted/10 to-muted/50" style={{ height: minuteToY(Math.min(now, DAY_END)) }} />
            )}

            <AnimatePresence>
              {hoverMinute !== null && (
                <motion.div
                  key="hover"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, top: minuteToY(hoverMinute) }}
                  exit={{ opacity: 0 }}
                  transition={{ top: spring.snappy, opacity: { duration: 0.12 } }}
                  className="pointer-events-none absolute inset-x-1 flex items-center gap-1 rounded-md border border-dashed border-foreground/15 px-2 text-[11px] text-muted-foreground"
                  style={{ height: SLOT_MINUTES * 2 * PX_PER_MINUTE }}
                >
                  <Plus className="size-3" /> {formatClock(hoverMinute)}
                </motion.div>
              )}
            </AnimatePresence>

            {plan.scheduled.map((entry, index) => {
              const { column, columns } = plan.layout.get(entry.key) ?? { column: 0, columns: 1 }
              return (
                <TimelineBlock
                  key={entry.key}
                  entry={entry}
                  column={column}
                  columns={columns}
                  conflict={plan.conflicts.has(entry.key)}
                  isPast={now !== null && blockEnd(entry.slot) <= now}
                  instant={entry.key === instantKey}
                  delay={reflowing ? index * 0.035 : 0}
                  {...actions}
                />
              )
            })}

            <AnimatePresence>
              {preview && (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1, top: minuteToY(preview.start), height: preview.duration * PX_PER_MINUTE - 3 }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                  transition={{ top: spring.snappy, height: spring.snappy, opacity: { duration: 0.12 } }}
                  className={cn('pointer-events-none absolute inset-x-1 z-30 rounded-lg border-2 border-dashed', WS_STYLE[preview.workspace].soft, WS_STYLE[preview.workspace].border)}
                >
                  <span className="absolute -top-2.5 left-2 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold text-background tabular-nums shadow-float">
                    {formatClock(preview.start)} – {formatClock(blockEnd(preview))} · {formatDuration(preview.duration)}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {now !== null && now >= DAY_START && now <= DAY_END && (
              <motion.div className="pointer-events-none absolute inset-x-0 z-40 flex items-center" initial={false} animate={{ top: minuteToY(now) }} transition={spring.gentle}>
                <span className="relative -ml-1.5 flex size-3">
                  <motion.span className="absolute inset-0 rounded-full bg-now" animate={{ scale: [1, 2.2], opacity: [0.5, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }} />
                  <span className="relative size-3 rounded-full bg-now ring-2 ring-background" />
                </span>
                <span className="h-0.5 flex-1 bg-now" />
                <span className="absolute -top-5 -left-14 w-12 text-right text-[11px] font-semibold text-now tabular-nums">{formatClock(Math.floor(now))}</span>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
