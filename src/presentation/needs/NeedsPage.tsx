import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CalendarClock, CalendarPlus, Check, Gavel, ListChecks, Mail, Sparkles, Sun, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { AttentionEvent, AttentionItem } from '@/domain/ai/AgentApi'
import { formatClock } from '@/domain/shared/time'
import { WORKSPACES } from '@/domain/shared/workspace'
import { cn } from '@/lib/utils'
import { AttentionSheet } from '@/presentation/agents/AttentionSheet'
import { cardKey, nextCard } from '@/presentation/agents/attentionCards'
import { mailRef } from '@/presentation/agents/executions'
import { useAttentionActions } from '@/presentation/agents/useAttentionActions'
import type { AttentionAction } from '@/presentation/agents/useAttentionActions'
import { useEditor } from '@/presentation/app/create'
import { useServices } from '@/presentation/app/services'
import { useWorkspaceFilter } from '@/presentation/app/workspaceFilter'
import { friendlyDate } from '@/presentation/components/dates'
import { PageHeader } from '@/presentation/components/layout'
import { OutcomeControl } from '@/presentation/components/outcome'
import { WorkspaceBadge } from '@/presentation/components/workspace'
import { CallLink } from '@/presentation/contacts/CallLink'
import { useEntities, useSave, useToday } from '@/presentation/data/hooks'
import { toast } from '@/presentation/notifications/toast'
import { Link } from '@/presentation/routing'
import { SECTIONS, useNeeds } from './useNeeds'
import type { Need, NeedSection } from './useNeeds'

const META: Record<NeedSection, { title: string; hint: string; tone: string }> = {
  urgent: { title: 'Urgent mail', hint: 'Your agents flagged these as needing you soon.', tone: 'text-destructive' },
  late: { title: 'Overdue', hint: 'Past their day. Do them, move them, or let them go.', tone: 'text-destructive' },
  approve: { title: 'Waiting for your OK', hint: 'Agents proposed these. Nothing is saved until you say yes.', tone: 'text-primary' },
  today: { title: 'Today', hint: 'Due or planned for today.', tone: 'text-foreground' },
  record: { title: 'To write up', hint: 'Meetings and hearings that happened without an outcome.', tone: 'text-warning' },
  mail: { title: 'Mail to read', hint: 'Not urgent, but your agents think you should see it.', tone: 'text-muted-foreground' },
}

/** Everything waiting on you in one list, in the order to deal with it, with the action beside each item. */
export function NeedsPage() {
  const { scope } = useWorkspaceFilter()
  const { needs, total, count } = useNeeds()
  const act = useAttentionActions()
  const sections = SECTIONS.filter((s) => count(s) > 0)

  // A mail row opens the same sheet the Attention page uses (the email, an event you can edit, every decision), and deciding moves to the next.
  const mail = needs.flatMap((n) => (n.kind === 'mail' ? [n.item] : []))
  const [openKey, setOpenKey] = useState<string | null>(null)
  const open = mail.find((i) => cardKey(i) === openKey) ?? null
  const at = open ? mail.findIndex((i) => cardKey(i) === openKey) : -1
  const decide = (item: AttentionItem, action: AttentionAction, event?: AttentionEvent) => {
    if (openKey === cardKey(item)) {
      const next = nextCard(mail, item)
      setOpenKey(next ? cardKey(next) : null)
    }
    void act(item, action, event)
  }
  const step = (by: 1 | -1) => mail.length > 0 && setOpenKey(cardKey(mail[(Math.max(at, 0) + by + mail.length) % mail.length]!))

  return (
    <>
      <PageHeader
        eyebrow={scope === 'all' ? 'All workspaces' : WORKSPACES[scope].name}
        title="Needs me"
        description={total === 0 ? 'Nothing is waiting on you.' : `${total} ${total === 1 ? 'thing is' : 'things are'} waiting on you, most pressing first. Act on each here: call, mark done, move it, approve it.`}
      />
      {total === 0 ? (
        <div className="grid justify-items-center gap-3 rounded-2xl border border-dashed px-4 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-success/12 text-success">
            <Check className="size-5" />
          </span>
          <p className="font-display text-3xl">You’re clear</p>
          <p className="max-w-md text-sm text-muted-foreground">No overdue work, nothing to approve and no urgent mail. New things appear here the moment an agent finds them or a date passes.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {sections.map((s) => (
            <section key={s} aria-label={META[s].title} className="grid gap-2">
              <header className="flex items-baseline gap-2 px-1">
                <h2 className={cn('text-sm font-semibold', META[s].tone)}>{META[s].title}</h2>
                <span className="text-xs text-muted-foreground tabular-nums">{count(s)}</span>
                <span className="hidden text-xs text-muted-foreground sm:inline">· {META[s].hint}</span>
              </header>
              <ul className="grid divide-y overflow-hidden rounded-2xl border bg-card/80">
                {needs
                  .filter((n) => n.section === s)
                  .map((n) => (
                    <li key={n.key}>
                      <Row need={n} onReview={(i) => setOpenKey(cardKey(i))} />
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <nav aria-label="Full lists" className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-4 text-xs text-muted-foreground">
        <span>Everything, not just what needs you:</span>
        {[
          ['/tasks', 'Tasks'],
          ['/follow-ups', 'Follow-ups'],
          ['/meetings', 'Meetings'],
          ...(scope === 'sb' || scope === 'all' ? [['/attention', 'All flagged mail']] : []),
        ].map(([to, label]) => (
          <Link key={to} to={to!} className="font-medium text-foreground underline-offset-2 hover:underline">
            {label}
          </Link>
        ))}
      </nav>
      <AttentionSheet item={open} position={at + 1} total={mail.length} onClose={() => setOpenKey(null)} onStep={step} onDecide={decide} />
    </>
  )
}

function Tile({ icon: Icon, tone }: { icon: typeof Mail; tone: string }) {
  return (
    <span className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg', tone)}>
      <Icon className="size-4" />
    </span>
  )
}

function Row({ need: n, onReview }: { need: Need; onReview: (item: AttentionItem) => void }) {
  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-2 px-3.5 py-3 sm:flex-nowrap">
      {n.kind === 'mail' && <MailRow n={n} onReview={onReview} />}
      {n.kind === 'followUp' && <WorkRow kind="followUp" n={n} />}
      {n.kind === 'task' && <WorkRow kind="task" n={n} />}
      {n.kind === 'meeting' && <RecordRow n={n} />}
      {n.kind === 'hearing' && <RecordRow n={n} />}
      {n.kind === 'proposal' && <ProposalRow n={n} />}
      {n.kind === 'plan' && <PlanRow n={n} />}
    </div>
  )
}

// --- mail -------------------------------------------------------------------------------------------------------

function MailRow({ n, onReview }: { n: Extract<Need, { kind: 'mail' }>; onReview: (item: AttentionItem) => void }) {
  const act = useAttentionActions()
  const i = n.item
  const ref = mailRef(i.itemId)
  const event = i.event
  const urgent = n.section === 'urgent'
  return (
    <>
      <Tile icon={event ? CalendarPlus : urgent ? AlertTriangle : Mail} tone={urgent ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'} />
      <button type="button" onClick={() => onReview(i)} aria-label={`Review: ${i.title}`} className="min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <span className="block truncate text-sm font-medium hover:underline">{i.title}</span>
        <span className="line-clamp-2 block text-xs text-muted-foreground">{i.summary}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          {i.action && <span className="font-medium text-foreground">{i.action}</span>}
          {i.due && <span className="tabular-nums">by {i.due}</span>}
          <span>{i.agentName}</span>
        </span>
      </button>
      <div className="flex shrink-0 flex-wrap items-center gap-1">
        {ref && (
          <Button variant="outline" size="xs" nativeButton={false} render={<Link to={`/mail?a=${encodeURIComponent(ref.accountId)}&f=${encodeURIComponent(i.folder || 'INBOX')}&m=${ref.uid}`} />}>
            Open
          </Button>
        )}
        {event && (
          <Button size="xs" onClick={() => void act(i, 'approve_event', event)}>
            <CalendarPlus /> Add to calendar
          </Button>
        )}
        <Button variant="ghost" size="xs" onClick={() => void act(i, 'done')}>
          <Check /> Done
        </Button>
        <Button variant="ghost" size="icon-xs" aria-label="Not important" onClick={() => void act(i, 'dismiss')}>
          <X />
        </Button>
      </div>
    </>
  )
}

// --- tasks and follow-ups ---------------------------------------------------------------------------------------

function WorkRow({ kind, n }: { kind: 'task' | 'followUp'; n: Extract<Need, { kind: 'task' | 'followUp' }> }) {
  const today = useToday()
  const { tomorrow } = useNeeds()
  const saveTask = useSave('task', 'Moved to tomorrow')
  const saveFollowUp = useSave('followUp', 'Moved to tomorrow')
  const f = n.kind === 'followUp' ? n.item : null
  const t = n.kind === 'task' ? n.item : null
  const item = (f ?? t)!
  const date = f ? f.due?.date : (t!.slot?.date ?? t!.dueDate)
  const time = f ? f.due?.time : t!.slot?.start

  const moveToTomorrow = async () => {
    if (f) await saveFollowUp.run({ ...f, due: { ...(f.due ?? { date: tomorrow }), date: tomorrow } })
    else if (t) await saveTask.run({ ...t, dueDate: tomorrow, slot: t.slot && t.slot.date <= today ? undefined : t.slot })
  }

  return (
    <>
      <OutcomeControl target={kind} id={item.id} outcome={item.outcome} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          <WorkspaceBadge ws={item.workspace} />
          {date && <span className={cn('tabular-nums', n.late && 'font-medium text-destructive')}>{n.late ? `Overdue · ${friendlyDate(date, today)}` : friendlyDate(date, today)}{time !== undefined && ` ${formatClock(time)}`}</span>}
          {item.contact && <CallLink contact={item.contact} channel={f?.channel ?? 'call'} />}
        </p>
      </div>
      <Button variant="ghost" size="xs" className="shrink-0" onClick={() => void moveToTomorrow()} disabled={saveTask.pending || saveFollowUp.pending}>
        <CalendarClock /> Tomorrow
      </Button>
    </>
  )
}

// --- meetings and hearings to write up ------------------------------------------------------------------------------

function RecordRow({ n }: { n: Extract<Need, { kind: 'meeting' | 'hearing' }> }) {
  const { open } = useEditor()
  const { data: cases } = useEntities('case')
  const today = useToday()
  const isHearing = n.kind === 'hearing'
  const title = isHearing ? n.item.purpose || 'Hearing' : n.item.title
  const when = isHearing ? n.item.date : n.item.slot.date
  const ref = isHearing ? cases.find((c) => c.id === n.item.caseId)?.reference : null
  return (
    <>
      <Tile icon={isHearing ? Gavel : ListChecks} tone="bg-warning/15 text-warning" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">
          {isHearing ? 'Hearing' : 'Meeting'} · {friendlyDate(when, today)}
          {ref && <span className="ml-2 font-mono">{ref}</span>}
        </p>
      </div>
      <Button variant="outline" size="xs" className="shrink-0" onClick={() => (n.kind === 'hearing' ? open({ kind: 'hearing', value: n.item }) : open({ kind: 'meeting', value: n.item }))}>
        Record outcome
      </Button>
    </>
  )
}

// --- what agents proposed ---------------------------------------------------------------------------------------------

function useSettle() {
  const client = useQueryClient()
  const [busy, setBusy] = useState(false)
  return {
    busy,
    run: async (go: () => Promise<unknown>, done: string) => {
      setBusy(true)
      try {
        await go()
        toast.success(done)
        await client.invalidateQueries()
      } catch (e) {
        toast.error('Couldn’t do that', { description: e instanceof Error ? e.message : undefined })
      } finally {
        setBusy(false)
      }
    },
  }
}

function ProposalRow({ n }: { n: Extract<Need, { kind: 'proposal' }> }) {
  const { agent } = useServices()
  const settle = useSettle()
  const p = n.item
  return (
    <>
      <Tile icon={Sparkles} tone="bg-primary/10 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{p.title}</p>
        {p.lines.length > 0 && <p className="line-clamp-2 text-xs text-muted-foreground">{p.lines.join(' · ')}</p>}
      </div>
      <div className="flex shrink-0 gap-1">
        <Button size="xs" disabled={settle.busy} onClick={() => void settle.run(() => agent.approveProposal(p.id), 'Saved')}>
          <Check /> Approve
        </Button>
        <Button variant="ghost" size="xs" disabled={settle.busy} onClick={() => void settle.run(() => agent.dropProposal(p.id), 'Dropped')}>
          Drop
        </Button>
      </div>
    </>
  )
}

function PlanRow({ n }: { n: Extract<Need, { kind: 'plan' }> }) {
  const { agent } = useServices()
  const settle = useSettle()
  const p = n.item
  return (
    <>
      <Tile icon={Sun} tone="bg-primary/10 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">Plan for {p.day}</p>
        <p className="line-clamp-2 text-xs text-muted-foreground">{p.card?.headline || p.briefing || `${p.blocks.length} items to put on your planner`}</p>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button size="xs" disabled={settle.busy} onClick={() => void settle.run(() => agent.applyDayPlan(p.id), 'Put on your planner')}>
          {settle.busy ? <Spinner size="xs" tone="current" decorative /> : <Check />} Put it on my planner
        </Button>
        <Button variant="ghost" size="xs" disabled={settle.busy} onClick={() => void settle.run(() => agent.dismissDayPlan(p.id), 'Dismissed')}>
          Not this
        </Button>
      </div>
    </>
  )
}
