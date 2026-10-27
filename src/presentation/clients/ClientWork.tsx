import { useMemo } from 'react'
import { AnimatePresence } from 'motion/react'
import { CalendarPlus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { meetingsFor, tasksFor } from '@/domain/clients/Client'
import type { EntityRef } from '@/domain/shared/types'
import { useEditor } from '@/presentation/app/create'
import { ActionMenu } from '@/presentation/components/ActionMenu'
import { friendlyDate } from '@/presentation/components/dates'
import { MEETING_KIND_ICON } from '@/presentation/components/kinds'
import { Section } from '@/presentation/components/layout'
import { useEntities, useToday } from '@/presentation/data/hooks'
import { MeetingCard } from '@/presentation/meetings/MeetingCard'
import { TaskRow } from '@/presentation/tasks/TaskRow'

/**
 * The meetings, appointments and tasks for a client or a project, with the buttons to add more.
 * Everything added here is tied to `target` and filed under FSA.
 */
export function ClientWork({ target, keys, counterpart }: { target: EntityRef; keys: Set<string>; counterpart?: string }) {
  const { open } = useEditor()
  const today = useToday()
  const { data: allMeetings } = useEntities('meeting')
  const { data: allTasks } = useEntities('task')
  const meetings = useMemo(() => meetingsFor(keys, allMeetings), [keys, allMeetings])
  const tasks = useMemo(() => tasksFor(keys, allTasks).sort((a, b) => Number(a.outcome.status !== 'open') - Number(b.outcome.status !== 'open') || (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9')), [keys, allTasks])

  const upcoming = meetings.filter((m) => m.slot.date >= today).reverse()
  const past = meetings.filter((m) => m.slot.date < today)
  const schedule = (kind: 'appointment' | 'meeting') => open({ kind, value: { workspace: 'fsa', related: target, counterpart } })

  return (
    <>
      <Section
        title="Meetings & appointments"
        description={`${upcoming.length} coming up · ${past.length} held`}
        actions={
          <ActionMenu
            trigger={<Button variant="outline" size="sm" />}
            triggerContent={
              <>
                <CalendarPlus /> Schedule
              </>
            }
            items={[
              { key: 'appointment', label: 'Appointment', icon: <MEETING_KIND_ICON.appointment />, onSelect: () => schedule('appointment') },
              { key: 'meeting', label: 'Meeting', icon: <MEETING_KIND_ICON.meeting />, onSelect: () => schedule('meeting') },
            ]}
          />
        }
      >
        {meetings.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing scheduled yet. Book an appointment or set up a meeting; it will show here and on your planner.</p>
        ) : (
          <div className="grid gap-4">
            {upcoming.length > 0 && <MeetingList label="Coming up" meetings={upcoming} today={today} />}
            {past.length > 0 && <MeetingList label="Earlier" meetings={past} today={today} />}
          </div>
        )}
      </Section>

      <Section
        title="Tasks"
        description={`${tasks.filter((t) => t.outcome.status === 'open').length} open`}
        actions={
          <Button variant="outline" size="sm" onClick={() => open({ kind: 'task', value: { workspace: 'fsa', related: target } })}>
            <Plus /> Add task
          </Button>
        }
        bodyClassName="p-2"
      >
        {tasks.length === 0 ? (
          <p className="p-2 text-sm text-muted-foreground">No tasks yet.</p>
        ) : (
          <ul className="grid gap-0.5">
            <AnimatePresence initial={false}>
              {tasks.map((t) => (
                <TaskRow key={t.id} task={t} today={today} showPlan={false} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </Section>
    </>
  )
}

function MeetingList({ label, meetings, today }: { label: string; meetings: ReturnType<typeof meetingsFor>; today: string }) {
  const days = [...new Set(meetings.map((m) => m.slot.date))]
  return (
    <div className="grid gap-3">
      <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</div>
      {days.map((date) => (
        <div key={date}>
          <div className="mb-1 text-xs font-medium">{friendlyDate(date, today)}</div>
          <ul className="grid gap-2">
            {meetings
              .filter((m) => m.slot.date === date)
              .map((m) => (
                <MeetingCard key={m.id} meeting={m} confirmations={[]} needsOutcome={m.outcome.status === 'open' && m.slot.date < today} />
              ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
