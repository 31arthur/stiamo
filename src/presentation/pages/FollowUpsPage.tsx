import { useMemo } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Mail, MapPin, MessageSquare, Phone, Plus, ShieldCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { followUpKey } from '@/domain/followups/FollowUp'
import type { FollowUp, FollowUpChannel } from '@/domain/followups/FollowUp'
import { CONFIRMATION_LABELS } from '@/domain/meetings/Meeting'
import type { ISODate } from '@/domain/shared/types'
import { useEditor } from '@/presentation/app/create'
import { useWorkspaceFilter } from '@/presentation/app/workspaceFilter'
import { friendlyDateTime } from '@/presentation/components/dates'
import { ClickableRow, EmptyState, PageHeader, Section, Stat } from '@/presentation/components/layout'
import { OutcomeControl, OutcomeNote } from '@/presentation/components/outcome'
import { RefChip } from '@/presentation/components/RefChip'
import { WorkspaceBadge } from '@/presentation/components/workspace'
import { useEntities, useToday } from '@/presentation/data/hooks'
import { spring } from '@/presentation/motion/presets'

export const CHANNEL_ICON: Record<FollowUpChannel, LucideIcon> = { call: Phone, message: MessageSquare, email: Mail, visit: MapPin }

export function FollowUpsPage() {
  const today = useToday()
  const { open } = useEditor()
  const { matches } = useWorkspaceFilter()
  const { data: followUps } = useEntities('followUp')

  const { overdue, todays, upcoming, logged } = useMemo(() => {
    const mine = followUps.filter((f) => matches(f.workspace)).sort((a, b) => followUpKey(a).localeCompare(followUpKey(b)))
    const openOnes = mine.filter((f) => f.outcome.status === 'open')
    return {
      overdue: openOnes.filter((f) => f.due.date < today),
      todays: openOnes.filter((f) => f.due.date === today),
      upcoming: openOnes.filter((f) => f.due.date > today),
      logged: mine
        .filter((f) => f.outcome.status !== 'open')
        .sort((a, b) => (b.outcome.recordedAt ?? '').localeCompare(a.outcome.recordedAt ?? ''))
        .slice(0, 15),
    }
  }, [followUps, matches, today])

  return (
    <>
      <PageHeader
        title="Follow-ups"
        description="Calls, messages, emails and visits to make — including the confirmations for every appointment, created and rescheduled for you."
        actions={
          <Button onClick={() => open({ kind: 'followUp' })}>
            <Plus /> New follow-up
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Overdue" value={overdue.length} tone={overdue.length ? 'danger' : 'default'} />
        <Stat label="Due today" value={todays.length} tone={todays.length ? 'warning' : 'default'} />
        <Stat label="Upcoming" value={upcoming.length} />
        <Stat label="Logged recently" value={logged.length} tone="success" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="grid content-start gap-4">
          <FollowUpGroup title="Overdue" items={overdue} today={today} tone="danger" />
          <FollowUpGroup title="Today" items={todays} today={today} empty="Nothing to chase today." />
        </div>
        <div className="grid content-start gap-4">
          <FollowUpGroup title="Upcoming" items={upcoming} today={today} />
          <FollowUpGroup title="Recently logged" items={logged} today={today} />
        </div>
      </div>
    </>
  )
}

function FollowUpGroup({ title, items, today, tone, empty }: { title: string; items: FollowUp[]; today: ISODate; tone?: 'danger'; empty?: string }) {
  if (!items.length && !empty) return null
  return (
    <Section title={title} className={cn(tone === 'danger' && 'border-destructive/30')} bodyClassName="p-1.5">
      {items.length === 0 ? (
        <EmptyState title={empty!} className="py-6" />
      ) : (
        <ul className="grid">
          <AnimatePresence initial={false}>
            {items.map((f) => (
              <FollowUpRow key={f.id} followUp={f} today={today} />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Section>
  )
}

export function FollowUpRow({ followUp: f, today }: { followUp: FollowUp; today: ISODate }) {
  const { open } = useEditor()
  const Icon = CHANNEL_ICON[f.channel]
  const closed = f.outcome.status !== 'open'
  const late = !closed && f.due.date < today

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -12, transition: { duration: 0.15 } }}
      transition={spring.soft}
      className="group flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-muted/50"
    >
      <OutcomeControl target="followUp" id={f.id} outcome={f.outcome} />
      <ClickableRow onActivate={() => open({ kind: 'followUp', value: f })} className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Icon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className={cn('truncate text-sm font-medium', closed && 'text-muted-foreground')}>{f.title}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <WorkspaceBadge ws={f.workspace} />
          <span className={cn('tabular-nums', late && 'font-medium text-destructive')}>{friendlyDateTime(f.due.date, f.due.time, today)}</span>
          {f.contact && <span className="truncate">{f.contact}</span>}
          {f.trigger && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5">
              <ShieldCheck className="size-3" /> Confirmation · {CONFIRMATION_LABELS[f.trigger].toLowerCase()}
            </span>
          )}
          <RefChip refTo={f.subject} />
        </div>
        {closed && (
          <div className="mt-1.5">
            <OutcomeNote outcome={f.outcome} target="followUp" />
          </div>
        )}
      </ClickableRow>
    </motion.li>
  )
}
