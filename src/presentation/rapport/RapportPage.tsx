import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { HeartHandshake, MessagesSquare, Pause, Pencil, Search, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import type { RapportPlan } from '@/domain/ai/AgentApi'
import type { Contact } from '@/domain/contacts/Contacts'
import { WORKSPACES } from '@/domain/shared/workspace'
import type { WorkspaceId } from '@/domain/shared/workspace'
import { cn } from '@/lib/utils'
import { useAgentAvailable } from '@/presentation/agents/useAgent'
import { useServices } from '@/presentation/app/services'
import { useWorkspaceFilter } from '@/presentation/app/workspaceFilter'
import { friendlyDate } from '@/presentation/components/dates'
import { PageHeader } from '@/presentation/components/layout'
import { WorkspaceBadge } from '@/presentation/components/workspace'
import { useToday, useUserId } from '@/presentation/data/hooks'
import { toast } from '@/presentation/notifications/toast'
import { RapportAdvisorSheet } from './RapportAdvisorSheet'
import { ContactTagsSheet } from '@/presentation/contacts/ContactTagsSheet'
import { useNavigate } from '@/presentation/routing'

const TIERS = ['A', 'B', 'C'] as const

/** The get-to-know plans Chittu keeps for new contacts: who, how close, what went out, what is next. */
export function RapportPage() {
  const { agent, contacts } = useServices()
  const [tagging, setTagging] = useState<Contact | null>(null)
  const [advising, setAdvising] = useState<RapportPlan | null>(null)
  const userId = useUserId()
  const client = useQueryClient()
  const available = useAgentAvailable()
  const { matches } = useWorkspaceFilter()
  const today = useToday()
  const navigate = useNavigate()
  const q = useQuery({ queryKey: ['agent', 'rapport', userId], queryFn: () => agent.rapport(), enabled: available, staleTime: 15_000, refetchInterval: 60_000, retry: false })
  const everyone = (q.data?.plans ?? []).filter((p) => matches((p.workspace ?? undefined) as WorkspaceId | undefined))
  const [typed, setTyped] = useState('')
  const [state, setState] = useState('all')
  const plain = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const words = plain(typed).split(/\s+/).filter(Boolean)
  const plans = everyone.filter((p) => {
    if (state === 'paused' ? !p.pausedUntil : state === 'active' ? p.status !== 'active' || !!p.pausedUntil : state !== 'all' && p.status !== state) return false
    const hay = plain([p.name, p.workspace, p.zone, p.tier && `tier ${p.tier}`, p.next?.purpose, p.status === 'needs_info' ? 'needs details' : p.status, ...(p.missing ?? [])].filter(Boolean).join(' '))
    return words.every((w) => hay.includes(w))
  })
  const status = q.data?.status

  async function change(p: RapportPlan, action: 'pause' | 'exclude' | 'tier', tier?: string) {
    try {
      toast.success(await agent.rapportDo(p.id, action, tier))
      await client.invalidateQueries({ queryKey: ['agent', 'rapport'] })
    } catch (e) {
      toast.error('Couldn’t do that', { description: e instanceof Error ? e.message : undefined })
    }
  }

  async function fill(p: RapportPlan) {
    try {
      const found = (await contacts.list('all', p.name, 20)).items.find((c) => c.id === p.contactId) ?? null
      if (found) setTagging(found)
      else toast.error('Couldn’t find that contact', { description: 'Open it from Contacts.' })
    } catch (e) {
      toast.error('Couldn’t open that contact', { description: e instanceof Error ? e.message : undefined })
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Relationships"
        title="Rapport"
        description="Every new contact gets a short, spaced plan of friendly messages: close at first, less often as time goes on. Each message comes to you inside your 10:00–15:00 window, with a button that opens that person’s WhatsApp chat with the text ready. A plan starts once a contact’s tags and place are filled in."
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate('/contacts')}>
            Contacts
          </Button>
        }
      />
      {!available ? (
        <p className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Rapport plans need the Stiamo backend.</p>
      ) : q.isLoading ? (
        <Spinner label="Loading" />
      ) : q.error ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
          {q.error instanceof Error ? q.error.message : 'Couldn’t load the plans'}
        </p>
      ) : everyone.length === 0 ? (
        <div className="grid justify-items-center gap-3 rounded-2xl border border-dashed px-4 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-muted">
            <HeartHandshake className="size-5" />
          </span>
          <p className="font-medium">No plans yet</p>
          <p className="max-w-md text-sm text-muted-foreground">When a new Google contact appears, Chittu builds a plan for them here. You can switch it off for anyone, or bring an older contact in, from Contacts.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {status && (
            <p className="text-xs text-muted-foreground">
              {status.needsInfo ? `${status.needsInfo} need details · ` : ''}{status.active} active · {status.paused} paused · {status.excluded} without a plan
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative block w-full sm:max-w-sm">
              <span className="sr-only">Search the plans</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Search by name, country, zone, tier or what is next" className="pl-9" />
            </label>
            <select value={state} onChange={(e) => setState(e.target.value)} className="h-8 rounded-md border bg-transparent px-2 text-xs" aria-label="Show">
              <option value="all">All</option>
              <option value="needs_info">Need details</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="excluded">Without a plan</option>
            </select>
            <span className="text-xs text-muted-foreground tabular-nums">
              {plans.length === everyone.length ? `${everyone.length} plans` : `${plans.length} of ${everyone.length}`}
            </span>
          </div>
          {plans.length === 0 && <p className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">{typed.trim() ? `No plan matches “${typed.trim()}”.` : 'No plan is in that state.'}</p>}
          <ul className={cn('grid divide-y overflow-hidden rounded-2xl border bg-card/80', plans.length === 0 && 'hidden')}>
            {plans.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm font-medium">
                    {p.workspace && p.workspace in WORKSPACES && <WorkspaceBadge ws={p.workspace as WorkspaceId} />}
                    <span className="truncate">{p.name}</span>
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium', p.status === 'active' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>{p.pausedUntil ? 'paused' : p.status === 'needs_info' ? 'needs details' : p.status}</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.status === 'needs_info' ? `Add their ${(p.missing ?? []).join(' and ') || 'details'} and the plan starts` : `${p.sent} sent · ${p.planned} to come`}
                    {p.next ? ` · next ${friendlyDate(p.next.day, today)}: ${p.next.purpose}` : ''}
                    {p.unanswered > 0 ? ` · ${p.unanswered} unanswered` : ''}
                    {p.zone ? ` · ${p.zone}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="outline" size="xs" onClick={() => setAdvising(p)}>
                    <MessagesSquare /> Adviser
                  </Button>
                  {p.status === 'needs_info' && (
                    <Button size="xs" onClick={() => void fill(p)}>
                      <Pencil /> Fill in
                    </Button>
                  )}
                  {p.status !== 'needs_info' && TIERS.map((t) => (
                    <Button key={t} variant={p.tier === t ? 'default' : 'outline'} size="xs" aria-label={`Tier ${t}`} aria-pressed={p.tier === t} onClick={() => p.tier !== t && void change(p, 'tier', t)}>
                      {t}
                    </Button>
                  ))}
                  {p.status === 'active' && !p.pausedUntil && (
                    <Button variant="ghost" size="xs" onClick={() => void change(p, 'pause')}>
                      <Pause /> Pause
                    </Button>
                  )}
                  {p.status !== 'excluded' && (
                    <Button variant="ghost" size="xs" onClick={() => void change(p, 'exclude')}>
                      <UserX /> No plan
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ContactTagsSheet contact={tagging} onClose={() => setTagging(null)} />
      <RapportAdvisorSheet plan={advising} onClose={() => setAdvising(null)} />
    </>
  )
}
