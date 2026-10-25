import { describe, expect, it } from 'vitest'
import { createContainer } from '@/di/container'
import { DEMO_ACCOUNT } from '@/data/auth/LocalAuthRepository'
import { SEEDED_KEY } from '@/data/storage/localRepositories'
import { buildAgenda } from './agenda/agenda'
import type { AgendaEntry } from './agenda/agenda'
import { goalProgress } from './goals/Goal'
import type { Goal } from './goals/Goal'
import { confirmationDue, syncConfirmations } from './meetings/confirmations'
import type { Meeting } from './meetings/Meeting'
import { buildDayPlan, packDay } from './planner/dayPlan'
import { planProgress } from './plans/ActionPlan'
import { progressOf } from './shared/outcome'
import type { Task } from './tasks/Task'

const at = (hh: number, mm = 0) => hh * 60 + mm
const stamp = { userId: 'u', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }

class MemoryStorage implements Storage {
  private map = new Map<string, string>()
  get length() {
    return this.map.size
  }
  clear() {
    this.map.clear()
  }
  getItem(k: string) {
    return this.map.get(k) ?? null
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null
  }
  removeItem(k: string) {
    this.map.delete(k)
  }
  setItem(k: string, v: string) {
    this.map.set(k, v)
  }
}

/** A container on empty in-memory storage (demo seeding switched off). */
function freshApp() {
  const storage = new MemoryStorage()
  storage.setItem(SEEDED_KEY, '1')
  return createContainer(storage)
}

const meeting = (over: Partial<Meeting> = {}): Meeting => ({
  id: 'm1',
  ...stamp,
  kind: 'appointment',
  title: 'Consultation',
  workspace: 'sb',
  slot: { date: '2026-10-27', start: at(15), duration: 60 },
  mode: 'in_person',
  counterpart: 'Mr. Arora',
  attendees: [],
  agenda: [],
  confirmations: ['day_before', 'hour_before'],
  outcome: { status: 'open' },
  ...over,
})

const task = (id: string, over: Partial<Task> = {}): Task => ({
  id,
  ...stamp,
  title: id,
  notes: '',
  workspace: 'fsa',
  priority: 'normal',
  estimate: 30,
  outcome: { status: 'open' },
  ...over,
})

describe('appointment confirmations', () => {
  it('schedules a call the day before (within working hours) and an hour before', () => {
    expect(confirmationDue({ date: '2026-10-27', start: at(15), duration: 60 }, 'day_before')).toEqual({ date: '2026-10-26', time: at(15) })
    expect(confirmationDue({ date: '2026-10-27', start: at(7, 30), duration: 60 }, 'day_before')).toEqual({ date: '2026-10-26', time: at(9) })
    expect(confirmationDue({ date: '2026-10-27', start: at(0, 30), duration: 60 }, 'hour_before')).toEqual({ date: '2026-10-26', time: at(23, 30) })
  })

  it('creates, moves and drops only open confirmations', () => {
    const created = syncConfirmations(meeting(), [])
    expect(created.create.map((f) => f.trigger)).toEqual(['day_before', 'hour_before'])

    const existing = created.create.map((d, i) => ({ ...d, id: `f${i}`, ...stamp }))
    existing[0].outcome = { status: 'done' } // day-before call already made

    const moved = syncConfirmations(meeting({ slot: { date: '2026-10-28', start: at(15), duration: 60 } }), existing)
    expect(moved.create).toEqual([])
    expect(moved.update.map((f) => f.trigger)).toEqual(['hour_before']) // the logged one is history
    expect(moved.update[0].due).toEqual({ date: '2026-10-28', time: at(14) })

    const cancelled = syncConfirmations(meeting({ outcome: { status: 'cancelled' } }), existing)
    expect(cancelled.remove.map((f) => f.id)).toEqual(['f1'])
  })
})

describe('agenda & planner', () => {
  const sources = {
    tasks: [task('t1', { dueDate: '2026-10-27' }), task('t2', { slot: { date: '2026-10-27', start: at(9), duration: 45 } })],
    meetings: [meeting()],
    followUps: [],
    hearings: [{ id: 'h1', ...stamp, caseId: 'c1', date: '2026-10-27', time: at(10, 30), duration: 60, purpose: 'Arguments', outcome: { status: 'open' as const } }],
    cases: [{ id: 'c1', ...stamp, reference: 'CS 1/2026', title: 'A v. B', client: 'A', court: 'HC', status: 'active' as const, summary: '' }],
  }

  it('unifies tasks, meetings and hearings for a day, timed first', () => {
    const entries = buildAgenda(sources, '2026-10-27', '2026-10-27')
    expect(entries.map((e) => e.key)).toEqual(['task:t2', 'hearing:h1', 'meeting:m1', 'task:t1'])
    expect(entries.find((e) => e.kind === 'hearing')).toMatchObject({ movable: false, pinned: true, workspace: 'sb' })
  })

  it('reflows flexible blocks around fixed ones and fits unplanned work', () => {
    const entries = buildAgenda(sources, '2026-10-27', '2026-10-27')
    const placed = packDay(entries, { from: at(9), gap: 0, includeUnplanned: true })
    const byKey = Object.fromEntries(placed.map((p) => [p.entry.key, p.slot.start]))
    // t2 (45m) stays at 09:00; t1 (30m) can't fit before the 10:30 hearing? It can: 09:45–10:15.
    expect(byKey).toEqual({ 'task:t1': at(9, 45) })
  })

  it('detects overlaps and lays them out side by side', () => {
    const e = (key: string, start: number, duration: number): AgendaEntry => ({
      key,
      ref: { kind: 'task', id: key },
      kind: 'task',
      title: key,
      date: '2026-10-27',
      slot: { start, duration },
      duration,
      workspace: 'fsa',
      outcome: { status: 'open' },
      pinned: false,
      movable: true,
    })
    const plan = buildDayPlan([e('a', at(9), 60), e('b', at(9, 30), 60), e('c', at(11), 30)])
    expect([...plan.conflicts].sort()).toEqual(['a', 'b'])
    expect(plan.layout.get('b')).toEqual({ column: 1, columns: 2 })
    expect(plan.layout.get('c')).toEqual({ column: 0, columns: 1 })
  })
})

describe('progress', () => {
  it('weights outcomes and ignores cancelled work', () => {
    expect(progressOf([{ status: 'done' }, { status: 'partial' }, { status: 'not_done' }, { status: 'cancelled' }])).toBeCloseTo(0.5)
    expect(progressOf([{ status: 'cancelled' }])).toBeNull()
  })

  it('rolls plans and key results up into goal health', () => {
    const tasks = [task('s1', { planId: 'p1', outcome: { status: 'done' } }), task('s2', { planId: 'p1' })]
    expect(planProgress('p1', tasks)).toMatchObject({ total: 2, done: 1, progress: 0.5 })

    const goal: Goal = {
      id: 'g1',
      ...stamp,
      title: 'Grow',
      description: '',
      horizon: 'year',
      startDate: '2026-01-01',
      targetDate: '2026-12-31',
      planIds: ['p1'],
      keyResults: [{ id: 'k', label: 'Matters', start: 0, target: 10, current: 1 }],
      checkIns: [],
      status: 'active',
    }
    const g = goalProgress(goal, tasks, '2026-07-01')
    expect(g.progress).toBeCloseTo(0.3) // (0.5 plan + 0.1 KR) / 2
    expect(g.health).toBe('at_risk') // ~50% of the time gone, 30% done: lagging by ~0.2
    expect(goalProgress(goal, tasks, '2026-10-01').health).toBe('off_track')
  })
})

describe('use cases', () => {
  it('records a hearing: summary, next listing, action plan with steps', async () => {
    const app = freshApp()
    const c = await app.crud.case.create('u', { reference: 'OP 1', title: 'Trust', client: 'R', court: 'DC', status: 'active', summary: '' })
    const h = await app.crud.hearing.create('u', { caseId: c.id, date: '2026-10-20', duration: 60, purpose: 'Reply', outcome: { status: 'open' } })

    const result = await app.cases.recordHearing('u', h.id, {
      summary: 'Adjourned at request of the other side',
      outcome: { status: 'not_done', comment: 'Adjourned' },
      next: { date: '2026-11-10', purpose: 'Reply (adjourned)' },
      plan: { title: 'Prep for 10 Nov', objective: 'File rejoinder', steps: ['Draft rejoinder', ' ', 'File and serve'] },
      caseUpdate: { stage: 'Pleadings' },
    })

    expect(result.hearing).toMatchObject({ summary: 'Adjourned at request of the other side', nextHearingId: result.nextHearing!.id })
    expect(result.plan).toMatchObject({ caseId: c.id, dueDate: '2026-11-10', origin: { kind: 'hearing', id: h.id } })
    const steps = (await app.crud.task.list('u')).filter((t) => t.planId === result.plan!.id)
    expect(steps.map((t) => t.title)).toEqual(['Draft rejoinder', 'File and serve'])
    expect((await app.crud.case.get('u', c.id))!.stage).toBe('Pleadings')
  })

  it('records an outcome and spawns the further action inside the same plan', async () => {
    const app = freshApp()
    const plan = await app.plans.createWithSteps('u', { title: 'Launch', objective: '', workspace: 'fsa', status: 'active' }, ['Load test'])
    const step = (await app.crud.task.list('u'))[0]

    const { spawned } = await app.outcomes.execute(
      'u',
      { kind: 'task', id: step.id },
      { status: 'partial', comment: 'p99 spikes' },
      { kind: 'task', title: 'Profile the DB pool', date: '2026-10-28' },
    )

    const all = await app.crud.task.list('u')
    expect(all.find((t) => t.id === step.id)!.outcome).toMatchObject({ status: 'partial', comment: 'p99 spikes' })
    expect(all.find((t) => t.id === spawned!.id)).toMatchObject({ planId: plan.id, related: { kind: 'task', id: step.id } })
  })

  it('keeps confirmations in sync when an appointment is moved on the planner, and undo restores it', async () => {
    const app = freshApp()
    const m = await app.meetings.save('u', { ...meeting(), id: undefined } as never)
    const before = await app.agenda.schedule('u', { kind: 'meeting', id: m.id }, '2026-10-29', { start: at(11), duration: 60 })

    const confirmations = (await app.crud.followUp.list('u')).filter((f) => f.subject?.id === m.id)
    expect(confirmations.map((f) => f.due)).toEqual(
      expect.arrayContaining([{ date: '2026-10-28', time: at(11) }, { date: '2026-10-29', time: at(10) }]),
    )

    await app.agenda.restore('u', [before])
    expect((await app.crud.meeting.get('u', m.id))!.slot.date).toBe('2026-10-27')
    const restored = (await app.crud.followUp.list('u')).filter((f) => f.subject?.id === m.id)
    expect(restored.map((f) => f.due.date).sort()).toEqual(['2026-10-26', '2026-10-27'])
  })

  it('seeds a consistent demo practice', async () => {
    const storage = new MemoryStorage()
    const app = createContainer(storage)
    await app.ready
    const [cases, goals, followUps] = await Promise.all([
      app.crud.case.list(DEMO_ACCOUNT.id),
      app.crud.goal.list(DEMO_ACCOUNT.id),
      app.crud.followUp.list(DEMO_ACCOUNT.id),
    ])
    expect(cases).toHaveLength(3)
    expect(goals).toHaveLength(3)
    expect(followUps.filter((f) => f.trigger).length).toBe(4) // two appointments × two confirmations
  })
})
