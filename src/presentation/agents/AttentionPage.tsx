import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, CalendarPlus, Check, Eye, Inbox, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import type { AttentionEvent, AttentionItem, ExecutionItem } from '@/domain/ai/AgentApi'
import { WORKSPACES } from '@/domain/shared/workspace'
import { cn } from '@/lib/utils'
import { useServices } from '@/presentation/app/services'
import { useScope } from '@/presentation/app/workspaceFilter'
import { DateInput } from '@/presentation/components/form'
import { EmptyState, PageHeader } from '@/presentation/components/layout'
import { useUserId } from '@/presentation/data/hooks'
import { toast } from '@/presentation/notifications/toast'
import { Link } from '@/presentation/routing'
import { EmailPreview } from './EmailPreview'
import { parseMail } from './executions'
import { ago } from './format'
import { useAgentAttention } from './useAgent'

const PRIORITY: Record<string, { text: string; tone: string }> = {
  high: { text: 'High', tone: 'bg-destructive/10 text-destructive' },
  normal: { text: 'Normal', tone: 'bg-muted text-muted-foreground' },
  low: { text: 'Low', tone: 'bg-muted text-muted-foreground' },
}

const asExecutionItem = (i: AttentionItem): ExecutionItem => ({ id: i.itemId, title: i.title, excerpt: i.excerpt, label: i.label, confidence: i.confidence, reason: '', status: 'queued', at: i.at, decidedAt: null })

/** What the agents found that needs you: issues and important mail, and events waiting to go in the calendar. */
export function AttentionPage() {
  const scope = useScope()
  const here = scope === 'all' ? null : WORKSPACES[scope]
  const { data, isLoading, error } = useAgentAttention(scope === 'all' ? undefined : scope)
  const [preview, setPreview] = useState<AttentionItem | null>(null)
  const items = data?.items ?? []
  const events = items.filter((i) => i.status === 'event_proposed')
  const rest = items.filter((i) => i.status !== 'event_proposed')

  return (
    <>
      <PageHeader
        eyebrow={here ? here.name : 'All workspaces'}
        title="Attention"
        description="The emails your agents read and found worth your time: problems, important messages, and meetings or events they could add to your calendar. Nothing is added until you say so."
      />
      {isLoading ? (
        <Spinner label="Loading" />
      ) : error ? (
        <p role="alert" className="text-sm text-destructive">{error instanceof Error ? error.message : 'Couldn’t load the queue.'}</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed">
          <EmptyState
            title="Nothing needs you"
            action={
              <Button variant="outline" nativeButton={false} render={<Link to="/agents/new" />}>
                <Inbox /> Set up a mail agent
              </Button>
            }
          >
            When an agent reads your mail and finds a problem, something important, or a meeting with a date, it appears here.
          </EmptyState>
        </div>
      ) : (
        <div className="grid gap-6">
          {events.length > 0 && (
            <Group title="Events to approve" count={events.length}>
              <AnimatePresence initial={false}>
                {events.map((i) => (
                  <Card key={`${i.agentId}/${i.itemId}`} item={i} onPreview={() => setPreview(i)} />
                ))}
              </AnimatePresence>
            </Group>
          )}
          {rest.length > 0 && (
            <Group title="Needs you" count={rest.length}>
              <AnimatePresence initial={false}>
                {rest.map((i) => (
                  <Card key={`${i.agentId}/${i.itemId}`} item={i} onPreview={() => setPreview(i)} />
                ))}
              </AnimatePresence>
            </Group>
          )}
        </div>
      )}
      <EmailPreview item={preview ? asExecutionItem(preview) : null} folder={preview?.folder ?? 'INBOX'} trashed={false} onClose={() => setPreview(null)} />
    </>
  )
}

function Group({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">
        {title} <span className="font-normal text-muted-foreground tabular-nums">{count}</span>
      </h2>
      <ul className="grid gap-3">{children}</ul>
    </section>
  )
}

/** Acting on an item: it leaves the list at once, the server is told in the background, and a toast says how it went. */
function useAct() {
  const { agent } = useServices()
  const client = useQueryClient()
  const userId = useUserId()
  return async (item: AttentionItem, action: 'done' | 'dismiss' | 'approve_event' | 'skip_event', event?: AttentionEvent) => {
    const key = ['agent', 'attention', userId]
    const before = client.getQueriesData<{ items: AttentionItem[]; count: number }>({ queryKey: key })
    const same = (i: AttentionItem) => i.agentId === item.agentId && i.itemId === item.itemId
    client.setQueriesData<{ items: AttentionItem[]; count: number }>({ queryKey: key }, (d) => {
      if (!d) return d
      const items = action === 'skip_event' ? d.items.map((i) => (same(i) ? { ...i, status: 'queued' as const, event: null } : i)) : d.items.filter((i) => !same(i))
      return { ...d, items, count: items.length }
    })
    const pending = toast.loading(action === 'approve_event' ? 'Adding it to your calendar…' : 'Saving…')
    try {
      await agent.actOnAttention({ agentId: item.agentId, itemId: item.itemId, action, event })
      toast.success(action === 'approve_event' ? 'Added to your calendar' : action === 'done' ? 'Marked as done' : action === 'dismiss' ? 'Marked as not important' : 'Kept without the event', {
        id: pending,
        description: action === 'approve_event' && event ? `${event.title}, ${event.date}${event.start ? ` at ${event.start}` : ''}` : undefined,
      })
    } catch (e) {
      for (const [k, d] of before) client.setQueryData(k, d)
      toast.error('Couldn’t save that. It is back in the list.', { id: pending, description: e instanceof Error ? e.message : undefined })
    } finally {
      void client.invalidateQueries({ queryKey: key })
      if (action === 'approve_event') for (const k of ['meetings', 'calendar']) void client.invalidateQueries({ queryKey: [k] })
    }
  }
}

function Card({ item, onPreview }: { item: AttentionItem; onPreview: () => void }) {
  const act = useAct()
  const mail = parseMail(item.excerpt)
  const p = PRIORITY[item.priority] ?? PRIORITY.normal
  return (
    <motion.li layout="position" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, height: 0, x: 24 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
      <article className={cn('grid gap-3 rounded-2xl border bg-card/80 p-4', item.priority === 'high' && 'border-destructive/30')}>
        <header className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium">{item.label ?? 'mail'}</span>
          <span className={cn('rounded-full px-2 py-0.5 font-medium', p.tone)}>{p.text}</span>
          {item.due && <span className="text-muted-foreground">Due {item.due}</span>}
          <span className="ml-auto text-muted-foreground">
            {item.agentName}
            {item.at ? ` · ${ago(item.at)}` : ''}
          </span>
        </header>
        <div className="min-w-0">
          <h3 className="font-semibold break-words">{mail.subject || item.title}</h3>
          <p className="truncate text-xs text-muted-foreground">From {mail.sender || 'an unknown sender'}</p>
          <p className="mt-2 text-sm break-words">{item.summary}</p>
          {item.action && (
            <p className="mt-1.5 flex items-start gap-1.5 text-sm text-muted-foreground">
              <ArrowRight className="mt-0.5 size-3.5 shrink-0" />
              {item.action}
            </p>
          )}
          {item.note && <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>}
        </div>
        {item.event && <EventEditor key={JSON.stringify(item.event)} event={item.event} onApprove={(e) => void act(item, 'approve_event', e)} onSkip={() => void act(item, 'skip_event')} />}
        <footer className="flex flex-wrap items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={onPreview}>
            <Eye /> Read the email
          </Button>
          <span className="flex-1" />
          <Button variant="ghost" size="sm" onClick={() => void act(item, 'dismiss')}>
            <X /> Not important
          </Button>
          <Button variant="outline" size="sm" onClick={() => void act(item, 'done')}>
            <Check /> Done
          </Button>
        </footer>
      </article>
    </motion.li>
  )
}

const MODES = [
  { value: 'in_person', label: 'In person' },
  { value: 'virtual', label: 'Virtual' },
  { value: 'phone', label: 'Phone' },
]

/** The event the agent found, to check and change before it goes in the calendar. A time the email didn't give is left for you to set. */
function EventEditor({ event, onApprove, onSkip }: { event: AttentionEvent; onApprove: (e: AttentionEvent) => void; onSkip: () => void }) {
  const [e, setE] = useState<AttentionEvent>(event)
  const set = (p: Partial<AttentionEvent>) => setE((x) => ({ ...x, ...p }))
  const noTime = !event.start
  return (
    <div className="grid gap-3 rounded-xl border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <CalendarPlus className="size-4" /> Add to your calendar?
      </div>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_7rem_6rem]">
        <Input aria-label="Event title" value={e.title} onChange={(ev) => set({ title: ev.target.value })} maxLength={150} className="h-8 sm:col-span-1" />
        <DateInput value={e.date} onChange={(d) => d && set({ date: d })} aria-label="Date" />
        <Input aria-label="Start time" type="time" value={e.start ?? ''} onChange={(ev) => set({ start: ev.target.value || null })} className="h-8" />
        <Input aria-label="Minutes" type="number" min={5} max={1440} value={e.durationMinutes ?? (e.start && e.end ? '' : 60)} placeholder="min" onChange={(ev) => set({ durationMinutes: ev.target.value ? Number(ev.target.value) : null, end: null })} className="h-8" />
      </div>
      <div className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)]">
        <select aria-label="Mode" value={e.mode} onChange={(ev) => set({ mode: ev.target.value as AttentionEvent['mode'] })} className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30">
          {MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <Input aria-label="Where" value={e.location ?? e.link ?? ''} onChange={(ev) => (ev.target.value.startsWith('http') ? set({ link: ev.target.value, location: null }) : set({ location: ev.target.value || null, link: null }))} placeholder="Place or link" className="h-8" />
      </div>
      {noTime && <p className="text-xs text-warning">The email doesn’t give a time. Set one, or it is added at 09:00 for an hour.</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onSkip}>
          Not an event
        </Button>
        <Button size="sm" onClick={() => onApprove(e)} disabled={!e.title.trim() || !e.date}>
          <CalendarPlus /> Add to calendar
        </Button>
      </div>
    </div>
  )
}
