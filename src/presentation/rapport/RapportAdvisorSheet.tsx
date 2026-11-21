import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, MessageCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import type { RapportDetail, RapportPersona, RapportPlan, RapportSuggestion } from '@/domain/ai/AgentApi'
import { cn } from '@/lib/utils'
import { useServices } from '@/presentation/app/services'
import { toast } from '@/presentation/notifications/toast'
import { useUserId } from '@/presentation/data/hooks'

const STAGE: Record<string, string> = { new: 'New', in_touch: 'In touch', warm: 'Warm', dormant: 'Gone quiet' }

/**
 * The adviser for one contact. Tell it what has happened (what you already sent, a call, a favour, what you have in common) or ask what to do: it answers, offers messages
 * you can open in WhatsApp, and keeps a persona of the person that every later message is written from.
 */
export function RapportAdvisorSheet({ plan, onClose }: { plan: RapportPlan | null; onClose: () => void }) {
  const { agent } = useServices()
  const userId = useUserId()
  const client = useQueryClient()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [tier, setTier] = useState<string | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const key = ['agent', 'rapport', userId, 'detail', plan?.id]
  const q = useQuery<RapportDetail>({ queryKey: key, queryFn: () => agent.rapportDetail(plan!.id), enabled: !!plan, retry: false })
  const d = q.data

  useEffect(() => {
    setText('')
    setTier(null)
  }, [plan?.id])
  useEffect(() => {
    // (a block, so nothing is returned: React would take a returned value for a clean-up function and call it)
    end.current?.scrollIntoView({ block: 'end' })
  }, [d?.notes.length])

  async function ask() {
    if (!plan || !text.trim() || busy) return
    setBusy(true)
    try {
      const a = await agent.rapportAdvise(plan.id, text.trim())
      client.setQueryData(key, a)
      setTier(a.suggestedTier)
      setText('')
      if (a.introductionsChanged) toast.success('Noted', { description: 'The plan will follow up instead of introducing you again.' })
      await client.invalidateQueries({ queryKey: ['agent', 'rapport', userId], exact: true })
    } catch (e) {
      toast.error('Couldn’t get advice', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  async function useTier(t: string) {
    if (!plan) return
    try {
      toast.success(await agent.rapportDo(plan.id, 'tier', t))
      setTier(null)
      await client.invalidateQueries({ queryKey: ['agent', 'rapport'] })
    } catch (e) {
      toast.error('Couldn’t change the tier', { description: e instanceof Error ? e.message : undefined })
    }
  }

  return (
    <Sheet open={!!plan} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="gap-0 p-0 data-[side=right]:w-[min(96vw,40rem)] data-[side=right]:sm:max-w-none">
        <SheetHeader className="border-b px-5 py-4 pr-12">
          <SheetTitle className="font-display text-2xl font-normal">{plan?.name}</SheetTitle>
          <SheetDescription className="text-xs">
            Tell me what has happened with them (what you already sent, calls, favours, what you share) or ask what to do. What you tell me is kept and used to write every message to them.
          </SheetDescription>
        </SheetHeader>
        <div className="grid min-h-0 flex-1 grid-rows-[1fr_auto]">
          <div className="min-h-0 overflow-y-auto px-5 py-4">
            {q.isLoading ? (
              <Spinner label="Loading" />
            ) : d ? (
              <div className="grid gap-4">
                <Persona p={d.persona} tier={d.tier} />
                {d.notes.length === 0 ? (
                  <p className="rounded-xl border border-dashed px-3.5 py-6 text-center text-sm text-muted-foreground">
                    Nothing told yet. For example: “I messaged him on 3 Nov about the wage claim, he read it and didn’t answer. We met at the Doha conference. He prefers Hindi.”
                  </p>
                ) : (
                  <ul className="grid gap-2.5">
                    {d.notes.map((n, i) => (
                      <li key={i} className={cn('max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap', n.by === 'owner' ? 'justify-self-end bg-primary/10' : 'justify-self-start bg-muted')}>
                        {n.text}
                      </li>
                    ))}
                  </ul>
                )}
                {tier && tier !== d.tier && (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card/80 px-3.5 py-2.5 text-sm">
                    <span>I’d keep in touch more {tier === 'A' ? 'closely' : tier === 'C' ? 'lightly' : 'usually'}: tier {tier}.</span>
                    <Button size="xs" onClick={() => void useTier(tier)}>
                      Use tier {tier}
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => setTier(null)}>
                      Not now
                    </Button>
                  </div>
                )}
                {d.suggestions.length > 0 && (
                  <section aria-label="Messages to send" className="grid gap-2">
                    <h3 className="px-1 text-xs font-semibold text-muted-foreground">Ready to send</h3>
                    {d.suggestions.map((s, i) => (
                      <Suggestion key={i} s={s} />
                    ))}
                  </section>
                )}
                <div ref={end} />
              </div>
            ) : (
              <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
                {q.error instanceof Error ? q.error.message : 'Couldn’t load this contact'}
              </p>
            )}
          </div>
          <div className="grid gap-2 border-t px-5 py-3">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={4000} placeholder="What happened, or what you want to know…" onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && void ask()} />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">Ctrl/⌘ + Enter to send</span>
              <Button size="sm" disabled={busy || !text.trim()} onClick={() => void ask()}>
                {busy ? <Spinner size="xs" tone="current" decorative /> : <Send />} Ask
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Persona({ p, tier }: { p: RapportPersona; tier: string | null }) {
  const has = p.summary || p.history?.length || p.common?.length || p.style || p.avoid?.length || p.next?.idea
  if (!has) return null
  return (
    <section aria-label="What I know about them" className="grid gap-2 rounded-2xl border bg-card/80 p-4 text-sm">
      <header className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">What I know about them</h3>
        {p.stage && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">{STAGE[p.stage] ?? p.stage}</span>}
        {tier && <span className="ml-auto text-xs text-muted-foreground">Tier {tier}</span>}
      </header>
      {p.summary && <p>{p.summary}</p>}
      <Facts label="What has happened" rows={p.history} />
      <Facts label="In common" rows={p.common} />
      {p.style && <p className="text-xs text-muted-foreground">How to write to them: {p.style}</p>}
      <Facts label="Avoid" rows={p.avoid} />
      {p.next?.idea && (
        <p className="rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs">
          <span className="font-medium">Next: </span>
          {p.next.idea}
        </p>
      )}
    </section>
  )
}

function Facts({ label, rows }: { label: string; rows?: string[] }) {
  if (!rows?.length) return null
  return (
    <div>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <ul className="mt-0.5 grid gap-0.5 text-xs">
        {rows.map((r, i) => (
          <li key={i}>· {r}</li>
        ))}
      </ul>
    </div>
  )
}

function Suggestion({ s }: { s: RapportSuggestion }) {
  return (
    <article className="grid gap-2 rounded-2xl border bg-card/80 p-3.5">
      <p className="text-[11px] font-medium text-muted-foreground">{s.purpose.replace('_', ' ')}</p>
      <p className="text-sm whitespace-pre-wrap">{s.message}</p>
      <div className="flex gap-1.5">
        {s.whatsapp && (
          <Button size="xs" onClick={() => window.open(s.whatsapp, '_blank', 'noopener')}>
            <MessageCircle /> Open WhatsApp
          </Button>
        )}
        <Button
          size="xs"
          variant="outline"
          onClick={() => void navigator.clipboard.writeText(s.message).then(() => toast.success('Copied'), () => toast.error('Couldn’t copy'))}
        >
          <Copy /> Copy
        </Button>
      </div>
    </article>
  )
}
