import { describe, expect, it } from 'vitest'
import { localBackend } from "@/di/backends"
import { createContainer } from "@/di/container"
import { DEMO_ACCOUNT } from '@/data/auth/LocalAuthRepository'
import { SEEDED_KEY } from '@/data/storage/localRepositories'
import { buildAgenda } from './agenda/agenda'
import type { AgendaEntry } from './agenda/agenda'
import { goalProgress } from './goals/Goal'
import type { Goal } from './goals/Goal'
import { confirmationDue, syncConfirmations } from './meetings/confirmations'
import type { Meeting } from './meetings/Meeting'
import { buildDayPlan, packDay } from './planner/dayPlan'
import { caseTypeOf } from './cases/LegalCase'
import { clientRefKeys, clientOf, meetingsFor, tasksFor } from './clients/Client'
import { actionClosed, diaryOf, mergeCandidates, pendingActions, searchDiary } from './cases/hearingDiary'
import { hearingCaseIds, hearingsOf } from './cases/LegalCase'
import { bestMinute, chaseOf, suggestRetry } from './followups/chase'
import type { Attempt, AttemptResult } from './followups/FollowUp'
import { categoryOf, defaultLinkName, describeLink } from './attachments/Attachment'
import { RelationGraph } from './relations/graph'
import { planCaseIds, planHearingIds, planProgress, planScope, planSteps } from './plans/ActionPlan'
import { digestOf } from './plans/planDoc'
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
  return createContainer(localBackend(storage))
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

/** A new-meeting draft (no system fields), as the UI would submit it. */
const meetingDraft = (over: Partial<Meeting> = {}) => {
  const { id: _id, userId: _u, createdAt: _c, updatedAt: _up, ...draft } = meeting(over)
  return draft
}

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
    cases: [{ id: 'c1', ...stamp, reference: 'SA-2026-001', title: 'A v. B', organization: 'SA' as const, type: 'pow' as const, court: 'HC', status: 'active' as const, summary: '' }],
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
    const c = await app.crud.case.create('u', { reference: 'OP 1', title: 'Trust', organization: 'SA', type: 'pow', court: 'DC', status: 'active', summary: '' })
    const h = await app.crud.hearing.create('u', { caseId: c.id, date: '2026-10-20', duration: 60, purpose: 'Reply', outcome: { status: 'open' } })

    const result = await app.cases.recordHearing('u', h.id, {
      summary: 'Adjourned at request of the other side',
      outcome: { status: 'not_done', comment: 'Adjourned' },
      next: { date: '2026-11-10', purpose: 'Reply (adjourned)' },
      plan: { title: 'Prep for 10 Nov', objective: 'File rejoinder', steps: ['Draft rejoinder', ' ', 'File and serve'] },
      caseUpdate: { stage: 'Pleadings' },
    })

    expect(result.hearing).toMatchObject({ summary: 'Adjourned at request of the other side', nextHearingId: result.nextHearing!.id })
    expect(result.plan).toMatchObject({ caseIds: [c.id], dueDate: '2026-11-10', origin: { kind: 'hearing', id: h.id } })
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
    const m = await app.meetings.save('u', meetingDraft())
    const before = await app.agenda.schedule('u', { kind: 'meeting', id: m.id }, '2026-10-29', { start: at(11), duration: 60 })

    const confirmations = (await app.crud.followUp.list('u')).filter((f) => f.subject?.id === m.id)
    expect(confirmations.map((f) => f.due)).toEqual(
      expect.arrayContaining([{ date: '2026-10-28', time: at(11) }, { date: '2026-10-29', time: at(10) }]),
    )

    await app.agenda.restore('u', [before])
    expect((await app.crud.meeting.get('u', m.id))!.slot.date).toBe('2026-10-27')
    const restored = (await app.crud.followUp.list('u')).filter((f) => f.subject?.id === m.id)
    expect(restored.map((f) => f.due!.date).sort()).toEqual(['2026-10-26', '2026-10-27'])
  })

  it('seeds a consistent demo practice', async () => {
    const storage = new MemoryStorage()
    const app = createContainer(localBackend(storage))
    await app.ready
    const [cases, goals, followUps, clients, projects, meetings] = await Promise.all([
      app.crud.case.list(DEMO_ACCOUNT.id),
      app.crud.goal.list(DEMO_ACCOUNT.id),
      app.crud.followUp.list(DEMO_ACCOUNT.id),
      app.crud.client.list(DEMO_ACCOUNT.id),
      app.crud.project.list(DEMO_ACCOUNT.id),
      app.crud.meeting.list(DEMO_ACCOUNT.id),
    ])
    expect(cases).toHaveLength(5)
    expect(goals).toHaveLength(3)
    expect(followUps.filter((f) => f.trigger).length).toBe(6) // legal appointments × two, FSA client appointments × two and one
    expect(clients).toHaveLength(2)
    expect(projects.every((p) => clients.some((c) => c.id === p.clientId))).toBe(true)
    // The FSA appointments are tied to a client or project.
    expect(meetings.filter((m) => m.workspace === 'fsa' && m.related).length).toBe(2)
    expect((await app.crud.link.list(DEMO_ACCOUNT.id)).length).toBeGreaterThan(0)
  })
})

describe('relationships & history', () => {
  it('builds a case thread and records its history', async () => {
    const app = freshApp()
    const c = await app.crud.case.create('u', { reference: 'CS 9', title: 'A v. B', organization: 'SA', type: 'pow', court: 'HC', status: 'active', summary: '' })
    const h = await app.crud.hearing.create('u', { caseId: c.id, date: '2026-10-20', duration: 60, purpose: 'Evidence', outcome: { status: 'open' } })
    const { plan, nextHearing } = await app.cases.recordHearing('u', h.id, {
      summary: 'Part heard',
      outcome: { status: 'partial' },
      next: { date: '2026-11-03', purpose: 'Evidence (contd.)' },
      plan: { title: 'Prep', objective: '', steps: ['Draft', 'File'] },
    })
    const m = await app.meetings.save('u', meetingDraft({ related: undefined }))
    await app.links.link('u', { kind: 'case', id: c.id }, { kind: 'meeting', id: m.id }, { a: c.title, b: m.title })
    const step = (await app.crud.task.list('u')).find((t) => t.title === 'Draft')!
    const { spawned } = await app.outcomes.execute('u', { kind: 'task', id: step.id }, { status: 'done' }, { kind: 'followUp', title: 'Call registry' })

    const [tasks, meetings, followUps, cases, hearings, plans, goals, links] = await Promise.all([
      app.crud.task.list('u'), app.crud.meeting.list('u'), app.crud.followUp.list('u'), app.crud.case.list('u'),
      app.crud.hearing.list('u'), app.crud.plan.list('u'), app.crud.goal.list('u'), app.crud.link.list('u'),
    ])
    const graph = new RelationGraph({ tasks, meetings, followUps, cases, hearings, plans, goals, counsel: [], clients: [], projects: [], links })
    const thread = graph.thread({ kind: 'case', id: c.id })
    const ids = new Set(thread.members.map((r) => r.id))
    const expected = { hearing: h.id, next: nextHearing!.id, plan: plan!.id, step: step.id, spawned: spawned!.id, meeting: m.id }
    expect(Object.entries(expected).filter(([, id]) => !ids.has(id)).map(([k]) => k)).toEqual([])
    expect(thread.peers.map((p) => p.ref.id)).toEqual([m.id])
    // A follow-up without any date is fine.
    expect(followUps.find((f) => f.id === spawned!.id)!.due).toBeUndefined()

    // The step's own thread climbs to its plan, the hearing and the case.
    const up = graph.thread({ kind: 'task', id: step.id }).ancestors.map((a) => a.ref.kind)
    expect(up).toEqual(expect.arrayContaining(['plan', 'hearing', 'case']))

    const history = await app.crud.activity.list('u')
    const forStep = history.filter((a) => a.ref.id === step.id).map((a) => a.action)
    expect(forStep).toEqual(expect.arrayContaining(['created', 'outcome']))
    expect(history.some((a) => a.ref.id === c.id && a.action === 'linked')).toBe(true)

    // Deleting a record removes its links.
    await app.meetings.remove('u', m.id)
    expect(await app.crud.link.list('u')).toEqual([])
  })
})

describe('attachments', () => {
  it('attaches files to any record, records it in history, and enforces the size limit', async () => {
    const app = freshApp()
    const c = await app.crud.case.create('u', { reference: 'CS 10', title: 'X v. Y', organization: 'SA', type: 'pow', court: 'HC', status: 'active', summary: '' })
    const file = new File(['order text'], 'order.txt', { type: 'text/plain' })
    const a = await app.attachments.attach('u', { kind: 'case', id: c.id }, c.title, file)
    expect(a).toMatchObject({ name: 'order.txt', size: 10, owner: { kind: 'case', id: c.id } })
    expect((await app.crud.activity.list('u')).some((x) => x.action === 'attached' && x.ref.id === c.id)).toBe(true)

    const huge = { name: 'big.pdf', size: 30 * 1024 * 1024, type: 'application/pdf' } as File
    await expect(app.attachments.attach('u', { kind: 'case', id: c.id }, c.title, huge)).rejects.toThrow(/limit/)

    await app.attachments.remove('u', a, c.title)
    expect(await app.crud.attachment.list('u')).toEqual([])
  })
})

describe('sign-up switch', () => {
  it('rejects registration unless it has been switched on', async () => {
    const off = createContainer(localBackend(new MemoryStorage()))
    await expect(off.auth.register.execute({ name: 'A', email: 'a@b.co', password: 'longenough1' })).rejects.toThrow(/turned off/)
    const on = createContainer({ ...localBackend(new MemoryStorage()), allowSignUp: true })
    await expect(on.auth.register.execute({ name: 'A', email: 'a@b.co', password: 'longenough1' })).resolves.toMatchObject({ email: 'a@b.co' })
  })
})

describe('case numbers', () => {
  it('numbers cases per organization and year, counting on from the highest used', async () => {
    const app = freshApp()
    const open = (organization: 'SA' | 'TUMWU', filedOn?: string) =>
      app.cases.open('u', { organization, type: 'pow', title: 'T', status: 'active', summary: '', filedOn })

    const a = await open('TUMWU', '2026-03-01')
    const b = await open('TUMWU', '2026-05-09')
    const other = await open('SA', '2026-05-09')
    const nextYear = await open('TUMWU', '2027-01-04')
    expect([a, b, other, nextYear].map((c) => c.reference)).toEqual(['TUMWU-2026-001', 'TUMWU-2026-002', 'SA-2026-001', 'TUMWU-2027-001'])

    // Deleting the middle one doesn't hand its number out again.
    await app.cases.remove('u', a.id)
    expect((await open('TUMWU', '2026-08-01')).reference).toBe('TUMWU-2026-003')
  })

  it('requires an organization', async () => {
    const app = freshApp()
    await expect(app.cases.open('u', { type: 'pil', title: 'T', status: 'active', summary: '' } as never)).rejects.toThrow(/Organization/)
  })
})

describe('counsel', () => {
  const newCase = (app: ReturnType<typeof freshApp>) => app.cases.open('u', { organization: 'TUMWU', type: 'pow', title: 'Unpaid wages', status: 'active', summary: '' })
  const newCounsel = (app: ReturnType<typeof freshApp>, name = 'Adv. S. Rao') =>
    app.crud.counsel.create('u', { kind: 'advocate', name, expertise: ['pow', 'pow', 'public_interest'], proBono: true, status: 'active', notes: '' })

  it('handles cases ourselves by default, and briefs counsel with terms and a history trail', async () => {
    const app = freshApp()
    const c = await newCase(app)
    expect(c.engagement).toBeUndefined()

    const rao = await newCounsel(app)
    expect(rao.expertise).toEqual(['pow', 'public_interest']) // duplicates dropped

    const briefed = await app.cases.assignCounsel('u', c.id, { counselId: rao.id, engagedOn: '2026-10-01', proBono: true, scope: 'Appear at all hearings' })
    expect(briefed.engagement).toMatchObject({ counselId: rao.id, proBono: true, scope: 'Appear at all hearings' })

    const history = await app.crud.activity.list('u')
    expect(history.some((a) => a.ref.id === c.id && a.summary.startsWith('Briefed Adv. S. Rao') && a.related?.id === rao.id)).toBe(true)
    expect(history.some((a) => a.ref.id === rao.id && a.summary.includes('Briefed on'))).toBe(true)

    // The counsel's thread leads to the case; the case's thread leads to the counsel.
    const [tasks, meetings, followUps, cases, hearings, plans, goals, counsel, links] = await Promise.all([
      app.crud.task.list('u'), app.crud.meeting.list('u'), app.crud.followUp.list('u'), app.crud.case.list('u'),
      app.crud.hearing.list('u'), app.crud.plan.list('u'), app.crud.goal.list('u'), app.crud.counsel.list('u'), app.crud.link.list('u'),
    ])
    const graph = new RelationGraph({ tasks, meetings, followUps, cases, hearings, plans, goals, counsel, clients: [], projects: [], links })
    expect(graph.thread({ kind: 'counsel', id: rao.id }).members.map((m) => m.id)).toContain(c.id)
    expect(graph.thread({ kind: 'case', id: c.id }).ancestors.map((a) => a.ref.id)).toContain(rao.id)

    const back = await app.cases.assignCounsel('u', c.id, null)
    expect(back.engagement).toBeUndefined()
    expect((await app.crud.activity.list('u')).some((a) => a.summary === 'Taken back — now handled by us')).toBe(true)
  })

  it('refuses to brief counsel who aren’t in the directory', async () => {
    const app = freshApp()
    const c = await newCase(app)
    await expect(app.cases.assignCounsel('u', c.id, { counselId: 'nobody', proBono: false })).rejects.toThrow(/Counsel not found/)
    await expect(app.cases.open('u', { organization: 'SA', type: 'other', title: 'T', status: 'active', summary: '', engagement: { counselId: 'nobody', proBono: false } })).rejects.toThrow(/Counsel not found/)
  })

  it('returns a removed counsel’s cases to us', async () => {
    const app = freshApp()
    const rao = await newCounsel(app)
    const c = await newCase(app)
    await app.cases.assignCounsel('u', c.id, { counselId: rao.id, proBono: false, fee: '₹25,000 fixed' })
    await app.counsel.remove('u', rao.id)
    expect((await app.crud.case.get('u', c.id))!.engagement).toBeUndefined()
    expect(await app.crud.counsel.list('u')).toEqual([])
  })

  it('reads older case types sensibly', () => {
    expect(caseTypeOf('pil')).toBe('public_interest')
    expect(caseTypeOf('full_case')).toBe('other')
    expect(caseTypeOf('pow')).toBe('pow')
  })
})

describe('plan thinking & scope', () => {
  const para = (type: string, text: string, props: Record<string, unknown> = {}, children: unknown[] = []) => ({ id: `${type}-${text.slice(0, 6)}`, type, props, content: [{ type: 'text', text, styles: {} }], children })

  it('reads questions, answers and insights out of a plan page', () => {
    const doc = [
      para('paragraph', 'Context'),
      para('question', 'Who testifies?', { status: 'open' }),
      para('answer', 'WW-1.'),
      para('answer', 'And the supervisor.'),
      para('question', 'Is the ledger admissible?', { status: 'open' }),
      para('question', 'Limitation?', { status: 'parked' }, [para('answer', 'ignored: nested answers still count only when adjacent')]),
      para('insight', 'Secure the ledger first.'),
      para('insight', ''),
    ]
    const d = digestOf(doc)
    expect(d.questions.map((q) => [q.text, q.status])).toEqual([
      ['Who testifies?', 'answered'],
      ['Is the ledger admissible?', 'open'],
      ['Limitation?', 'parked'],
    ])
    expect(d.questions[0].answer).toBe('WW-1.\nAnd the supervisor.')
    expect(d).toMatchObject({ open: 1, answered: 1, parked: 1 })
    expect(d.insights.map((i) => i.text)).toEqual(['Secure the ledger first.']) // empty insights are skipped
    expect(digestOf(undefined)).toMatchObject({ questions: [], insights: [], open: 0 })
  })

  it('lets one plan cover several hearings and cases, and keeps it from a task', async () => {
    const app = freshApp()
    const c1 = await app.cases.open('u', { organization: 'TUMWU', type: 'pow', title: 'Wages 1', status: 'active', summary: '' })
    const c2 = await app.cases.open('u', { organization: 'TUMWU', type: 'pow', title: 'Wages 2', status: 'active', summary: '' })
    const h1 = await app.crud.hearing.create('u', { caseId: c1.id, date: '2026-11-03', duration: 60, purpose: 'Evidence', outcome: { status: 'open' } })
    const h2 = await app.crud.hearing.create('u', { caseId: c1.id, date: '2026-12-03', duration: 60, purpose: 'Arguments', outcome: { status: 'open' } })
    const t = await app.crud.task.create('u', { title: 'Get ledger certified', notes: '', workspace: 'fsa', priority: 'normal', estimate: 30, outcome: { status: 'open' } })
    const plan = await app.plans.createWithSteps('u', { title: 'Prep', objective: '', workspace: 'personal', status: 'active' }, ['Draft'])
    expect(planScope(plan)).toBe('general')

    // A hearing brings its case along; a second hearing and a second case join the same plan.
    let p = await app.plans.cover('u', plan.id, { kind: 'hearing', id: h1.id })
    expect(p).toMatchObject({ caseIds: [c1.id], hearingIds: [h1.id], workspace: 'sb' })
    p = await app.plans.cover('u', plan.id, { kind: 'hearing', id: h2.id })
    p = await app.plans.cover('u', plan.id, { kind: 'case', id: c2.id })
    expect(planCaseIds(p)).toEqual([c1.id, c2.id])
    expect(planHearingIds(p)).toEqual([h1.id, h2.id])
    expect(planScope(p)).toBe('hearing')
    // Covering the same thing twice changes nothing.
    expect(planHearingIds(await app.plans.cover('u', plan.id, { kind: 'hearing', id: h1.id }))).toEqual([h1.id, h2.id])
    expect((await app.crud.plan.list('u')).length).toBe(1)

    // Dropping a hearing keeps the case; dropping a case drops its hearings.
    p = await app.plans.uncover('u', plan.id, { kind: 'hearing', id: h2.id })
    expect(planHearingIds(p)).toEqual([h1.id])
    p = await app.plans.uncover('u', plan.id, { kind: 'case', id: c1.id })
    expect(planCaseIds(p)).toEqual([c2.id])
    expect(planHearingIds(p)).toEqual([])
    expect(planScope(p)).toBe('case')

    // A task is exclusive: it replaces cases and hearings, and takes the task's workspace.
    p = await app.plans.cover('u', plan.id, { kind: 'task', id: t.id })
    expect(p).toMatchObject({ taskId: t.id, workspace: 'fsa' })
    expect(planCaseIds(p)).toEqual([])
    expect(planScope(p)).toBe('task')
    // And choosing a case again lets go of the task.
    p = await app.plans.cover('u', plan.id, { kind: 'case', id: c1.id })
    expect(p.taskId).toBeUndefined()

    const step = (await app.crud.task.list('u')).find((x) => x.title === 'Draft')!
    await expect(app.plans.cover('u', plan.id, { kind: 'task', id: step.id })).rejects.toThrow(/own steps/)
    await expect(app.plans.cover('u', plan.id, { kind: 'hearing', id: 'nope' })).rejects.toThrow(/no longer exists/)

    expect((await app.crud.activity.list('u')).some((a) => a.ref.id === plan.id && /scope/i.test(a.summary))).toBe(true)
  })

  it('reads plans saved with the old single case/hearing fields, and rewrites them on save', async () => {
    const app = freshApp()
    const plan = await app.crud.plan.create('u', { title: 'Old', objective: '', workspace: 'sb', status: 'active', caseId: 'c1', hearingId: 'h1' })
    expect(plan).toMatchObject({ caseIds: ['c1'], hearingIds: ['h1'], caseId: undefined, hearingId: undefined })
    expect(planCaseIds({ caseId: 'c9' })).toEqual(['c9'])
    expect(planHearingIds({ hearingIds: ['h2'], hearingId: 'h2' })).toEqual(['h2'])
  })

  it('shares a plan across cases in the thread, and deleting a case only detaches that case', async () => {
    const app = freshApp()
    const c1 = await app.cases.open('u', { organization: 'SA', type: 'other', title: 'One', status: 'active', summary: '' })
    const c2 = await app.cases.open('u', { organization: 'SA', type: 'other', title: 'Two', status: 'active', summary: '' })
    const plan = await app.plans.createWithSteps('u', { title: 'Shared approach', objective: '', workspace: 'sb', status: 'active', caseIds: [c1.id, c2.id] }, ['Draft'])

    const load = async () => {
      const [tasks, meetings, followUps, cases, hearings, plans, goals, counsel, clients, projects, links] = await Promise.all([
        app.crud.task.list('u'), app.crud.meeting.list('u'), app.crud.followUp.list('u'), app.crud.case.list('u'), app.crud.hearing.list('u'),
        app.crud.plan.list('u'), app.crud.goal.list('u'), app.crud.counsel.list('u'), app.crud.client.list('u'), app.crud.project.list('u'), app.crud.link.list('u'),
      ])
      return new RelationGraph({ tasks, meetings, followUps, cases, hearings, plans, goals, counsel, clients, projects, links })
    }
    const parents = (await load()).thread({ kind: 'plan', id: plan.id }).ancestors.map((a) => a.ref.id)
    expect(parents).toEqual(expect.arrayContaining([c1.id, c2.id]))

    await app.cases.remove('u', c1.id)
    const after = await app.crud.plan.get('u', plan.id)
    expect(after).toMatchObject({ caseIds: [c2.id] })
    expect(planScope(after!)).toBe('case')

    // An independent copy keeps the page and steps, starts uncovered, with every step open.
    const step = (await app.crud.task.list('u')).find((t) => t.planId === plan.id)!
    await app.crud.task.update({ ...step, outcome: { status: 'done' } })
    const copy = await app.plans.duplicate('u', plan.id)
    expect(copy).toMatchObject({ title: 'Shared approach (copy)', status: 'draft' })
    expect(planScope(copy)).toBe('general')
    const copied = (await app.crud.task.list('u')).filter((t) => t.planId === copy.id)
    expect(copied.map((t) => [t.title, t.outcome.status])).toEqual([['Draft', 'open']])
  })

  it('puts a plan under its hearing in the thread, and the post-hearing plan targets the next hearing', async () => {
    const app = freshApp()
    const c = await app.cases.open('u', { organization: 'SA', type: 'other', title: 'T', status: 'active', summary: '' })
    const h = await app.crud.hearing.create('u', { caseId: c.id, date: '2026-10-20', duration: 60, purpose: 'Reply', outcome: { status: 'open' } })
    const { plan, nextHearing } = await app.cases.recordHearing('u', h.id, {
      summary: 'Adjourned', outcome: { status: 'not_done' }, next: { date: '2026-11-10', purpose: 'Reply (contd.)' }, plan: { title: 'Prep', objective: '', steps: [] },
    })
    expect(plan!.hearingIds).toEqual([nextHearing!.id])

    const [tasks, meetings, followUps, cases, hearings, plans, goals, counsel, links] = await Promise.all([
      app.crud.task.list('u'), app.crud.meeting.list('u'), app.crud.followUp.list('u'), app.crud.case.list('u'),
      app.crud.hearing.list('u'), app.crud.plan.list('u'), app.crud.goal.list('u'), app.crud.counsel.list('u'), app.crud.link.list('u'),
    ])
    const graph = new RelationGraph({ tasks, meetings, followUps, cases, hearings, plans, goals, counsel, clients: [], projects: [], links })
    expect(graph.thread({ kind: 'plan', id: plan!.id }).ancestors.map((a) => a.ref.id)).toEqual(expect.arrayContaining([nextHearing!.id, h.id, c.id]))
  })
})

describe('clients and projects', () => {
  it('ties meetings and tasks to a client or one of its projects, and finds them again', async () => {
    const app = freshApp()
    const acme = await app.crud.client.create('u', { kind: 'company', name: ' Acme Ltd ', status: 'active', notes: '' })
    const other = await app.crud.client.create('u', { kind: 'individual', name: 'Priya', status: 'prospect', notes: '' })
    const portal = await app.crud.project.create('u', { title: 'Customer portal', clientId: acme.id, status: 'active', description: '' })
    expect(acme.name).toBe('Acme Ltd')

    const kickoff = await app.meetings.save('u', meetingDraft({ workspace: 'fsa', title: 'Kickoff', related: { kind: 'project', id: portal.id } }))
    const intro = await app.meetings.save('u', meetingDraft({ workspace: 'fsa', title: 'Intro call', related: { kind: 'client', id: acme.id } }))
    await app.meetings.save('u', meetingDraft({ workspace: 'fsa', title: 'Someone else', related: { kind: 'client', id: other.id } }))
    const t = await app.crud.task.create('u', { title: 'Send proposal', notes: '', workspace: 'fsa', priority: 'normal', estimate: 30, outcome: { status: 'open' }, related: { kind: 'project', id: portal.id } })

    const projects = await app.crud.project.list('u')
    const keys = clientRefKeys(acme.id, projects)
    expect(meetingsFor(keys, await app.crud.meeting.list('u')).map((m) => m.title).sort()).toEqual(['Intro call', 'Kickoff'])
    expect(tasksFor(keys, await app.crud.task.list('u')).map((x) => x.id)).toEqual([t.id])
    expect(clientOf(kickoff.related, projects)).toBe(acme.id)
    expect(clientOf(intro.related, projects)).toBe(acme.id)
    expect(clientOf(undefined, projects)).toBeUndefined()
  })

  it('validates, and deleting a client removes its projects but not the work', async () => {
    const app = freshApp()
    await expect(app.crud.client.create('u', { kind: 'company', name: '  ', status: 'active', notes: '' })).rejects.toThrow(/Name is required/)
    await expect(app.crud.client.create('u', { kind: 'company', name: 'X', email: 'nope', status: 'active', notes: '' })).rejects.toThrow(/valid email/)
    const c = await app.crud.client.create('u', { kind: 'company', name: 'Acme', status: 'active', notes: '' })
    await expect(app.crud.project.create('u', { title: 'P', clientId: '', status: 'active', description: '' })).rejects.toThrow(/Client is required/)
    await expect(app.crud.project.create('u', { title: 'P', clientId: c.id, status: 'active', description: '', startDate: '2026-10-10', dueDate: '2026-10-01' })).rejects.toThrow(/before the start/)
    const p = await app.crud.project.create('u', { title: 'P', clientId: c.id, status: 'active', description: '' })
    const m = await app.meetings.save('u', meetingDraft({ workspace: 'fsa', related: { kind: 'project', id: p.id } }))

    await app.clients.remove('u', c.id)
    expect(await app.crud.client.list('u')).toEqual([])
    expect(await app.crud.project.list('u')).toEqual([])
    expect((await app.crud.meeting.list('u')).map((x) => x.id)).toEqual([m.id])
  })
})

describe('linked documents', () => {
  it('turns Google addresses into addresses that can be shown in place', () => {
    const id = '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789'
    expect(describeLink(`https://docs.google.com/document/d/${id}/edit?usp=sharing`)).toMatchObject({ provider: 'google-doc', embedUrl: `https://docs.google.com/document/d/${id}/preview` })
    expect(describeLink(`https://docs.google.com/spreadsheets/d/${id}/edit#gid=0`)).toMatchObject({ provider: 'google-sheet', embedUrl: `https://docs.google.com/spreadsheets/d/${id}/preview` })
    expect(describeLink(`https://docs.google.com/presentation/d/${id}/edit`)).toMatchObject({ provider: 'google-slides', embedUrl: `https://docs.google.com/presentation/d/${id}/preview` })
    expect(describeLink(`https://drive.google.com/file/d/${id}/view?usp=drive_link`)).toMatchObject({ provider: 'google-drive', embedUrl: `https://drive.google.com/file/d/${id}/preview` })
    expect(describeLink(`https://drive.google.com/open?id=${id}`)).toMatchObject({ provider: 'google-drive' })
    expect(describeLink(`https://drive.google.com/drive/folders/${id}`)).toMatchObject({ provider: 'google-folder', embedUrl: `https://drive.google.com/embeddedfolderview?id=${id}#list` })
    expect(describeLink(`https://docs.google.com/forms/d/e/${id}/viewform`)).toEqual({ url: `https://docs.google.com/forms/d/e/${id}/viewform`, provider: 'google-form' })
  })

  it('opens other addresses in a new tab, frames only secure PDFs, and refuses what is not a web address', () => {
    expect(describeLink('https://example.com/report')).toEqual({ url: 'https://example.com/report', provider: 'web' })
    expect(describeLink('https://example.com/files/Order.pdf')).toMatchObject({ provider: 'web', embedUrl: 'https://example.com/files/Order.pdf' })
    expect(describeLink('http://example.com/files/Order.pdf')?.embedUrl).toBeUndefined()
    expect(describeLink('javascript:alert(1)')).toBeNull()
    expect(describeLink('not a link')).toBeNull()
    expect(describeLink('https://evil.example/docs.google.com/document/d/AAAAAAAAAAAAAAAAAAAA/edit')?.provider).toBe('web')
    expect(defaultLinkName(describeLink('https://example.com/files/Order.pdf')!)).toBe('Order.pdf')
  })

  it('attaches a link to a record without storing any bytes, and records it in the history', async () => {
    const app = freshApp()
    const c = await app.crud.client.create('u', { kind: 'company', name: 'Acme', status: 'active', notes: '' })
    const owner = { kind: 'client' as const, id: c.id }
    const a = await app.attachments.attachLink('u', owner, 'Acme', 'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit', ' Statement of work ')
    expect(a).toMatchObject({ name: 'Statement of work', backend: 'link', size: 0, link: { provider: 'google-doc' } })
    expect(categoryOf(a)).toBe('link')
    expect(await app.attachments.url(a)).toBe(a.link!.url)
    await expect(app.attachments.attachLink('u', owner, 'Acme', 'nope')).rejects.toThrow(/web address/)
    expect((await app.crud.activity.list('u')).some((x) => x.ref.id === c.id && x.summary.includes('Statement of work'))).toBe(true)
    await app.attachments.remove('u', a, 'Acme')
    expect(await app.crud.attachment.list('u')).toEqual([])
  })
})

describe('case diary — the hearing record', () => {
  const setup = async (app: ReturnType<typeof freshApp>) => {
    const c = await app.cases.open('u', { organization: 'TUMWU', type: 'pow', title: 'Wages', status: 'active', summary: '' })
    const h = await app.crud.hearing.create('u', { caseId: c.id, date: '2026-10-20', duration: 60, purpose: 'Evidence', forum: 'Court 2', outcome: { status: 'open' } })
    return { c, h }
  }

  it('keeps the write-up on the hearing itself, with its actions as the plan’s dated steps', async () => {
    const app = freshApp()
    const { c, h } = await setup(app)
    const result = await app.cases.recordHearing('u', h.id, {
      summary: 'WW-1 examined.',
      outcome: { status: 'done' },
      next: { date: '2026-11-10', purpose: 'Cross-examination' },
      plan: { title: 'Prepare cross', objective: '', steps: [] },
      notes: {
        bench: 'Court 2',
        order: 'List on 10 Nov.',
        authorities: ['Section 13A', ' Section 13A ', ''],
        actions: [{ text: 'Re-read the ledger', due: '2026-11-01' }, { text: '  ' }, { text: 'Brief the witnesses' }],
      },
    })

    // One record: the hearing is the diary entry; nothing else was stored for it.
    const stored = (await app.crud.hearing.get('u', h.id))!
    expect(stored).toMatchObject({ summary: 'WW-1 examined.', bench: 'Court 2', order: 'List on 10 Nov.', authorities: ['Section 13A'], nextHearingId: result.nextHearing!.id })
    expect(stored.actions!.map((a) => a.text)).toEqual(['Re-read the ledger', 'Brief the witnesses'])
    expect(diaryOf(await app.crud.hearing.list('u')).map((x) => x.id)).toEqual([h.id])

    const steps = (await app.crud.task.list('u')).filter((t) => t.planId === result.plan!.id).sort((a, b) => a.order! - b.order!)
    expect(steps.map((t) => [t.title, t.dueDate])).toEqual([['Re-read the ledger', '2026-11-01'], ['Brief the witnesses', '2026-11-10']])
    expect(stored.actions!.map((a) => a.taskId)).toEqual(steps.map((t) => t.id))
    expect(result.plan).toMatchObject({ caseIds: [c.id], hearingIds: [result.nextHearing!.id] })
  })

  it('revises the same record, keeps the tasks already made, and clears what is left out', async () => {
    const app = freshApp()
    const { h } = await setup(app)
    await app.cases.recordHearing('u', h.id, { summary: 'First write-up', outcome: { status: 'done' }, plan: { title: 'P', objective: '', steps: [] }, notes: { order: 'Reply in 2 weeks', actions: [{ text: 'File reply' }] } })
    const first = (await app.crud.hearing.get('u', h.id))!

    await app.cases.recordHearing('u', h.id, { summary: 'Corrected write-up', outcome: { status: 'done' }, notes: { actions: first.actions } })
    const second = (await app.crud.hearing.get('u', h.id))!
    expect(second.summary).toBe('Corrected write-up')
    expect(second.order).toBeUndefined()
    expect(second.actions![0].taskId).toBe(first.actions![0].taskId)
    expect((await app.crud.plan.list('u')).length).toBe(1)
    expect((await app.crud.hearing.list('u')).length).toBe(1)

    // With no notes given, what the hearing has is left alone.
    await app.crud.hearing.update({ ...second, order: 'Adjourned' })
    await app.cases.recordHearing('u', h.id, { summary: 'Third', outcome: { status: 'done' } })
    expect((await app.crud.hearing.get('u', h.id))).toMatchObject({ summary: 'Third', order: 'Adjourned' })
  })

  it('is not a diary entry until something has been written or recorded', async () => {
    const app = freshApp()
    const { h } = await setup(app)
    expect(diaryOf(await app.crud.hearing.list('u'))).toEqual([])
    await app.cases.recordHearing('u', h.id, { summary: '', outcome: { status: 'not_done', comment: 'Not taken up' } })
    expect(diaryOf(await app.crud.hearing.list('u')).map((x) => x.id)).toEqual([h.id])
  })

  it('turns the open actions into tasks or a plan, once, following the hearing’s next date', async () => {
    const app = freshApp()
    const { c, h } = await setup(app)
    const next = await app.crud.hearing.create('u', { caseId: c.id, date: '2026-11-10', duration: 60, purpose: 'Arguments', outcome: { status: 'open' } })
    await app.crud.hearing.update({ ...(await app.crud.hearing.get('u', h.id))!, nextHearingId: next.id, summary: 'Adjourned.', actions: [{ id: 'a1', text: 'Draft written submissions', due: '2026-11-05' }, { id: 'a2', text: 'Collect certified copies' }] })

    const tasked = await app.hearingActions.toTasks('u', h.id)
    const made = (await app.crud.task.list('u')).filter((t) => t.related?.id === c.id)
    expect(made.map((t) => [t.title, t.dueDate, t.workspace]).sort()).toEqual([['Collect certified copies', '2026-11-10', 'sb'], ['Draft written submissions', '2026-11-05', 'sb']])
    expect(tasked.actions!.every((a) => a.taskId)).toBe(true)
    await expect(app.hearingActions.toTasks('u', h.id)).rejects.toThrow(/already has a task/)

    await app.crud.hearing.update({ ...tasked, actions: [...tasked.actions!, { id: 'a3', text: 'Brief senior counsel' }] })
    const plan = await app.hearingActions.toPlan('u', h.id)
    expect(plan).toMatchObject({ title: 'Prepare for Arguments', caseIds: [c.id], hearingIds: [next.id], origin: { kind: 'hearing', id: h.id } })
    expect((await app.crud.task.list('u')).filter((t) => t.planId === plan.id).map((t) => t.title)).toEqual(['Brief senior counsel'])
    expect((await app.crud.hearing.get('u', h.id))!.actions!.every((a) => a.taskId)).toBe(true)
  })

  it('shows an action as closed once its task is, and searches the whole record', async () => {
    const app = freshApp()
    const { c, h } = await setup(app)
    await app.cases.recordHearing('u', h.id, { summary: 'Limitation point argued.', outcome: { status: 'done' }, notes: { order: 'Reply in two weeks', authorities: ['AIR 1999 SC 1'], actions: [{ text: 'File reply' }, { text: 'Serve copy' }] } })
    const tasked = await app.hearingActions.toTasks('u', h.id)
    const [t1] = await app.crud.task.list('u')
    await app.crud.task.update({ ...t1, outcome: { status: 'done' } })
    const tasks = await app.crud.task.list('u')
    expect(pendingActions(tasked, tasks)).toHaveLength(1)
    expect(actionClosed(tasked.actions!.find((a) => a.taskId === t1.id)!, tasks)).toBe(true)

    const all = await app.crud.hearing.list('u')
    const cases = await app.crud.case.list('u')
    expect(searchDiary(all, cases, 'limitation')).toHaveLength(1)
    expect(searchDiary(all, cases, 'reply two weeks')).toHaveLength(1)
    expect(searchDiary(all, cases, 'AIR 1999')).toHaveLength(1)
    expect(searchDiary(all, cases, c.reference)).toHaveLength(1)
    expect(searchDiary(all, cases, 'nothing like this')).toEqual([])
    expect(searchDiary(all, cases, '  ')).toHaveLength(1)
  })
})

describe('one hearing for several cases', () => {
  const twoCases = async (app: ReturnType<typeof freshApp>) => {
    const a = await app.cases.open('u', { organization: 'TUMWU', type: 'pow', title: 'Wages A', status: 'active', summary: '' })
    const b = await app.cases.open('u', { organization: 'TUMWU', type: 'pow', title: 'Wages B', status: 'active', summary: '' })
    const h = await app.crud.hearing.create('u', { caseId: a.id, alsoCaseIds: [b.id, a.id, b.id], date: '2026-10-20', duration: 60, purpose: 'Evidence (both)', outcome: { status: 'open' } })
    return { a, b, h }
  }

  it('lists the hearing on every case it concerns, with one record', async () => {
    const app = freshApp()
    const { a, b, h } = await twoCases(app)
    expect(h.alsoCaseIds).toEqual([b.id])
    expect(hearingCaseIds(h)).toEqual([a.id, b.id])
    const all = await app.crud.hearing.list('u')
    expect(hearingsOf(a.id, all).map((x) => x.id)).toEqual([h.id])
    expect(hearingsOf(b.id, all).map((x) => x.id)).toEqual([h.id])

    const result = await app.cases.recordHearing('u', h.id, {
      summary: 'Both matters taken up together.',
      outcome: { status: 'done' },
      next: { date: '2026-11-10', purpose: 'Arguments (both)' },
      plan: { title: 'Prepare', objective: '', steps: [] },
      notes: { order: 'List both on 10 Nov.', actions: [{ text: 'Consolidated written submissions' }] },
    })
    // The next listing and the plan serve both cases; there is still only one record of each.
    expect(hearingCaseIds(result.nextHearing!)).toEqual([a.id, b.id])
    expect(result.plan!.caseIds).toEqual([a.id, b.id])
    expect(diaryOf(await app.crud.hearing.list('u'))).toHaveLength(1)
    expect(hearingsOf(b.id, await app.crud.hearing.list('u'))).toHaveLength(2)
  })

  it('sits under each case in the thread and brings every case along to a plan', async () => {
    const app = freshApp()
    const { a, b, h } = await twoCases(app)
    const plan = await app.plans.createWithSteps('u', { title: 'Shared', objective: '', workspace: 'sb', status: 'active' }, [])
    const covered = await app.plans.cover('u', plan.id, { kind: 'hearing', id: h.id })
    expect(planCaseIds(covered)).toEqual([a.id, b.id])

    const [tasks, meetings, followUps, cases, hearings, plans, goals, counsel, clients, projects, links] = await Promise.all([
      app.crud.task.list('u'), app.crud.meeting.list('u'), app.crud.followUp.list('u'), app.crud.case.list('u'), app.crud.hearing.list('u'),
      app.crud.plan.list('u'), app.crud.goal.list('u'), app.crud.counsel.list('u'), app.crud.client.list('u'), app.crud.project.list('u'), app.crud.link.list('u'),
    ])
    const graph = new RelationGraph({ tasks, meetings, followUps, cases, hearings, plans, goals, counsel, clients, projects, links })
    expect(graph.thread({ kind: 'hearing', id: h.id }).ancestors.map((x) => x.ref.id)).toEqual(expect.arrayContaining([a.id, b.id]))

    // Dropping one case keeps the hearing and the plan on the other.
    const after = await app.plans.uncover('u', plan.id, { kind: 'case', id: a.id })
    expect(planCaseIds(after)).toEqual([b.id])
    expect(planHearingIds(after)).toEqual([h.id])
  })

  it('deleting a case leaves the shared hearing with the other case', async () => {
    const app = freshApp()
    const { a, b, h } = await twoCases(app)
    const only = await app.crud.hearing.create('u', { caseId: a.id, date: '2026-10-25', duration: 30, purpose: 'Only A', outcome: { status: 'open' } })
    await app.cases.remove('u', a.id)
    const left = await app.crud.hearing.list('u')
    expect(left.map((x) => x.id)).toEqual([h.id])
    expect(left[0].caseId).toBe(b.id)
    expect(left[0].alsoCaseIds).toBeUndefined()
    expect(left.some((x) => x.id === only.id)).toBe(false)

    // Dropping a case that was only an “also” detaches it from the hearing.
    const c = await app.cases.open('u', { organization: 'SA', type: 'other', title: 'C', status: 'active', summary: '' })
    await app.crud.hearing.update({ ...left[0], alsoCaseIds: [c.id] })
    await app.cases.remove('u', c.id)
    expect(hearingCaseIds((await app.crud.hearing.get('u', h.id))!)).toEqual([b.id])
  })
})

describe('adding other cases to a hearing', () => {
  const setup = async (app: ReturnType<typeof freshApp>) => {
    const a = await app.cases.open('u', { organization: 'TUMWU', type: 'pow', title: 'A', status: 'active', summary: '' })
    const b = await app.cases.open('u', { organization: 'TUMWU', type: 'pow', title: 'B', status: 'active', summary: '' })
    const c = await app.cases.open('u', { organization: 'TUMWU', type: 'pow', title: 'C', status: 'active', summary: '' })
    const ha = await app.crud.hearing.create('u', { caseId: a.id, date: '2026-10-27', duration: 60, purpose: 'Hearing at Kurnool', outcome: { status: 'open' } })
    const hb = await app.crud.hearing.create('u', { caseId: b.id, date: '2026-10-27', duration: 60, purpose: 'Evidence', outcome: { status: 'open' } })
    return { a, b, c, ha, hb }
  }

  it('folds another case’s unrecorded listing for the same day into this hearing', async () => {
    const app = freshApp()
    const { a, b, ha, hb } = await setup(app)
    const plan = await app.plans.createWithSteps('u', { title: 'Prep B', objective: '', workspace: 'sb', status: 'active', caseIds: [b.id], hearingIds: [hb.id] }, [])
    const nextOfB = await app.crud.hearing.create('u', { caseId: b.id, date: '2026-11-10', duration: 30, purpose: 'Next', outcome: { status: 'open' } })
    await app.crud.hearing.update({ ...nextOfB })
    const earlier = await app.crud.hearing.create('u', { caseId: b.id, date: '2026-10-01', duration: 30, purpose: 'Earlier', outcome: { status: 'done' }, nextHearingId: hb.id })
    const task = await app.crud.task.create('u', { title: 'Bring originals', notes: '', workspace: 'sb', priority: 'normal', estimate: 30, outcome: { status: 'open' }, related: { kind: 'hearing', id: hb.id } })

    const { hearing, merged } = await app.cases.joinCases('u', ha.id, [b.id])
    expect(merged.map((m) => m.id)).toEqual([hb.id])
    expect(hearingCaseIds(hearing)).toEqual([a.id, b.id])
    // The absorbed listing is gone, and what pointed at it points here now.
    expect(await app.crud.hearing.get('u', hb.id)).toBeNull()
    expect(planHearingIds((await app.crud.plan.get('u', plan.id))!)).toEqual([ha.id])
    expect((await app.crud.hearing.get('u', earlier.id))!.nextHearingId).toBe(ha.id)
    expect((await app.crud.task.get('u', task.id))!.related).toEqual({ kind: 'hearing', id: ha.id })
    expect(hearingsOf(b.id, await app.crud.hearing.list('u')).map((h) => h.id).sort()).toEqual([earlier.id, nextOfB.id, ha.id].sort())
  })

  it('leaves a same-day listing that was already written up on its own', async () => {
    const app = freshApp()
    const { b, ha, hb } = await setup(app)
    await app.cases.recordHearing('u', hb.id, { summary: 'Written up separately', outcome: { status: 'done' } })
    const { hearing, merged } = await app.cases.joinCases('u', ha.id, [b.id])
    expect(merged).toEqual([])
    expect(hearingCaseIds(hearing)).toContain(b.id)
    expect(await app.crud.hearing.get('u', hb.id)).not.toBeNull()
  })

  it('records a hearing with the cases picked in the dialog, and takes cases back off', async () => {
    const app = freshApp()
    const { a, b, c, ha, hb } = await setup(app)
    const result = await app.cases.recordHearing('u', ha.id, {
      summary: 'Both taken up.', outcome: { status: 'done' }, alsoCaseIds: [b.id, c.id], next: { date: '2026-11-10', purpose: 'Arguments' }, plan: { title: 'P', objective: '', steps: [] },
    })
    expect(hearingCaseIds(result.hearing)).toEqual([a.id, b.id, c.id])
    expect(await app.crud.hearing.get('u', hb.id)).toBeNull()
    expect(hearingCaseIds(result.nextHearing!)).toEqual([a.id, b.id, c.id])
    expect(result.plan!.caseIds).toEqual([a.id, b.id, c.id])

    // Revising without the cases leaves them; passing a shorter list removes the ones left out.
    await app.cases.recordHearing('u', ha.id, { summary: 'Again', outcome: { status: 'done' } })
    expect(hearingCaseIds((await app.crud.hearing.get('u', ha.id))!)).toEqual([a.id, b.id, c.id])
    await app.cases.recordHearing('u', ha.id, { summary: 'Again', outcome: { status: 'done' }, alsoCaseIds: [b.id] })
    expect(hearingCaseIds((await app.crud.hearing.get('u', ha.id))!)).toEqual([a.id, b.id])
    await expect(app.cases.joinCases('u', ha.id, ['nope'])).rejects.toThrow(/no longer exists/)
  })

  it('lists a hearing together with other cases in one step', async () => {
    const app = freshApp()
    const { a, c } = await setup(app)
    const { hearing, merged } = await app.cases.saveHearing('u', { caseId: a.id, alsoCaseIds: [c.id, c.id], date: '2026-12-01', duration: 60, purpose: 'Joint', outcome: { status: 'open' } })
    expect(merged).toEqual([])
    expect(hearingCaseIds(hearing)).toEqual([a.id, c.id])
    const edited = await app.cases.saveHearing('u', { ...hearing, purpose: 'Joint (renamed)', alsoCaseIds: [] })
    expect(edited.hearing.purpose).toBe('Joint (renamed)')
    expect(hearingCaseIds(edited.hearing)).toEqual([a.id])
  })

  it('knows which listings would fold in before it happens', async () => {
    const app = freshApp()
    const { b, c, ha, hb } = await setup(app)
    const all = await app.crud.hearing.list('u')
    expect(mergeCandidates(ha, [b.id], all).map((h) => h.id)).toEqual([hb.id])
    expect(mergeCandidates(ha, [c.id], all)).toEqual([])
    expect(mergeCandidates(ha, [], all)).toEqual([])
  })
})

describe('plan steps: tasks, follow-ups and appointments', () => {
  const planOf = (app: ReturnType<typeof freshApp>, over = {}) =>
    app.plans.createWithSteps('u', { title: 'Prepare', objective: '', workspace: 'sb', status: 'active', dueDate: '2026-11-10', ...over }, [])
  const pool = async (app: ReturnType<typeof freshApp>) => ({ tasks: await app.crud.task.list('u'), followUps: await app.crud.followUp.list('u'), meetings: await app.crud.meeting.list('u') })

  it('adds steps of each kind, each due on its own day', async () => {
    const app = freshApp()
    const plan = await planOf(app)
    await app.plans.addStep('u', plan.id, { title: 'Draft the reply', dueDate: '2026-11-03' })
    await app.plans.addStep('u', plan.id, { title: 'Call the registry', kind: 'followUp', dueDate: '2026-11-05' })
    await app.plans.addStep('u', plan.id, { title: 'Meet the witness', kind: 'appointment', dueDate: '2026-11-07', time: at(15) })
    await app.plans.addStep('u', plan.id, 'Whenever')

    const steps = planSteps(plan.id, await pool(app))
    expect(steps.map((s) => [s.kind, s.date])).toEqual([
      ['task', '2026-11-03'],
      ['followUp', '2026-11-05'],
      ['appointment', '2026-11-07'],
      ['task', '2026-11-10'],
    ])
    expect(steps[2].time).toBe(at(15))
    // They are real records, so they show up where they should.
    expect((await app.crud.followUp.list('u')).find((f) => f.title === 'Call the registry')).toMatchObject({ planId: plan.id, due: { date: '2026-11-05' } })
    expect((await app.crud.meeting.list('u')).find((m) => m.title === 'Meet the witness')).toMatchObject({ kind: 'appointment', slot: { date: '2026-11-07', start: at(15) } })
  })

  it('changes a step own day without touching the plan one', async () => {
    const app = freshApp()
    const plan = await planOf(app)
    const task = await app.plans.addStep('u', plan.id, { title: 'A', dueDate: '2026-11-03' })
    const call = await app.plans.addStep('u', plan.id, { title: 'B', kind: 'followUp', dueDate: '2026-11-04' })
    const appt = await app.plans.addStep('u', plan.id, { title: 'C', kind: 'appointment', dueDate: '2026-11-05', time: at(11) })
    await app.plans.setStepDate('u', task, '2026-11-08')
    await app.plans.setStepDate('u', call, '2026-11-09')
    await app.plans.setStepDate('u', appt, '2026-11-06')
    await expect(app.plans.setStepDate('u', appt, undefined)).rejects.toThrow(/needs a day/)

    expect(planSteps(plan.id, await pool(app)).map((s) => s.date)).toEqual(['2026-11-08', '2026-11-09', '2026-11-06'])
    expect((await app.crud.meeting.get('u', appt.id))!.slot.start).toBe(at(11))
    expect((await app.crud.plan.get('u', plan.id))!.dueDate).toBe('2026-11-10')
  })

  it('turns a step into another kind and keeps what it was', async () => {
    const app = freshApp()
    const plan = await planOf(app)
    const first = await app.plans.addStep('u', plan.id, { title: 'First', dueDate: '2026-11-03' })
    const second = await app.plans.addStep('u', plan.id, { title: 'Chase the clerk', dueDate: '2026-11-04' })
    await app.crud.task.update({ ...(await app.crud.task.get('u', second.id))!, outcome: { status: 'done', comment: 'Spoke to him' } })

    const call = await app.plans.convertStep('u', second, 'followUp')
    expect(call).toEqual({ kind: 'followUp', id: second.id })
    expect(await app.crud.task.get('u', second.id)).toBeNull()
    expect(await app.crud.followUp.get('u', second.id)).toMatchObject({ title: 'Chase the clerk', planId: plan.id, due: { date: '2026-11-04' }, outcome: { status: 'done', comment: 'Spoke to him' } })

    const appt = await app.plans.convertStep('u', call, 'appointment')
    expect(await app.crud.followUp.get('u', second.id)).toBeNull()
    expect(await app.crud.meeting.get('u', second.id)).toMatchObject({ kind: 'appointment', title: 'Chase the clerk', planId: plan.id, slot: { date: '2026-11-04' } })

    await app.plans.convertStep('u', appt, 'task')
    expect(await app.crud.meeting.get('u', second.id)).toBeNull()
    // Same place in the plan throughout, and the first step is untouched.
    const steps = planSteps(plan.id, await pool(app))
    expect(steps.map((s) => [s.id, s.kind])).toEqual([[first.id, 'task'], [second.id, 'task']])
    expect(await app.plans.convertStep('u', first, 'task')).toEqual(first)
  })

  it('keeps a hearing action following its step through a change of kind', async () => {
    const app = freshApp()
    const c = await app.cases.open('u', { organization: 'TUMWU', type: 'pow', title: 'A', status: 'active', summary: '' })
    const h = await app.crud.hearing.create('u', { caseId: c.id, date: '2026-10-27', duration: 60, purpose: 'Hearing', outcome: { status: 'open' } })
    await app.cases.recordHearing('u', h.id, { summary: 'Heard.', outcome: { status: 'done' }, notes: { actions: [{ text: 'File the memo' }] }, next: { date: '2026-11-10', purpose: 'Arguments' }, plan: { title: 'P', objective: '', steps: [] } })
    const stored = (await app.crud.hearing.get('u', h.id))!
    const action = stored.actions![0]
    expect(action.taskId).toBeTruthy()

    const made = await app.plans.convertStep('u', { kind: 'task', id: action.taskId! }, 'followUp')
    expect(made.id).toBe(action.taskId)
    expect(pendingActions(stored, await pool(app))).toHaveLength(1)
    await app.crud.followUp.update({ ...(await app.crud.followUp.get('u', made.id))!, outcome: { status: 'done' } })
    expect(actionClosed(action, await pool(app))).toBe(true)
  })

  it('counts follow-ups and appointments in a plan progress, and frees them with the plan', async () => {
    const app = freshApp()
    const plan = await planOf(app)
    await app.plans.addStep('u', plan.id, { title: 'A' })
    const call = await app.plans.addStep('u', plan.id, { title: 'B', kind: 'followUp' })
    await app.plans.addStep('u', plan.id, { title: 'C', kind: 'appointment' })
    await app.crud.followUp.update({ ...(await app.crud.followUp.get('u', call.id))!, outcome: { status: 'done' } })
    expect(planProgress(plan.id, await pool(app))).toMatchObject({ total: 3, done: 1 })

    const copy = await app.plans.duplicate('u', plan.id)
    expect(planSteps(copy.id, await pool(app)).map((s) => [s.kind, s.outcome.status])).toEqual([['task', 'open'], ['followUp', 'open'], ['appointment', 'open']])

    await app.plans.remove('u', plan.id)
    expect(planSteps(plan.id, await pool(app))).toEqual([])
    expect(await app.crud.followUp.get('u', call.id)).not.toBeNull()
  })

  it('reorders across kinds', async () => {
    const app = freshApp()
    const plan = await planOf(app)
    const a = await app.plans.addStep('u', plan.id, { title: 'A' })
    const b = await app.plans.addStep('u', plan.id, { title: 'B', kind: 'followUp' })
    const c = await app.plans.addStep('u', plan.id, { title: 'C', kind: 'appointment' })
    await app.plans.reorderSteps('u', plan.id, [c.id, a.id, b.id])
    expect(planSteps(plan.id, await pool(app)).map((s) => s.title)).toEqual(['C', 'A', 'B'])
  })
})

describe('step dates and the plan date', () => {
  const setup = async () => {
    const app = freshApp()
    const plan = await app.plans.createWithSteps('u', { title: 'P', objective: '', workspace: 'sb', status: 'active', dueDate: '2026-11-10' }, [])
    const pool = async () => ({ tasks: await app.crud.task.list('u'), followUps: await app.crud.followUp.list('u'), meetings: await app.crud.meeting.list('u') })
    return { app, plan, pool }
  }

  it('starts from the plan date, or has none when asked for none', async () => {
    const { app, plan, pool } = await setup()
    await app.plans.addStep('u', plan.id, 'inherits')
    await app.plans.addStep('u', plan.id, { title: 'own', dueDate: '2026-11-04' })
    await app.plans.addStep('u', plan.id, { title: 'none', dueDate: null })
    expect(planSteps(plan.id, await pool()).map((s) => s.date)).toEqual(['2026-11-10', '2026-11-04', undefined])
  })

  it('moves steps that were on the plan date when it changes, and leaves the rest', async () => {
    const { app, plan, pool } = await setup()
    await app.plans.addStep('u', plan.id, 'inherits')
    await app.plans.addStep('u', plan.id, { title: 'own', dueDate: '2026-11-04' })
    const done = await app.plans.addStep('u', plan.id, 'finished')
    await app.crud.task.update({ ...(await app.crud.task.get('u', done.id))!, outcome: { status: 'done' } })

    const result = await app.plans.setDueDate('u', plan.id, '2026-11-20')
    expect(result.moved).toBe(1)
    expect(result.plan.dueDate).toBe('2026-11-20')
    expect(planSteps(plan.id, await pool()).map((s) => s.date)).toEqual(['2026-11-20', '2026-11-04', '2026-11-10'])
    expect((await app.plans.setDueDate('u', plan.id, undefined)).moved).toBe(0)
  })
})

describe('chasing a follow-up', () => {
  const make = async (app: ReturnType<typeof freshApp>, over = {}) =>
    app.crud.followUp.create('u', { title: 'Chase the affidavit', channel: 'call', workspace: 'sb', contact: 'Mr. Rao', due: { date: '2026-10-28' }, duration: 15, outcome: { status: 'open' }, ...over })
  const attempt = (result: AttemptResult, minute: number, date = '2026-10-28'): Attempt => ({ date, minute, result })

  it('backs off after each miss, moves around the day, and then suggests another channel', () => {
    const now = { date: '2026-10-28', minute: at(11) }
    expect(suggestRetry([], 'no_answer', now)).toMatchObject({ date: '2026-10-28', time: at(13) })
    expect(suggestRetry([], 'no_answer', { date: '2026-10-28', minute: at(17) })).toMatchObject({ date: '2026-10-29', time: at(10) })
    // The second miss was in the morning, so try the evening.
    expect(suggestRetry([attempt('no_answer', at(9))], 'left_message', now)).toMatchObject({ date: '2026-10-29', time: at(17) })
    expect(suggestRetry([attempt('no_answer', at(15)), attempt('no_answer', at(16))], 'no_answer', { date: '2026-10-28', minute: at(15) })).toMatchObject({ date: '2026-10-30', switchChannel: true })
    const fourth = suggestRetry([attempt('no_answer', at(9)), attempt('no_answer', at(10)), attempt('no_answer', at(11))], 'no_answer', now)!
    expect(fourth).toMatchObject({ date: '2026-10-31', switchChannel: true })
    // Being reached in between starts the count again.
    expect(suggestRetry([attempt('no_answer', at(9)), attempt('not_ready', at(10))], 'no_answer', now)).toMatchObject({ date: '2026-10-28', time: at(13) })
  })

  it('goes with what the person said over the pattern', () => {
    const now = { date: '2026-10-28', minute: at(11) }
    expect(suggestRetry([], 'call_back', now, { callBackAt: at(16, 30) })).toMatchObject({ date: '2026-10-28', time: at(16, 30) })
    expect(suggestRetry([], 'call_back', now, { callBackAt: at(9) })).toMatchObject({ date: '2026-10-29', time: at(9) })
    expect(suggestRetry([], 'not_ready', now, { promisedFor: '2026-11-06' })).toMatchObject({ date: '2026-11-06' })
    expect(suggestRetry([], 'they_will_call', now)).toMatchObject({ date: '2026-10-30' })
    expect(suggestRetry([], 'reached', now)).toBeNull()
    expect(suggestRetry([], 'unreachable', now)).toBeNull()
  })

  it('keeps the follow-up open through every try, logging each, and closes it when someone is reached', async () => {
    const app = freshApp()
    const f = await make(app)
    const first = await app.followUps.logAttempt('u', f.id, { result: 'no_answer', note: 'Rang out' })
    expect(first.followUp.outcome.status).toBe('open')
    expect(first.followUp.attempts).toHaveLength(1)
    expect(first.followUp.due).toEqual({ date: first.suggestion!.date, time: first.suggestion!.time })
    expect(chaseOf(first.followUp)).toMatchObject({ kind: 'chasing', tries: 1, misses: 1 })

    const second = await app.followUps.logAttempt('u', f.id, { result: 'not_ready', note: 'Says the notary is away', promisedFor: '2026-11-04' })
    expect(second.followUp.due).toEqual({ date: '2026-11-04', time: undefined })
    expect(chaseOf(second.followUp)).toMatchObject({ kind: 'promised', promisedFor: '2026-11-04', tries: 2, misses: 0 })

    const done = await app.followUps.logAttempt('u', f.id, { result: 'reached', note: 'Signed and sent' })
    expect(done.followUp.outcome).toMatchObject({ status: 'done', comment: 'Signed and sent' })
    expect(done.followUp.attempts!.map((a) => a.result)).toEqual(['no_answer', 'not_ready', 'reached'])

    const back = await app.followUps.restore(done.before)
    expect(back.outcome.status).toBe('open')
    expect(back.attempts).toHaveLength(2)
  })

  it('lets you pick the next try yourself, switch channel, or stop when the number is dead', async () => {
    const app = freshApp()
    const f = await make(app)
    const own = await app.followUps.logAttempt('u', f.id, { result: 'call_back', callBackAt: at(16), next: { date: '2026-11-02', time: at(9) }, switchTo: 'message' })
    expect(own.followUp).toMatchObject({ channel: 'message', due: { date: '2026-11-02', time: at(9) } })
    expect(chaseOf(own.followUp).last?.channel).toBe('call')

    const waiting = await app.followUps.logAttempt('u', f.id, { result: 'they_will_call' })
    expect(chaseOf(waiting.followUp).kind).toBe('waiting')

    const dead = await app.followUps.logAttempt('u', f.id, { result: 'unreachable', note: 'Switched off for good' })
    expect(dead.followUp.due).toBeUndefined()
    expect(dead.followUp.outcome.status).toBe('open')
    expect(chaseOf(dead.followUp).kind).toBe('unreachable')
  })

  it('calls a chase stalled after three misses, and remembers when a contact picks up', async () => {
    const app = freshApp()
    const f = await make(app)
    for (let i = 0; i < 3; i++) await app.followUps.logAttempt('u', f.id, { result: 'no_answer' })
    expect(chaseOf((await app.crud.followUp.get('u', f.id))!).kind).toBe('stalled')

    const other = await make(app, { title: 'Another', contact: ' mr. rao ' })
    expect(bestMinute('Mr. Rao', await app.crud.followUp.list('u'))).toBeUndefined()
    await app.crud.followUp.update({ ...(await app.crud.followUp.get('u', other.id))!, attempts: [{ date: '2026-10-20', minute: at(10, 10), result: 'reached' }] })
    expect(bestMinute('Mr. Rao', await app.crud.followUp.list('u'))).toBe(at(10, 15))
    const next = await app.followUps.suggest('u', f.id, { result: 'no_answer' })
    expect(next).toMatchObject({ time: at(10, 15) })
  })
})
