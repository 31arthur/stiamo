import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, MessageCircle, MousePointerClick, Pencil, Play, Reply, Trash2, UserPlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { CampaignDetail, CampaignMember, CampaignState } from '@/domain/ai/AgentApi'
import type { Contact } from '@/domain/contacts/Contacts'
import { cn } from '@/lib/utils'
import { useServices } from '@/presentation/app/services'
import { friendlyDate } from '@/presentation/components/dates'
import { PageHeader } from '@/presentation/components/layout'
import { useToday, useUserId } from '@/presentation/data/hooks'
import { toast } from '@/presentation/notifications/toast'
import { useNavigate } from '@/presentation/routing'
import { CampaignEditor } from './CampaignEditor'
import { ContactPicker } from './ContactPicker'
import { WhatsAppPreview } from './WhatsAppPreview'

const STATE: Record<CampaignState, { label: string; tone: string }> = {
  pending: { label: 'To send', tone: 'bg-muted text-muted-foreground' },
  sent: { label: 'Sent', tone: 'bg-primary/10 text-primary' },
  replied: { label: 'Replied', tone: 'bg-success/15 text-success' },
  declined: { label: 'Not interested', tone: 'bg-destructive/10 text-destructive' },
  skipped: { label: 'Skipped', tone: 'bg-muted text-muted-foreground' },
}

/** One campaign: how the message looks, who is in it, an Open WhatsApp button for each person, and how it went. */
export function CampaignPage() {
  const { id = '' } = useParams()
  const { agent } = useServices()
  const userId = useUserId()
  const client = useQueryClient()
  const navigate = useNavigate()
  const today = useToday()
  const [editing, setEditing] = useState(false)
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  const key = ['agent', 'campaigns', userId, id]
  const q = useQuery<CampaignDetail>({ queryKey: key, queryFn: () => agent.campaign(id), enabled: !!id, refetchInterval: 30_000, retry: false })
  const c = q.data

  const put = (d: CampaignDetail) => {
    client.setQueryData(key, d)
    void client.invalidateQueries({ queryKey: ['agent', 'campaigns', userId], exact: true })
  }
  async function run<T extends CampaignDetail>(go: () => Promise<T>, done?: (d: T) => string) {
    try {
      const d = await go()
      put(d)
      if (done) toast.success(done(d))
    } catch (e) {
      toast.error('Couldn’t do that', { description: e instanceof Error ? e.message : undefined })
    }
  }
  const mark = (m: CampaignMember, state: CampaignState) => run(() => agent.campaignMark(m.id, state))
  async function add(contacts: Contact[]) {
    setBusy(true)
    await run(() => agent.campaignAddContacts(id, contacts), (d) => `${d.added} added${d.alreadyIn ? `, ${d.alreadyIn} already in` : ''}`)
    setBusy(false)
    setPicking(false)
  }
  /** Opens the next person who still has to be sent to, and marks nothing: you mark it sent once you have pressed send. */
  const next = c?.members.find((m) => m.state === 'pending' && m.whatsapp)
  const open = (m: CampaignMember) => window.open(m.whatsapp, '_blank', 'noopener')

  if (q.isLoading) return <Spinner label="Loading" />
  if (!c)
    return (
      <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
        {q.error instanceof Error ? q.error.message : 'This campaign isn’t there.'}
      </p>
    )
  const n = c.counts
  const sample = c.members[0]?.name ?? 'Ali Hassan'

  return (
    <>
      <PageHeader
        eyebrow="Campaigns"
        title={c.name}
        description={`${n.total} ${n.total === 1 ? 'person' : 'people'} · ${n.sent + n.replied} sent · ${n.replied} replied${c.tracking ? ` · ${n.clicked} opened the link` : ''}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil /> Change
            </Button>
            <Button size="sm" onClick={() => setPicking(true)}>
              <UserPlus /> Add contacts
            </Button>
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-label="People" className="grid content-start gap-3">
          {next && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card/80 px-4 py-3">
              <span className="text-sm">
                {n.pending} still to send. Next: <strong>{next.name}</strong>
              </span>
              <Button size="sm" className="ml-auto" onClick={() => open(next)}>
                <Play /> Open next in WhatsApp
              </Button>
            </div>
          )}
          {c.members.length === 0 ? (
            <p className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">No one is in this campaign yet. Add contacts to begin.</p>
          ) : (
            <ul className="grid divide-y overflow-hidden rounded-2xl border bg-card/80">
              {c.members.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <span className="truncate">{m.name}</span>
                      <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium', STATE[m.state].tone)}>{STATE[m.state].label}</span>
                      {m.clicks > 0 && (
                        <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground" title="Opened the link">
                          <MousePointerClick className="size-3" /> {m.clicks}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {!m.phone ? 'No phone number' : m.repliedAt ? `Replied ${friendlyDate(m.repliedAt.slice(0, 10), today)}` : m.sentAt ? `Sent ${friendlyDate(m.sentAt.slice(0, 10), today)}` : 'Not sent yet'}
                      {m.note ? ` · ${m.note}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1">
                    {m.whatsapp && (
                      <Button variant={m.state === 'pending' ? 'default' : 'outline'} size="xs" onClick={() => open(m)}>
                        <MessageCircle /> Open WhatsApp
                      </Button>
                    )}
                    {m.state === 'pending' && m.whatsapp && (
                      <Button variant="outline" size="xs" onClick={() => void mark(m, 'sent')}>
                        <Check /> Sent
                      </Button>
                    )}
                    {(m.state === 'sent' || m.state === 'declined' || m.state === 'skipped') && (
                      <Button variant="outline" size="xs" onClick={() => void mark(m, 'replied')}>
                        <Reply /> Replied
                      </Button>
                    )}
                    {m.state === 'sent' && (
                      <Button variant="ghost" size="xs" onClick={() => void mark(m, 'declined')}>
                        Not interested
                      </Button>
                    )}
                    {m.state !== 'pending' && (
                      <Button variant="ghost" size="xs" onClick={() => void mark(m, 'pending')}>
                        Undo
                      </Button>
                    )}
                    {m.state === 'pending' && (
                      <Button variant="ghost" size="xs" aria-label={`Skip ${m.name}`} onClick={() => void mark(m, 'skipped')}>
                        <X />
                      </Button>
                    )}
                    <Button variant="ghost" size="xs" aria-label={`Take ${m.name} out`} onClick={() => void run(() => agent.campaignRemove(m.id))}>
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside aria-label="Preview" className="grid content-start gap-3">
          <WhatsAppPreview message={c.message} url={c.url} imageUrl={c.imageUrl} preview={c.preview} name={sample} />
          <div className="grid gap-2 text-xs text-muted-foreground">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={c.status === 'closed'}
                onChange={(e) => void run(() => agent.campaignSave(c.id, { name: c.name, message: c.message, url: c.url, image_url: c.imageUrl, track_clicks: c.trackClicks, status: e.target.checked ? 'closed' : 'active' }))}
                className="size-4 accent-[var(--foreground)]"
              />
              Close this campaign
            </label>
            <button
              type="button"
              className="w-fit text-destructive hover:underline"
              onClick={() => {
                if (window.confirm(`Delete “${c.name}” and its list? This can’t be undone.`)) void agent.campaignDelete(c.id).then(() => (void client.invalidateQueries({ queryKey: ['agent', 'campaigns'] }), navigate('/campaigns')))
              }}
            >
              Delete the campaign
            </button>
          </div>
        </aside>
      </div>
      <CampaignEditor open={editing} campaign={c} onClose={() => setEditing(false)} onSaved={() => void client.invalidateQueries({ queryKey: key })} />
      <ContactPicker open={picking} onClose={() => setPicking(false)} onAdd={(list) => void add(list)} busy={busy} />
    </>
  )
}
