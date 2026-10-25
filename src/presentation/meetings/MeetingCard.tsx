import { motion } from 'motion/react'
import { MapPin, Phone, Video } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { FollowUp } from '@/domain/followups/FollowUp'
import { CONFIRMATION_LABELS, MEETING_KINDS } from '@/domain/meetings/Meeting'
import type { Meeting, MeetingMode } from '@/domain/meetings/Meeting'
import { formatClock, formatDuration } from '@/domain/shared/time'
import { MEETING_KIND_ICON } from '@/presentation/components/kinds'
import { OUTCOME_STYLE, OutcomeBadge } from '@/presentation/components/outcome'
import { WS_STYLE, WorkspaceBadge } from '@/presentation/components/workspace'
import { spring } from '@/presentation/motion/presets'

export const MODE_ICON: Record<MeetingMode, LucideIcon> = { in_person: MapPin, virtual: Video, phone: Phone }

export function MeetingCard({ meeting: m, confirmations, needsOutcome }: { meeting: Meeting; confirmations: FollowUp[]; needsOutcome: boolean }) {
  const KindIcon = MEETING_KIND_ICON[m.kind]
  const ModeIcon = MODE_ICON[m.mode]
  const covered = m.agenda.filter((a) => a.outcome.status !== 'open').length

  return (
    <motion.li layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring.soft}>
      <Link
        to={`/meetings/${m.id}`}
        className="group flex gap-4 rounded-xl border bg-card/80 p-3 transition-[box-shadow,transform] hover:-translate-y-px hover:shadow-float"
      >
        <div className={cn('w-1 shrink-0 rounded-full', WS_STYLE[m.workspace].bar)} />
        <div className="w-16 shrink-0">
          <div className="text-lg font-semibold tabular-nums">{formatClock(m.slot.start)}</div>
          <div className="text-[11px] text-muted-foreground">{formatDuration(m.slot.duration)}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium">
              <KindIcon className="size-3" /> {MEETING_KINDS[m.kind].label}
            </span>
            <WorkspaceBadge ws={m.workspace} />
            {m.outcome.status !== 'open' ? (
              <OutcomeBadge outcome={m.outcome} target="meeting" />
            ) : (
              needsOutcome && <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">Record outcome</span>
            )}
          </div>
          <div className="mt-1 truncate font-medium">{m.title}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {m.counterpart && <span>with {m.counterpart}</span>}
            <span className="inline-flex items-center gap-1">
              <ModeIcon className="size-3" /> {m.location || (m.mode === 'virtual' ? 'Online' : m.mode === 'phone' ? 'Phone' : 'In person')}
            </span>
            {m.agenda.length > 0 && (
              <span className="tabular-nums">
                Agenda {covered}/{m.agenda.length}
              </span>
            )}
            {!m.prepPlanId && m.kind === 'meeting' && m.agenda.length === 0 && <span className="text-warning">No agenda yet</span>}
          </div>
          {confirmations.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {confirmations.map((f) => {
                const s = OUTCOME_STYLE[f.outcome.status]
                return (
                  <span key={f.id} className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]', s.className)}>
                    <s.icon className="size-3" /> Confirm {f.trigger ? CONFIRMATION_LABELS[f.trigger].toLowerCase() : ''}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      </Link>
    </motion.li>
  )
}
