import type { CaseUseCases } from '@/domain/cases/CaseUseCases'
import type { MeetingUseCases } from '@/domain/meetings/MeetingUseCases'
import type { PlanUseCases } from '@/domain/plans/PlanUseCases'
import type { CrudUseCases } from '@/domain/shared/CrudUseCases'
import type { Outcome } from '@/domain/shared/outcome'
import type { RecordOutcomeUseCase } from '@/domain/shared/RecordOutcomeUseCase'
import { shiftDate, toISODate } from '@/domain/shared/time'
import type { ID } from '@/domain/shared/types'

/** The slice of the application this seed drives. Seeding goes through use cases so links stay valid. */
interface SeedTarget {
  crud: {
    task: CrudUseCases<'task'>
    followUp: CrudUseCases<'followUp'>
    case: CrudUseCases<'case'>
    hearing: CrudUseCases<'hearing'>
    goal: CrudUseCases<'goal'>
  }
  meetings: MeetingUseCases
  plans: PlanUseCases
  cases: CaseUseCases
  outcomes: RecordOutcomeUseCase
}

const h = (hours: number, minutes = 0) => hours * 60 + minutes
const open: Outcome = { status: 'open' }

/** A lived-in practice around `today`: cases with hearings, appointments, plans and goals. */
export async function seedDemoData(app: SeedTarget, userId: ID, todayDate: Date): Promise<void> {
  const today = toISODate(todayDate)
  const day = (n: number) => shiftDate(today, n)
  const { crud } = app

  // --- S&B: cases & hearings ------------------------------------------------------------------
  const mehta = await crud.case.create(userId, {
    reference: 'CS(COMM) 412/2025',
    title: 'Mehta Textiles v. Coastal Freight',
    client: 'Mehta Textiles Pvt Ltd',
    court: 'Delhi High Court',
    opposingParty: 'Coastal Freight Lines',
    practiceArea: 'Commercial',
    stage: 'Evidence',
    status: 'active',
    filedOn: day(-210),
    summary:
      'Suit for recovery of ₹2.4 Cr for cargo damaged in transit (Mumbai → Delhi, March 2025). Liability admitted in part; dispute over valuation and the limitation clause in the bill of lading.\n\nKey issues: (1) whether clause 14 caps liability, (2) valuation of damaged stock, (3) interest from date of claim.',
  })
  const mehtaPast = await crud.hearing.create(userId, {
    caseId: mehta.id,
    date: day(-14),
    time: h(10, 30),
    duration: 90,
    purpose: 'Examination-in-chief of PW-1',
    forum: 'Court 23',
    outcome: open,
  })
  await app.cases.recordHearing(userId, mehtaPast.id, {
    summary:
      'PW-1 (plant manager) examined; exhibits P-4 to P-11 marked. Defence objected to P-9 (surveyor report) — objection kept open. Opposite counsel sought time for cross.',
    outcome: { status: 'done', comment: 'Proceeded as planned' },
    next: { date: day(3), time: h(10, 30), purpose: 'Cross-examination of PW-2 (surveyor)' },
    plan: {
      title: 'Prepare PW-2 cross-examination defence',
      objective: 'Make the surveyor report (P-9) admissible and shore up the valuation.',
      steps: ['Re-read surveyor report P-9 and annexures', 'Prep PW-2 for likely cross questions', 'Brief on admissibility of P-9', 'Compile valuation comparison chart'],
    },
    caseUpdate: { stage: 'Evidence' },
  })

  const arora = await crud.case.create(userId, {
    reference: 'OP 88/2026',
    title: 'In re: Arora Family Trust',
    client: 'R. Arora (Trustee)',
    court: 'District Court, Saket',
    practiceArea: 'Trusts & succession',
    stage: 'Pleadings',
    status: 'active',
    filedOn: day(-60),
    summary: 'Petition for directions on distribution of trust assets after the death of the settlor. Two beneficiaries contest the 2019 deed of variation.',
  })
  await crud.hearing.create(userId, { caseId: arora.id, date: day(-1), time: h(11), duration: 60, purpose: 'Reply to objections', forum: 'Court 4', outcome: open })

  const kapoor = await crud.case.create(userId, {
    reference: 'ITA 1290/2025',
    title: 'Kapoor Retail v. ACIT',
    client: 'Kapoor Retail LLP',
    court: 'ITAT, Delhi Bench',
    opposingParty: 'Assistant Commissioner of Income Tax',
    practiceArea: 'Tax',
    stage: 'Arguments',
    status: 'active',
    filedOn: day(-150),
    summary: 'Appeal against addition of ₹68 L under s.68 for unexplained cash credits. Strong documentary trail for 80% of credits.',
  })
  await crud.hearing.create(userId, { caseId: kapoor.id, date: day(12), time: h(14), duration: 60, purpose: 'Final arguments', forum: 'Bench B', outcome: open })

  // --- Appointments & meetings ----------------------------------------------------------------
  const aroraAppt = await app.meetings.save(userId, {
    kind: 'appointment',
    title: 'Trust distribution consultation',
    workspace: 'sb',
    slot: { date: today, start: h(15), duration: 60 },
    mode: 'in_person',
    location: 'S&B office, Conference room',
    counterpart: 'Mr. R. Arora',
    contact: '+91 98100 22114',
    attendees: ['R. Arora', 'Associate — Neha'],
    purpose: 'Walk through objections and options before the next listing.',
    agenda: [
      { id: 'a1', topic: 'Status after last hearing', minutes: 10, outcome: open },
      { id: 'a2', topic: 'Beneficiaries’ objections — response strategy', minutes: 30, outcome: open },
      { id: 'a3', topic: 'Documents still needed from the client', minutes: 15, outcome: open },
    ],
    confirmations: ['day_before', 'hour_before'],
    related: { kind: 'case', id: arora.id },
    outcome: open,
  })
  const aroraConfirmations = (await crud.followUp.list(userId)).filter((f) => f.subject?.id === aroraAppt.id)
  const dayBefore = aroraConfirmations.find((f) => f.trigger === 'day_before')
  if (dayBefore) {
    await app.outcomes.execute(userId, { kind: 'followUp', id: dayBefore.id }, { status: 'done', comment: 'Confirmed; he’ll bring the 2019 deed.' })
  }

  const sprint = await app.meetings.save(userId, {
    kind: 'meeting',
    title: 'FSA sprint planning',
    workspace: 'fsa',
    slot: { date: today, start: h(11, 30), duration: 45 },
    mode: 'virtual',
    link: 'https://meet.example.com/fsa-sprint',
    attendees: ['Product', 'Backend team', 'Design'],
    purpose: 'Commit scope for sprint 14.',
    agenda: [
      { id: 'b1', topic: 'Sprint 13 review', owner: 'Team', minutes: 10, outcome: open },
      { id: 'b2', topic: 'Rate-limiting rollout plan', owner: 'Backend', minutes: 20, outcome: open },
      { id: 'b3', topic: 'Capacity and commitments', minutes: 15, outcome: open },
    ],
    confirmations: [],
    outcome: open,
  })

  await app.meetings.save(userId, {
    kind: 'appointment',
    title: 'Client intake — appeal strategy',
    workspace: 'sb',
    slot: { date: day(1), start: h(10), duration: 45 },
    mode: 'phone',
    counterpart: 'Ms. S. Kapoor',
    contact: '+91 98111 40021',
    attendees: ['S. Kapoor'],
    purpose: 'Agree the line of argument for the ITAT final hearing.',
    agenda: [{ id: 'c1', topic: 'Evidence for remaining 20% of credits', outcome: open }],
    confirmations: ['day_before', 'hour_before'],
    related: { kind: 'case', id: kapoor.id },
    outcome: open,
  })

  await app.meetings.save(userId, {
    kind: 'meeting',
    title: 'Podcast episode prep',
    workspace: 'media',
    slot: { date: day(2), start: h(17), duration: 60 },
    mode: 'in_person',
    location: 'Studio 2',
    attendees: ['Producer — Karan'],
    agenda: [
      { id: 'd1', topic: 'Episode outline: litigation myths', outcome: open },
      { id: 'd2', topic: 'Guest shortlist', outcome: open },
    ],
    confirmations: [],
    outcome: open,
  })

  // A past meeting that still needs its outcome recorded.
  await app.meetings.save(userId, {
    kind: 'meeting',
    title: 'Media partnership call',
    workspace: 'media',
    slot: { date: day(-2), start: h(16), duration: 30 },
    mode: 'virtual',
    counterpart: 'Lexis Weekly',
    attendees: ['Editor — Priya'],
    agenda: [{ id: 'e1', topic: 'Monthly column proposal', outcome: open }],
    confirmations: [],
    outcome: open,
  })

  // --- Plans & goals --------------------------------------------------------------------------
  const fsaLaunch = await app.plans.createWithSteps(
    userId,
    { title: 'FSA platform v2 launch', objective: 'Ship v2 with rate limiting and the new billing flow.', workspace: 'fsa', status: 'active', dueDate: day(30), origin: { kind: 'meeting', id: sprint.id } },
    ['Finalise rate-limit thresholds', 'Load test billing service', 'Write migration runbook', 'Beta with 5 customers', 'Public launch post'],
  )
  const mediaPlan = await app.plans.createWithSteps(
    userId,
    { title: 'Media content calendar — Q4', objective: 'Two segments a week across podcast and column.', workspace: 'media', status: 'active', dueDate: day(60) },
    ['Outline 8 episodes', 'Record segment voice-over', 'Pitch column to Lexis Weekly', 'Set up publishing checklist'],
  )
  const practicePlan = await app.plans.createWithSteps(
    userId,
    { title: 'Grow commercial litigation pipeline', objective: 'Two new commercial mandates per month.', workspace: 'sb', status: 'active', dueDate: day(90) },
    ['Publish article on carrier liability', 'Reconnect with 10 past clients', 'CLE talk at the bar association'],
  )

  const tasks = await crud.task.list(userId)
  const mark = async (title: string, outcome: Outcome) => {
    const t = tasks.find((x) => x.title === title)
    if (t) await app.outcomes.execute(userId, { kind: 'task', id: t.id }, outcome)
  }
  await mark('Re-read surveyor report P-9 and annexures', { status: 'done' })
  await mark('Finalise rate-limit thresholds', { status: 'done' })
  await mark('Load test billing service', { status: 'partial', comment: 'p95 fine; p99 spikes at 2k rps', nextAction: 'Profile billing DB connection pool' })
  await mark('Outline 8 episodes', { status: 'done' })
  await mark('Pitch column to Lexis Weekly', { status: 'not_done', comment: 'Editor on leave', nextAction: 'Follow up after the partnership call' })
  await mark('Publish article on carrier liability', { status: 'done' })

  const mehtaPlan = (await crud.task.list(userId)).find((t) => t.title === 'Prep PW-2 for likely cross questions')
  const casePlanIds = mehtaPlan?.planId ? [mehtaPlan.planId] : []

  await crud.goal.create(userId, {
    title: 'Grow S&B litigation practice',
    description: 'Become the go-to firm for commercial and carrier-liability disputes in Delhi.',
    workspace: 'sb',
    horizon: 'year',
    startDate: day(-120),
    targetDate: day(245),
    planIds: [practicePlan.id, ...casePlanIds],
    keyResults: [
      { id: 'kr1', label: 'Active matters', start: 8, target: 20, current: 12 },
      { id: 'kr2', label: 'Reported judgments', start: 0, target: 4, current: 1 },
    ],
    checkIns: [{ id: 'ci1', date: day(-30), confidence: 4, note: 'Pipeline healthy; need more visibility.' }],
    status: 'active',
  })
  await crud.goal.create(userId, {
    title: 'Ship FSA platform v2',
    description: 'Reliable, billable v2 in customers’ hands this quarter.',
    workspace: 'fsa',
    horizon: 'quarter',
    startDate: day(-45),
    targetDate: day(45),
    planIds: [fsaLaunch.id],
    keyResults: [{ id: 'kr3', label: 'Beta customers live', start: 0, target: 5, current: 1 }],
    checkIns: [],
    status: 'active',
  })
  await crud.goal.create(userId, {
    title: 'Build a media presence',
    description: 'A steady, recognisable voice on legal-tech topics.',
    workspace: 'media',
    horizon: 'half',
    startDate: day(-90),
    targetDate: day(90),
    planIds: [mediaPlan.id, practicePlan.id],
    keyResults: [
      { id: 'kr4', label: 'Published segments', start: 0, target: 24, current: 5 },
      { id: 'kr5', label: 'Newsletter subscribers', start: 200, target: 2000, current: 540, unit: 'subs' },
    ],
    checkIns: [{ id: 'ci2', date: day(-14), confidence: 2, note: 'Recording cadence slipped during trial prep.' }],
    status: 'active',
  })

  // --- Standalone tasks & follow-ups ------------------------------------------------------------
  const task = (title: string, workspace: 'personal' | 'sb' | 'fsa' | 'media', extra: Partial<Parameters<typeof crud.task.create>[1]> = {}) =>
    crud.task.create(userId, { title, notes: '', workspace, priority: 'normal', estimate: 30, outcome: open, ...extra })

  await task('Review API rate-limit PR', 'fsa', { dueDate: today, estimate: 45, priority: 'high', slot: { date: today, start: h(9, 30), duration: 60 } })
  await task('Reply to press query — The Print', 'media', { dueDate: today, estimate: 20, priority: 'urgent' })
  await task('Draft written submissions — Kapoor', 'sb', { dueDate: day(5), estimate: 120, priority: 'high', related: { kind: 'case', id: kapoor.id } })
  await task('Renew passport', 'personal', { dueDate: day(-3), estimate: 30 })
  await task('Gym', 'personal', { dueDate: today, estimate: 60, slot: { date: today, start: h(7), duration: 60 } })
  await task('Pay advance tax instalment', 'personal', { dueDate: day(4), estimate: 15, priority: 'high' })

  await crud.followUp.create(userId, {
    title: 'Chase Coastal Freight’s counsel for documents',
    channel: 'email',
    workspace: 'sb',
    contact: 'adv.verma@coastal-legal.in',
    due: { date: today },
    duration: 15,
    subject: { kind: 'case', id: mehta.id },
    outcome: open,
  })
  await crud.followUp.create(userId, {
    title: 'Call Karan about guest availability',
    channel: 'call',
    workspace: 'media',
    contact: 'Karan · +91 99999 12345',
    due: { date: day(-1), time: h(18) },
    duration: 10,
    outcome: open,
  })
}
