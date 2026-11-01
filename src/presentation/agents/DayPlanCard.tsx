import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { motion } from 'motion/react'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, CalendarClock, Check, ChevronDown, Phone, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { DayPlan } from '@/domain/ai/AgentApi'
import { cn } from '@/lib/utils'
import { useServices } from '@/presentation/app/services'
import { useUserId } from '@/presentation/data/hooks'
import { toast } from '@/presentation/notifications/toast'
import { ago } from './format'

/** The blocks of a schedule, in time order: when, how long, and whether it is a call or a task. */
export function ScheduleList({ blocks }: { blocks: DayPlan['blocks'] }) {
  return (
    <ol className="grid gap-1">
      {blocks.map((b) => (
        <li key={`${b.kind}:${b.id}`} className="flex items-center gap-3 rounded-lg bg-muted/50 px-2.5 py-1.5 text-sm">
          <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
            {b.from}–{b.to}
          </span>
          {b.kind === 'followUp' ? <Phone className="size-3.5 shrink-0 text-muted-foreground" /> : <Check className="size-3.5 shrink-0 text-muted-foreground" />}
          <span className="min-w-0 flex-1 truncate">{b.title}</span>
        </li>
      ))}
    </ol>
  )
}

/** A plan for a day, from the daily planner: read it, then put it on your planner or leave it. */
export function DayPlanCard({ plan }: { plan: DayPlan }) {
  const { agent } = useServices()
  const client = useQueryClient()
  const userId = useUserId()
  const [busy, setBusy] = useState<'apply' | 'dismiss' | null>(null)
  const [all, setAll] = useState(false)
  const day = format(parseISO(plan.day), 'EEEE d MMMM')

  async function decide(kind: 'apply' | 'dismiss') {
    setBusy(kind)
    try {
      if (kind === 'apply') {
        const done = await agent.applyDayPlan(plan.id)
        toast.success(`Planned ${format(parseISO(plan.day), 'EEE d MMM')}`, { description: `${done.booked} ${done.booked === 1 ? 'item' : 'items'} put on your planner.` })
      } else {
        await agent.dismissDayPlan(plan.id)
      }
      await client.invalidateQueries({ queryKey: ['agent', 'dayPlans', userId] })
    } catch (e) {
      toast.error(kind === 'apply' ? 'Couldn’t put it on your planner' : 'Couldn’t dismiss it', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setBusy(null)
    }
  }

  return (
    <motion.article layout="position" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }} className="relative overflow-hidden rounded-2xl border bg-card/80">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-primary" />
      <div className="grid gap-3 p-4 pl-5">
        <header className="flex items-center gap-2 text-xs">
          <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarClock className="size-3.5" />
          </span>
          <span className="font-medium">Plan for {day}</span>
          <span className="ml-auto text-muted-foreground">{ago(plan.createdAt)}</span>
        </header>
        <div className="relative">
          <p className={cn('text-sm break-words whitespace-pre-line', !all && 'line-clamp-6')}>{plan.briefing || 'The planner had nothing to say about this day.'}</p>
          {plan.briefing.length > 380 && (
            <button type="button" onClick={() => setAll(!all)} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
              <ChevronDown className={cn('size-3.5 transition-transform', all && 'rotate-180')} /> {all ? 'Show less' : 'Read all'}
            </button>
          )}
        </div>
        {plan.blocks.length > 0 ? (
          <div className="grid gap-1.5">
            <h3 className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">Proposed schedule</h3>
            <ScheduleList blocks={plan.blocks} />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No schedule was proposed: nothing was left to place.</p>
        )}
        <footer className="flex flex-wrap items-center gap-2 pt-1">
          <Button size="sm" onClick={() => void decide('apply')} disabled={busy !== null || plan.blocks.length === 0}>
            {busy === 'apply' ? <Spinner size="xs" tone="current" decorative /> : <CalendarCheck />} Put it on my planner
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void decide('dismiss')} disabled={busy !== null}>
            {busy === 'dismiss' ? <Spinner size="xs" tone="current" decorative /> : <X />} Not this plan
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">Nothing is booked until you say so.</span>
        </footer>
      </div>
    </motion.article>
  )
}
