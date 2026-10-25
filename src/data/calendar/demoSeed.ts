import { addDays, format } from 'date-fns'
import type { CalendarItem } from '@/domain/calendar/entities/CalendarItem'
import { DEMO_ACCOUNT } from '@/data/auth/LocalAuthRepository'
import { DATE_FORMAT } from '@/domain/calendar/monthGrid'

type SeedRow = Pick<CalendarItem, 'title' | 'type'> & Partial<Pick<CalendarItem, 'notes' | 'schedule' | 'completed'>> & { day?: number }

const h = (hours: number, minutes = 0) => hours * 60 + minutes

const ROWS: SeedRow[] = [
  { title: 'Team standup', type: 'meeting', schedule: { start: h(9, 30), duration: 15 } },
  { title: 'Write launch brief', type: 'task', notes: 'Positioning, pricing, FAQ', schedule: { start: h(10), duration: 90 } },
  { title: 'Follow up with Priya on contract', type: 'follow_up', schedule: { start: h(11, 45), duration: 15 } },
  { title: 'Design review', type: 'meeting', schedule: { start: h(13), duration: 60 } },
  { title: '1:1 with Sam', type: 'meeting', schedule: { start: h(16), duration: 30 } },
  { title: 'Review PR #42', type: 'task' },
  { title: 'Reply to investor update', type: 'task' },
  { title: 'Check in with Alex about hiring', type: 'follow_up' },
  { title: 'Plan sprint retro', type: 'task' },
  { title: 'Ship onboarding email', type: 'task', day: 1 },
  { title: 'Quarterly planning', type: 'meeting', day: 2, schedule: { start: h(14), duration: 120 } },
  { title: 'Nudge legal on DPA', type: 'follow_up', day: 3 },
  { title: 'Customer call — Northwind', type: 'meeting', day: -1, completed: true, schedule: { start: h(11), duration: 45 } },
  { title: 'Draft hiring scorecard', type: 'task', day: -2, completed: true },
]

/** A lived-in day for the demo account so the planner has something to play with. */
export function demoSeed(today = new Date()): CalendarItem[] {
  return ROWS.map(({ day = 0, ...row }, i) => ({
    id: `seed-${i}`,
    userId: DEMO_ACCOUNT.id,
    notes: '',
    completed: false,
    ...row,
    date: format(addDays(today, day), DATE_FORMAT),
  }))
}
