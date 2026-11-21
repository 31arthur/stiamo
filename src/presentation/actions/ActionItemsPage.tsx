import { Fragment } from 'react'
import { CalendarClock, MessageCircle, CalendarPlus, Check, Gavel, ListChecks, Mail, Phone, Users, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { ActionItem } from '@/domain/ai/AgentApi'
import { WORKSPACES } from '@/domain/shared/workspace'
import type { WorkspaceId } from '@/domain/shared/workspace'
import { cn } from '@/lib/utils'
import { useDayPlans, useWaitingProposals } from '@/presentation/agents/useAgent'
import { useWorkspaceFilter } from '@/presentation/app/workspaceFilter'
import { PageHeader } from '@/presentation/components/layout'
import { WorkspaceBadge } from '@/presentation/components/workspace'
import { Link } from '@/presentation/routing'
import { PlanRow, ProposalRow } from '@/presentation/needs/NeedsPage'
import { GROUPS, useActionItems, useActOnItem } from './useActionItems'
import type { Group } from './useActionItems'

const META: Record<Group, { title: string; hint: string; tone: string }> = {
  late: { title: 'Late', hint: 'the day has passed', tone: 'text-destructive' },
  today: { title: 'Today', hint: 'on today’s list or due today', tone: '' },
  soon: { title: 'This week', hint: 'the next seven days', tone: '' },
  later: { title: 'Later', hint: 'further ahead', tone: 'text-muted-foreground' },
  unplaced: { title: 'No day yet', hint: 'not placed anywhere', tone: 'text-muted-foreground' },
}

const KIND: Record<string, { label: string; icon: LucideIcon }> = {
  task: { label: 'Task', icon: ListChecks },
  call: { label: 'Call', icon: Phone },
  message: { label: 'Message', icon: Mail },
  mail: { label: 'Mail', icon: Mail },
  meeting: { label: 'Meeting', icon: Users },
  hearing: { label: 'Hearing', icon: Gavel },
  event: { label: 'Event', icon: CalendarClock },
}

/** Every open action item, from every workspace, in one shape and one list: tasks, calls, messages, meetings, hearings, events and the mail that needs you. */
export function ActionItemsPage() {
  const { scope } = useWorkspaceFilter()
  const { items, groups, loading, error } = useActionItems()
  const proposals = useWaitingProposals().data ?? []
  const plans = (useDayPlans().data?.plans ?? []).filter((p) => p.status === 'proposed')
  const waiting = proposals.length + plans.length
  const total = items.length + waiting

  return (
    <>
      <PageHeader
        eyebrow={scope === 'all' ? 'All workspaces' : WORKSPACES[scope].name}
        title="Action items"
        description={total === 0 ? 'Nothing is open.' : `${items.length} open ${items.length === 1 ? 'item' : 'items'}${waiting ? `, and ${waiting} waiting for your yes` : ''}. The same list Chittu walks you through on Telegram.`}
      />
      {(scope === 'sb' || scope === 'all') && items.some((i) => i.kind === 'mail') && (
        <p className="mb-4 text-xs text-muted-foreground">
          Mail your agents flagged is in this list too.{' '}
          <Link to="/attention" className="font-medium text-foreground underline-offset-2 hover:underline">
            Review it one by one
          </Link>
        </p>
      )}
      {error && (
        <p role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
          {error}
        </p>
      )}
      {loading ? (
        <Spinner label="Loading" />
      ) : total === 0 ? (
        <div className="grid justify-items-center gap-3 rounded-2xl border border-dashed px-4 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-success/12 text-success">
            <Check className="size-5" />
          </span>
          <p className="font-display text-3xl">You’re clear</p>
          <p className="max-w-md text-sm text-muted-foreground">New items appear here the moment you or an agent adds one, or a mail needs you.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {waiting > 0 && (
            <section aria-label="Waiting for your yes" className="grid gap-2">
              <header className="flex items-baseline gap-2 px-1">
                <h2 className="text-sm font-semibold">Waiting for your yes</h2>
                <span className="text-xs text-muted-foreground tabular-nums">{waiting}</span>
                <span className="hidden text-xs text-muted-foreground sm:inline">· something an agent made is ready to save</span>
              </header>
              <ul className="grid divide-y overflow-hidden rounded-2xl border bg-card/80">
                {proposals.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-3.5 py-3">
                    <ProposalRow n={{ key: p.id, section: 'approve', kind: 'proposal', item: p }} />
                  </li>
                ))}
                {plans.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-3.5 py-3">
                    <PlanRow n={{ key: p.id, section: 'approve', kind: 'plan', item: p }} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {GROUPS.map((g) =>
            groups[g].length === 0 ? null : (
              <section key={g} aria-label={META[g].title} className="grid gap-2">
                <header className="flex items-baseline gap-2 px-1">
                  <h2 className={cn('text-sm font-semibold', META[g].tone)}>{META[g].title}</h2>
                  <span className="text-xs text-muted-foreground tabular-nums">{groups[g].length}</span>
                  <span className="hidden text-xs text-muted-foreground sm:inline">· {META[g].hint}</span>
                </header>
                <ul className="grid divide-y overflow-hidden rounded-2xl border bg-card/80">
                  {groups[g].map((i) => (
                    <li key={i.ref}>
                      <ItemRow item={i} />
                    </li>
                  ))}
                </ul>
              </section>
            ),
          )}
        </div>
      )}
    </>
  )
}

function ItemRow({ item: i }: { item: ActionItem }) {
  const { act, pending } = useActOnItem()
  const k = KIND[i.kind] ?? { label: i.kind, icon: CalendarPlus }
  const Icon = k.icon
  const changeable = !i.fixed && i.source !== 'google' && i.kind !== 'hearing'
  const when = [i.dayLabel ?? i.day, i.time, i.dueLabel && i.dueLabel !== i.dayLabel ? `due ${i.dueLabel}` : null].filter(Boolean).join(' · ')
  return (
    <div className="flex items-center gap-3 px-3.5 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-sm font-medium">
          {i.workspace in WORKSPACES && <WorkspaceBadge ws={i.workspace as WorkspaceId} />}
          <span className="truncate">{i.title}</span>
          {i.priority === 'urgent' || i.priority === 'high' ? <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">{i.priority}</span> : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          <Fragment>
            {k.label}
            {when && ` · ${when}`}
            {i.daysLate ? ` · ${i.daysLate} ${i.daysLate === 1 ? 'day' : 'days'} late` : ''}
            {i.contact && ` · ${i.contact}`}
            {i.case && ` · ${i.case}`}
          </Fragment>
        </p>
        {i.draft && <p className="mt-0.5 line-clamp-2 text-xs">{i.draft}</p>}
      </div>
      {changeable && (
        <div className="flex shrink-0 gap-1">
          {i.whatsapp && (
            <Button variant="outline" size="xs" onClick={() => window.open(i.whatsapp, '_blank', 'noopener')}>
              <MessageCircle /> Open WhatsApp
            </Button>
          )}
          <Button size="xs" disabled={pending} onClick={() => act({ ref: i.ref, action: 'complete' })}>
            <Check /> {i.whatsapp ? 'Sent' : 'Done'}
          </Button>
          <Button variant="outline" size="xs" disabled={pending} onClick={() => act({ ref: i.ref, action: 'move', to: 'tomorrow' })}>
            Tomorrow
          </Button>
          <Button variant="ghost" size="xs" aria-label={`Cancel ${i.title}`} disabled={pending} onClick={() => act({ ref: i.ref, action: 'cancel' })}>
            <X />
          </Button>
        </div>
      )}
    </div>
  )
}
