import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { blockEnd } from '@/domain/planner/dayPlan'
import type { ScheduledItem } from '@/domain/planner/dayPlan'
import { formatDuration, formatMinutes, ITEM_TYPE_STYLES } from '@/presentation/calendar/itemStyles'
import { easeOutExpo } from '@/presentation/motion/presets'

/** What's happening right now and what comes next, for today only. */
export function NowNext({ scheduled, now }: { scheduled: ScheduledItem[]; now: number }) {
  const open = scheduled.filter((i) => !i.completed)
  const current = open.find((i) => i.schedule.start <= now && blockEnd(i.schedule) > now)
  const next = open.find((i) => i.schedule.start > now)

  const headline = current
    ? { label: 'Now', item: current, detail: `${formatDuration(Math.ceil(blockEnd(current.schedule) - now))} left` }
    : next
      ? { label: 'Free for', item: null, detail: formatDuration(Math.floor(next.schedule.start - now)) }
      : { label: 'Done for the day', item: null, detail: 'Nothing left on the timeline' }

  const progress = current ? (now - current.schedule.start) / current.schedule.duration : 0

  return (
    <section className="rounded-2xl border bg-card/70 p-4 backdrop-blur">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={current?.id ?? headline.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: easeOutExpo }}
        >
          <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{headline.label}</div>
          {headline.item ? (
            <>
              <div className="mt-1 truncate font-display text-2xl leading-tight">{headline.item.title}</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className={cn('h-full rounded-full', ITEM_TYPE_STYLES[headline.item.type].accent)}
                  initial={false}
                  animate={{ width: `${Math.min(100, progress * 100)}%` }}
                  transition={{ duration: 0.8, ease: easeOutExpo }}
                />
              </div>
              <div className="mt-1.5 text-xs text-muted-foreground tabular-nums">{headline.detail}</div>
            </>
          ) : (
            <div className="mt-1 font-display text-2xl leading-tight">{headline.detail}</div>
          )}
        </motion.div>
      </AnimatePresence>
      {next && (
        <div className="mt-3 flex items-center gap-2 border-t pt-3 text-xs">
          <span className="text-muted-foreground">Next</span>
          <span className={cn('size-2 shrink-0 rounded-full', ITEM_TYPE_STYLES[next.type].accent)} />
          <span className="min-w-0 flex-1 truncate font-medium">{next.title}</span>
          <span className="text-muted-foreground tabular-nums">{formatMinutes(next.schedule.start)}</span>
        </div>
      )}
    </section>
  )
}
