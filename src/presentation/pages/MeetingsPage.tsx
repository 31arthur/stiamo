import { useMemo, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { CalendarClock, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MeetingKind } from '@/domain/meetings/Meeting'
import { instantKey, minutesOf } from '@/domain/shared/time'
import { useEditor } from '@/presentation/app/create'
import { useWorkspaceFilter } from '@/presentation/app/workspaceFilter'
import { friendlyDate } from '@/presentation/components/dates'
import { Segmented } from '@/presentation/components/form'
import { LensNotice } from '@/presentation/components/LensNotice'
import { EmptyState, PageHeader, Section } from '@/presentation/components/layout'
import { useEntities, useToday } from '@/presentation/data/hooks'
import { MeetingCard } from '@/presentation/meetings/MeetingCard'

type View = 'upcoming' | 'record' | 'past'

export function MeetingsPage() {
  const today = useToday()
  const { open } = useEditor()
  const { matches } = useWorkspaceFilter()
  const { data: meetings } = useEntities('meeting')
  const { data: followUps } = useEntities('followUp')
  const [view, setView] = useState<View>('upcoming')
  const [kind, setKind] = useState<MeetingKind | 'all'>('all')

  const nowKey = instantKey(today, minutesOf(new Date()))
  const { groups, counts } = useMemo(() => {
    const mine = meetings.filter((m) => matches(m.workspace) && (kind === 'all' || m.kind === kind))
    const isPast = (m: (typeof mine)[number]) => instantKey(m.slot.date, m.slot.start + m.slot.duration) <= nowKey
    const lists: Record<View, typeof mine> = {
      upcoming: mine.filter((m) => !isPast(m)),
      record: mine.filter((m) => isPast(m) && m.outcome.status === 'open'),
      past: mine.filter((m) => isPast(m) && m.outcome.status !== 'open'),
    }
    const list = [...lists[view]].sort((a, b) => instantKey(a.slot.date, a.slot.start).localeCompare(instantKey(b.slot.date, b.slot.start)))
    if (view === 'past') list.reverse()
    const byDate = new Map<string, typeof list>()
    for (const m of list) byDate.set(m.slot.date, [...(byDate.get(m.slot.date) ?? []), m])
    return { groups: [...byDate.entries()], counts: { upcoming: lists.upcoming.length, record: lists.record.length, past: lists.past.length } }
  }, [meetings, matches, kind, view, nowKey])

  return (
    <>
      <PageHeader
        title="Meetings & appointments"
        description="Appointments are with clients and outside parties — confirmations are scheduled for you. Meetings are agenda-driven — prepare the agenda and record what was decided."
        actions={
          <>
            <Button variant="outline" onClick={() => open({ kind: 'appointment' })}>
              <CalendarClock /> Appointment
            </Button>
            <Button onClick={() => open({ kind: 'meeting' })}>
              <Users /> Meeting
            </Button>
          </>
        }
      />
      <LensNotice items={meetings} noun="meeting" />
      <div className="flex flex-wrap items-center gap-3">
        <Segmented<View>
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: 'upcoming', label: <>Upcoming <span className="tabular-nums opacity-60">{counts.upcoming}</span></> },
            { value: 'record', label: <>Needs outcome {counts.record > 0 && <span className="rounded-full bg-destructive px-1.5 text-[10px] text-white tabular-nums">{counts.record}</span>}</> },
            { value: 'past', label: 'Past' },
          ]}
        />
        <Segmented<MeetingKind | 'all'>
          label="Kind"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'all', label: 'All' },
            { value: 'appointment', label: 'Appointments' },
            { value: 'meeting', label: 'Meetings' },
          ]}
        />
      </div>
      {groups.length === 0 ? (
        <Section>
          <EmptyState title={view === 'record' ? 'All caught up.' : 'Nothing here.'}>
            {view === 'record' ? 'Every past meeting has its outcome recorded.' : 'Schedule an appointment or a meeting to get started.'}
          </EmptyState>
        </Section>
      ) : (
        <div className="grid gap-6">
          {groups.map(([date, list]) => (
            <div key={date}>
              <h2 className="mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">{friendlyDate(date, today)}</h2>
              <ul className="grid gap-2">
                <AnimatePresence initial={false}>
                  {list.map((m) => (
                    <MeetingCard
                      key={m.id}
                      meeting={m}
                      needsOutcome={view === 'record'}
                      confirmations={followUps.filter((f) => f.trigger && f.subject?.kind === 'meeting' && f.subject.id === m.id)}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
