import type { CaseUseCases } from '@/domain/cases/CaseUseCases'
import type { MeetingUseCases } from '@/domain/meetings/MeetingUseCases'
import type { PlanUseCases } from '@/domain/plans/PlanUseCases'
import type { CrudUseCases } from '@/domain/shared/CrudUseCases'
import type { Outcome } from '@/domain/shared/outcome'
import type { RecordOutcomeUseCase } from '@/domain/shared/RecordOutcomeUseCase'
import type { LinkUseCases } from '@/domain/relations/LinkUseCases'
import { shiftDate, toISODate } from '@/domain/shared/time'
import type { ID } from '@/domain/shared/types'

/** The slice of the application this seed drives. Seeding goes through use cases so links stay valid. */
interface SeedTarget {
  crud: {
    task: CrudUseCases<'task'>
    followUp: CrudUseCases<'followUp'>
    case: CrudUseCases<'case'>
    counsel: CrudUseCases<'counsel'>
    hearing: CrudUseCases<'hearing'>
    goal: CrudUseCases<'goal'>
    client: CrudUseCases<'client'>
    project: CrudUseCases<'project'>
  }
  meetings: MeetingUseCases
  plans: PlanUseCases
  cases: CaseUseCases
  outcomes: RecordOutcomeUseCase
  links: LinkUseCases
}

const h = (hours: number, minutes = 0) => hours * 60 + minutes
const open: Outcome = { status: 'open' }

/** A lived-in practice around `today`: cases with hearings, appointments, plans and goals. */
export async function seedDemoData(app: SeedTarget, userId: ID, todayDate: Date): Promise<void> {
  const today = toISODate(todayDate)
  const day = (n: number) => shiftDate(today, n)
  const { crud } = app

  // --- Counsel we know ---------------------------------------------------------------------------
  const iyer = await crud.counsel.create(userId, {
    kind: 'firm',
    name: 'Iyer & Partners',
    city: 'Hyderabad',
    phone: '+91 40 2330 4455',
    email: 'office@iyerpartners.example',
    courts: 'Telangana High Court, Commissioner for Employees’ Compensation',
    expertise: ['workmen_compensation', 'industrial_dispute'],
    proBono: false,
    status: 'active',
    notes: 'Handled our last two compensation claims. Usually ₹35–50k per claim; likes the medical file and employer letters up front.',
  })
  const rao = await crud.counsel.create(userId, {
    kind: 'advocate',
    name: 'Adv. S. Rao',
    firm: 'Rao Chambers',
    city: 'Hyderabad',
    phone: '+91 98480 11234',
    email: 'srao@raochambers.example',
    courts: 'Telangana High Court',
    expertise: ['public_interest', 'minimum_wages'],
    proBono: true,
    status: 'active',
    notes: 'Takes PILs for the unions pro bono. Prefers affidavits in English with Telugu translations attached.',
  })
  await crud.counsel.create(userId, {
    kind: 'advocate',
    name: 'Adv. Meera Pillai',
    firm: 'Pillai Associates',
    city: 'Bengaluru',
    phone: '+91 99000 55678',
    courts: 'Karnataka High Court, Labour Courts',
    expertise: ['pow', 'industrial_dispute', 'other'],
    proBono: false,
    status: 'active',
    notes: 'For matters that travel to Karnataka — workers returning from Bengaluru sites.',
  })

  // --- Cases & hearings (most are handled by us) -------------------------------------------------
  const mehta = await app.cases.open(userId, {
    organization: 'TUMWU',
    type: 'pow',
    courtNumber: 'PW Appeal 14/2026',
    title: 'Unpaid wages — Sri Lakshmi Brick Works (24 workers)',
    client: '24 brick kiln workers from Odisha',
    court: 'Authority under the Payment of Wages Act, Hyderabad',
    opposingParty: 'Sri Lakshmi Brick Works',
    practiceArea: 'Labour',
    stage: 'Evidence',
    status: 'active',
    filedOn: day(-210),
    summary:
      'Claim for four months of unpaid wages (₹9.6 L in all) and 10× compensation for delayed payment. The employer says the workers left voluntarily and were paid in full; no wage registers have been produced.\n\nKey issues: (1) whether wages were paid at all, (2) absence of registers under the Act, (3) limitation, and the employer’s plea that the workers were contract labour.',
  })
  const mehtaPast = await crud.hearing.create(userId, {
    caseId: mehta.id,
    date: day(-14),
    time: h(10, 30),
    duration: 90,
    purpose: 'Evidence of WW-1 (worker leader)',
    forum: 'Court Hall 2',
    outcome: open,
  })
  await app.cases.recordHearing(userId, mehtaPast.id, {
    summary:
      'WW-1 examined; muster-roll photographs and the workers’ ledger (Ex. W-4 to W-11) marked. Employer’s counsel objected to Ex. W-9 (the ledger) as unsigned — objection kept open. Time sought for cross-examination.',
    outcome: { status: 'done', comment: 'Proceeded as planned' },
    next: { date: day(3), time: h(10, 30), purpose: 'Cross-examination of employer’s witness (RW-1)' },
    plan: {
      title: 'Prepare cross-examination of RW-1',
      objective: 'Establish that no wages or registers exist and make the workers’ ledger (Ex. W-9) admissible.',
      // The steps come from the diary entry's actions below.
      steps: [],
    },
    notes: {
      bench: 'Hon’ble Presiding Officer, Labour Court 2',
      order: 'WW-1’s evidence recorded. Objection to Ex. W-9 kept open. Employer to begin cross-examination on the next date; list for RW-1.',
      submissions:
        'Argued that registers are the employer’s duty under the Payment of Wages Act and their absence shifts the burden. Respondent says the ledger is unsigned and a private record. Bench asked for authority on admissibility of private ledgers.',
      authorities: ['Section 13A, Payment of Wages Act', 'Authority on the employer’s burden to produce registers (to be located)'],
      evidence: 'WW-1 examined in chief. Ex. W-4 to W-11 marked; W-9 objected to. WW-2 and WW-3 still to be examined.',
      reflections: 'Bench seems receptive on the registers point but wants a case on unsigned ledgers. Lead with the burden argument next time; keep the ledger as corroboration.',
      actions: [
        { text: 'Re-read the ledger Ex. W-9 against worker statements', due: day(1) },
        { text: 'Prep worker witnesses for likely cross questions', due: day(2) },
        { text: 'Brief on admissibility of an unsigned ledger', due: day(2) },
        { text: 'Tabulate wages due, worker by worker' },
      ],
    },
    caseUpdate: { stage: 'Evidence' },
  })

  const arora = await app.cases.open(userId, {
    organization: 'PMLU',
    type: 'industrial_dispute',
    courtNumber: 'ID 88/2026',
    title: 'Retrenchment of 14 workers — Deccan Spinning Mills',
    client: '14 retrenched mill workers',
    court: 'Industrial Tribunal-cum-Labour Court, Hyderabad',
    opposingParty: 'Deccan Spinning Mills Ltd',
    practiceArea: 'Labour',
    stage: 'Pleadings',
    status: 'active',
    filedOn: day(-60),
    summary: 'Workers retrenched without notice or retrenchment compensation after a shift closure. Conciliation failed; the reference to the Tribunal is pending the management’s written statement.',
  })
  await crud.hearing.create(userId, { caseId: arora.id, date: day(-1), time: h(11), duration: 60, purpose: 'Written statement by management', forum: 'Court 4', outcome: open })

  const kapoor = await app.cases.open(userId, {
    organization: 'MRC',
    type: 'minimum_wages',
    courtNumber: 'MW 1290/2025',
    title: 'Minimum wages shortfall — Metro Guard Services',
    client: '31 security guards',
    court: 'Deputy Labour Commissioner, Secunderabad',
    opposingParty: 'Metro Guard Services Pvt Ltd',
    practiceArea: 'Labour',
    stage: 'Arguments',
    status: 'active',
    filedOn: day(-150),
    summary: 'Guards on a 12-hour shift paid ₹9,500 a month against the notified minimum for the scheduled employment. Claim for the shortfall for 26 months plus overtime.',
  })
  await crud.hearing.create(userId, { caseId: kapoor.id, date: day(12), time: h(14), duration: 60, purpose: 'Final arguments', forum: 'Hall B', outcome: open })

  // A public interest case, briefed to an outside advocate who takes these pro bono.
  const wages = await app.cases.open(userId, {
    organization: 'NUMW',
    type: 'public_interest',
    title: 'Unpaid wages of migrant construction workers',
    court: 'Telangana High Court',
    opposingParty: 'State Labour Department & 3 contractors',
    practiceArea: 'Labour',
    stage: 'Notice',
    status: 'active',
    filedOn: day(-40),
    engagement: { counselId: rao.id, engagedOn: day(-45), proBono: true, scope: 'Draft, file and argue the PIL', notes: 'We supply affidavits and the worker list; she handles all appearances.' },
    summary: 'PIL seeking recovery of withheld wages and enforcement of the Inter-State Migrant Workmen Act for workers from Odisha and Bihar on a Hyderabad metro site. Affidavits from 38 workers filed.',
  })
  await crud.hearing.create(userId, { caseId: wages.id, date: day(6), time: h(11), duration: 45, purpose: 'Admission — notice to State', forum: 'Court 1', outcome: open })

  // A paid brief to a law firm we know.
  const compensation = await app.cases.open(userId, {
    organization: 'SA',
    type: 'workmen_compensation',
    title: 'Death of Ravi Kumar at a construction site',
    client: 'Family of Ravi Kumar',
    court: 'Commissioner for Employees’ Compensation, Hyderabad',
    opposingParty: 'Contractor and principal employer',
    practiceArea: 'Labour',
    stage: 'Claim filed',
    status: 'active',
    filedOn: day(-25),
    engagement: { counselId: iyer.id, engagedOn: day(-24), proBono: false, fee: '₹40,000 fixed, paid in two parts', scope: 'File and conduct the claim to award', notes: 'Medical file and FIR with the firm. We stay in touch with the family.' },
    summary: 'Compensation claim for the death of a 27-year-old scaffolding worker from Bihar who fell from the 4th floor. Employer disputes that he was employed on site; site attendance photos and a co-worker statement establish it.',
  })
  await crud.hearing.create(userId, { caseId: compensation.id, date: day(9), time: h(15), duration: 30, purpose: 'Notice to employer — first appearance', forum: 'Court Hall 1', outcome: open })

  // --- Appointments & meetings ----------------------------------------------------------------
  const aroraAppt = await app.meetings.save(userId, {
    kind: 'appointment',
    title: 'Workers’ meeting — retrenchment case',
    workspace: 'sb',
    slot: { date: today, start: h(15), duration: 60 },
    mode: 'in_person',
    location: 'PMLU office, Palamooru',
    counterpart: 'Mr. P. Anjaiah (PMLU president)',
    contact: '+91 98100 22114',
    attendees: ['P. Anjaiah', '6 retrenched workers', 'Associate — Neha'],
    purpose: 'Walk the workers through the written statement and what we need from them.',
    agenda: [
      { id: 'a1', topic: 'Where the case stands after the last listing', minutes: 10, outcome: open },
      { id: 'a2', topic: 'Management’s plea — our response', minutes: 30, outcome: open },
      { id: 'a3', topic: 'Termination letters and pay slips still needed', minutes: 15, outcome: open },
    ],
    confirmations: ['day_before', 'hour_before'],
    related: { kind: 'case', id: arora.id },
    outcome: open,
  })
  const aroraConfirmations = (await crud.followUp.list(userId)).filter((f) => f.subject?.id === aroraAppt.id)
  const dayBefore = aroraConfirmations.find((f) => f.trigger === 'day_before')
  if (dayBefore) {
    await app.outcomes.execute(userId, { kind: 'followUp', id: dayBefore.id }, { status: 'done', comment: 'Confirmed; they’ll bring the termination letters.' })
  }

  // FSA: clients, their projects, and the meetings and tasks that hang off them.
  const northwind = await crud.client.create(userId, { kind: 'company', name: 'Northwind Logistics', contactName: 'Meera Rao', phone: '+91 98450 22110', email: 'meera@northwind.example', website: 'northwind.example', status: 'active', notes: 'Weekly check-in on Thursdays. Invoices go to accounts@northwind.example.' })
  const kaveri = await crud.client.create(userId, { kind: 'individual', name: 'Kaveri Textiles', contactName: 'Suresh Kaveri', phone: '+91 99000 41234', status: 'prospect', notes: 'Referred by Northwind. Wants a quote for an inventory app.' })
  const portal = await crud.project.create(userId, { title: 'Dispatch portal rebuild', clientId: northwind.id, status: 'active', description: 'Replace the dispatcher spreadsheet with a web portal: orders, routes, driver app.', startDate: day(-30), dueDate: day(60) })
  await crud.project.create(userId, { title: 'Billing integration', clientId: northwind.id, status: 'planned', description: 'Sync invoices with their accounting system.', dueDate: day(120) })
  await app.meetings.save(userId, {
    kind: 'appointment',
    title: 'Northwind — portal demo',
    workspace: 'fsa',
    slot: { date: day(2), start: h(15), duration: 60 },
    mode: 'virtual',
    link: 'https://meet.example.com/northwind-demo',
    counterpart: 'Meera Rao',
    contact: 'meera@northwind.example',
    attendees: ['Meera Rao', 'Dispatch team'],
    purpose: 'Walk through the order screens and agree what’s needed for sign-off.',
    agenda: [{ id: 'n1', topic: 'Order entry flow', outcome: open }, { id: 'n2', topic: 'Driver app timeline', outcome: open }],
    confirmations: ['day_before'],
    related: { kind: 'project', id: portal.id },
    outcome: open,
  })
  await app.meetings.save(userId, {
    kind: 'appointment',
    title: 'Kaveri Textiles — discovery call',
    workspace: 'fsa',
    slot: { date: day(4), start: h(12), duration: 30 },
    mode: 'phone',
    counterpart: 'Suresh Kaveri',
    contact: '+91 99000 41234',
    attendees: [],
    agenda: [],
    confirmations: ['hour_before'],
    related: { kind: 'client', id: kaveri.id },
    outcome: open,
  })
  await crud.task.create(userId, { title: 'Draft statement of work — Dispatch portal', notes: '', workspace: 'fsa', priority: 'high', estimate: 90, dueDate: day(1), outcome: open, related: { kind: 'project', id: portal.id } })
  await crud.task.create(userId, { title: 'Prepare quote for Kaveri Textiles', notes: '', workspace: 'fsa', priority: 'normal', estimate: 60, dueDate: day(5), outcome: open, related: { kind: 'client', id: kaveri.id } })

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
    title: 'Worker intake — minimum wages claim',
    workspace: 'sb',
    slot: { date: day(1), start: h(10), duration: 45 },
    mode: 'phone',
    counterpart: 'Mr. B. Yadav (guards’ representative)',
    contact: '+91 98111 40021',
    attendees: ['B. Yadav'],
    purpose: 'Agree the line of argument for the final hearing.',
    agenda: [{ id: 'c1', topic: 'Duty rosters to prove overtime', outcome: open }],
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
      { id: 'd1', topic: 'Episode outline: your rights when wages are held back', outcome: open },
      { id: 'd2', topic: 'Guest shortlist', outcome: open },
    ],
    confirmations: [],
    outcome: open,
  })

  // One case, many meetings: a prep meeting held about it, and an earlier union call linked by hand.
  await app.meetings.save(userId, {
    kind: 'meeting',
    title: 'Workers’ prep session — cross-examination',
    workspace: 'sb',
    slot: { date: day(2), start: h(18), duration: 45 },
    mode: 'virtual',
    link: 'https://meet.example.com/kiln-prep',
    attendees: ['WW-1 and 3 other workers', 'Associate — Neha'],
    purpose: 'Rehearse likely cross-examination questions with the witnesses.',
    agenda: [
      { id: 'f1', topic: 'Weak points in the ledger (Ex. W-9)', minutes: 20, outcome: open },
      { id: 'f2', topic: 'Who testifies on which months', minutes: 20, outcome: open },
    ],
    confirmations: [],
    related: { kind: 'case', id: mehta.id },
    outcome: open,
  })
  const mehtaUpdate = await app.meetings.save(userId, {
    kind: 'appointment',
    title: 'Union update — TUMWU executive',
    workspace: 'sb',
    slot: { date: day(-7), start: h(12), duration: 30 },
    mode: 'phone',
    counterpart: 'Mr. K. Narsimha (TUMWU general secretary)',
    contact: '+91 98200 11223',
    attendees: ['K. Narsimha'],
    agenda: [{ id: 'g1', topic: 'Explain the evidence stage and timeline', outcome: open }],
    confirmations: [],
    outcome: open,
  })
  await app.outcomes.execute(userId, { kind: 'meeting', id: mehtaUpdate.id }, { status: 'done', comment: 'Union comfortable with the timeline; wants monthly updates' })
  await app.links.link(userId, { kind: 'case', id: mehta.id }, { kind: 'meeting', id: mehtaUpdate.id }, { a: mehta.title, b: mehtaUpdate.title }, 'Union call about the evidence stage')

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
    { title: 'Grow labour-rights casework', objective: 'Two new worker cases a month through union referrals.', workspace: 'sb', status: 'active', dueDate: day(90) },
    ['Publish an explainer on wage-claim remedies', 'Reconnect with 10 union branch leaders', 'Legal-aid camp at the labour adda'],
  )

  const tasks = await crud.task.list(userId)
  const mark = async (title: string, outcome: Outcome) => {
    const t = tasks.find((x) => x.title === title)
    if (t) await app.outcomes.execute(userId, { kind: 'task', id: t.id }, outcome)
  }
  await mark('Re-read the ledger Ex. W-9 against worker statements', { status: 'done' })
  await mark('Finalise rate-limit thresholds', { status: 'done' })
  await mark('Load test billing service', { status: 'partial', comment: 'p95 fine; p99 spikes at 2k rps', nextAction: 'Profile billing DB connection pool' })
  await mark('Outline 8 episodes', { status: 'done' })
  await mark('Pitch column to Lexis Weekly', { status: 'not_done', comment: 'Editor on leave', nextAction: 'Follow up after the partnership call' })
  await mark('Publish an explainer on wage-claim remedies', { status: 'done' })

  const mehtaPlan = (await crud.task.list(userId)).find((t) => t.title === 'Prep worker witnesses for likely cross questions')
  const casePlanIds = mehtaPlan?.planId ? [mehtaPlan.planId] : []

  await crud.goal.create(userId, {
    title: 'Reach more workers through casework',
    description: 'Be the first call for migrant workers’ wage and compensation problems in Hyderabad.',
    workspace: 'sb',
    horizon: 'year',
    startDate: day(-120),
    targetDate: day(245),
    planIds: [practicePlan.id, ...casePlanIds],
    keyResults: [
      { id: 'kr1', label: 'Active matters', start: 8, target: 20, current: 12 },
      { id: 'kr2', label: 'Orders in workers’ favour', start: 0, target: 4, current: 1 },
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
  await task('Draft written submissions — Metro Guard MW claim', 'sb', { dueDate: day(5), estimate: 120, priority: 'high', related: { kind: 'case', id: kapoor.id } })
  await task('Renew passport', 'personal', { dueDate: day(-3), estimate: 30 })
  await task('Gym', 'personal', { dueDate: today, estimate: 60, slot: { date: today, start: h(7), duration: 60 } })
  await task('Pay advance tax instalment', 'personal', { dueDate: day(4), estimate: 15, priority: 'high' })

  await crud.followUp.create(userId, {
    title: 'Chase the employer’s counsel for wage registers',
    channel: 'email',
    workspace: 'sb',
    contact: 'adv.verma@example.in',
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
    attempts: [
      { date: day(-3), minute: h(11), result: 'no_answer', channel: 'call' },
      { date: day(-2), minute: h(17), result: 'left_message', channel: 'call', note: 'Voicemail — asked him to ring back' },
    ],
    outcome: open,
  })
}
