import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Megaphone, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { Campaign } from '@/domain/ai/AgentApi'
import { useAgentAvailable } from '@/presentation/agents/useAgent'
import { useServices } from '@/presentation/app/services'
import { PageHeader } from '@/presentation/components/layout'
import { useUserId } from '@/presentation/data/hooks'
import { Link, useNavigate } from '@/presentation/routing'
import { CampaignEditor } from './CampaignEditor'

/** Campaigns: one message, link or picture for many contacts, and how each one went. */
export function CampaignsPage() {
  const { agent } = useServices()
  const userId = useUserId()
  const available = useAgentAvailable()
  const navigate = useNavigate()
  const [making, setMaking] = useState(false)
  const q = useQuery<Campaign[]>({ queryKey: ['agent', 'campaigns', userId], queryFn: () => agent.campaigns(), enabled: available, staleTime: 15_000, retry: false })

  return (
    <>
      <PageHeader
        eyebrow="Relationships"
        title="Campaigns"
        description="Send the same message, link or picture to many contacts, and see who got it, who answered and who opened the link."
        actions={
          available && (
            <Button size="sm" onClick={() => setMaking(true)}>
              <Plus /> New campaign
            </Button>
          )
        }
      />
      {!available ? (
        <p className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Campaigns need the Stiamo backend.</p>
      ) : q.isLoading ? (
        <Spinner label="Loading" />
      ) : q.error ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
          {q.error instanceof Error ? q.error.message : 'Couldn’t load the campaigns'}
        </p>
      ) : (q.data ?? []).length === 0 ? (
        <div className="grid justify-items-center gap-3 rounded-2xl border border-dashed px-4 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-muted">
            <Megaphone className="size-5" />
          </span>
          <p className="font-medium">No campaigns yet</p>
          <p className="max-w-md text-sm text-muted-foreground">Write a message, add a link, see how it will look in WhatsApp, then add the contacts you want to reach.</p>
          <Button onClick={() => setMaking(true)}>
            <Plus /> New campaign
          </Button>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {(q.data ?? []).map((c) => (
            <li key={c.id}>
              <Link to={`/campaigns/${c.id}`} className="grid gap-2 rounded-2xl border bg-card/80 p-4 transition-colors hover:bg-muted/40">
                <div className="flex items-center gap-2">
                  <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{c.name}</h3>
                  {c.status === 'closed' && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">closed</span>}
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">{c.preview.title || c.message || c.url}</p>
                <p className="text-xs tabular-nums">
                  {c.counts.total} {c.counts.total === 1 ? 'person' : 'people'} · {c.counts.sent + c.counts.replied} sent · {c.counts.replied} replied
                  {c.tracking ? ` · ${c.counts.clicked} opened` : ''}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <CampaignEditor open={making} campaign={null} onClose={() => setMaking(false)} onSaved={(id) => navigate(`/campaigns/${id}`)} />
    </>
  )
}
