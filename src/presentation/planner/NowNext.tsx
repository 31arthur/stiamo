import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { blockEnd } from '@/domain/planner/dayPlan'
import type { ScheduledEntry } from '@/domain/planner/dayPlan'
import { formatClock, formatDuration } from '@/domain/shared/time'
import { entryIcon } from '@/presentation/components/kinds'
import { WS_STYLE } from '@/presentation/components/workspace'
import { easeOutExpo } from '@/presentation/motion/presets'

/** What's happening right now and what comes next, for today only. */
export function NowNext({ scheduled, now }: { scheduled: ScheduledEntry[]; now: number }) {
  const open = scheduled.filter((e) => e.outcome.status === 'open')
  const current = open.find((e) => e.slot.start <= now && blockEnd(e.slot) > now)
  const next = open.find((e) => e.slot.start > now)
  const progress = current ? (now - current.slot.start) / current.slot.duration : 0
  const NextIcon = next && entryIcon(next)

  return (
    <section className="rounded-2xl border bg-card/70 p-4 backdrop-blur">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={current?.key ?? (next ? 'free' : 'done')} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease: easeOutExpo }}>
          <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{current ? 'Now' : next ? 'Free for' : 'Done for the day'}</div>
          {current ? (
            <>
              <div className="mt-1 truncate font-display text-2xl leading-tight">{current.title}</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <motion.div className={cn('h-full rounded-full', WS_STYLE[current.workspace].bar)} initial={false} animate={{ width: `${Math.min(100, progress * 100)}%` }} transition={{ duration: 0.8, ease: easeOutExpo }} />
              </div>
              <div className="mt-1.5 text-xs text-muted-foreground tabular-nums">{formatDuration(Math.ceil(blockEnd(current.slot) - now))} left</div>
            </>
          ) : (
            <div className="mt-1 font-display text-2xl leading-tight">{next ? formatDuration(Math.floor(next.slot.start - now)) : 'Nothing left on the timeline'}</div>
          )}
        </motion.div>
      </AnimatePresence>
      {next && NextIcon && (
        <div className="mt-3 flex items-center gap-2 border-t pt-3 text-xs">
          <span className="text-muted-foreground">Next</span>
          <NextIcon className={cn('size-3.5 shrink-0', WS_STYLE[next.workspace].text)} />
          <span className="min-w-0 flex-1 truncate font-medium">{next.title}</span>
          <span className="text-muted-foreground tabular-nums">{formatClock(next.slot.start)}</span>
        </div>
      )}
    </section>
  )
}
