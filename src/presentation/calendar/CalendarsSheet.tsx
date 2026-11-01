import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Plus, RefreshCw, Send, Unplug } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import type { CalendarAccount, CalendarSource } from '@/domain/calendar/GoogleCalendar'
import { WORKSPACE_IDS, WORKSPACES } from '@/domain/shared/workspace'
import type { WorkspaceId } from '@/domain/shared/workspace'
import { cn } from '@/lib/utils'
import { useServices } from '@/presentation/app/services'
import { ConfirmDelete } from '@/presentation/components/confirm'
import { WorkspaceDot } from '@/presentation/components/workspace'
import { useUserId } from '@/presentation/data/hooks'
import { toast } from '@/presentation/notifications/toast'
import { ago } from '@/presentation/agents/format'
import { useCalendarStatus, useCalendarSync } from './useGoogleCalendar'

const SWATCHES = ['#4285F4', '#0F9D58', '#F4B400', '#DB4437', '#8E5CE6', '#00ACC1', '#F06292', '#8D6E63']

/** The Google calendars you have connected, per workspace: show or hide each, colour it, choose where meetings and hearings are sent. */
export function CalendarsSheet({ open, onOpenChange, scope }: { open: boolean; onOpenChange: (open: boolean) => void; scope: WorkspaceId | 'all' }) {
  const { calendar } = useServices()
  const client = useQueryClient()
  const userId = useUserId()
  const { data, isLoading, error } = useCalendarStatus()
  const { sync, syncing } = useCalendarSync()
  const [connecting, setConnecting] = useState<WorkspaceId | null>(null)

  const refresh = () => client.invalidateQueries({ queryKey: ['calendar', userId] })

  async function connect(workspace: WorkspaceId) {
    setConnecting(workspace)
    try {
      const { url } = await calendar.start(workspace)
      window.location.assign(url)
    } catch (e) {
      setConnecting(null)
      toast.error('Couldn’t start connecting', { description: e instanceof Error ? e.message : undefined })
    }
  }

  async function change(id: string, changes: { enabled?: boolean; export?: boolean; color?: string }) {
    try {
      await calendar.setSource(id, changes)
      await refresh()
    } catch (e) {
      toast.error('Couldn’t change that', { description: e instanceof Error ? e.message : undefined })
    }
  }

  async function syncNow() {
    try {
      const r = await sync()
      const sent = r.sent.added + r.sent.changed + r.sent.removed
      if (r.errors.length) toast.warning('Read with problems', { description: r.errors[0] })
      else toast.success('Calendars up to date', { description: `${r.pulled} events read${sent ? `, ${sent} sent to Google` : ''}.` })
    } catch (e) {
      toast.error('Couldn’t read the calendars', { description: e instanceof Error ? e.message : undefined })
    }
  }

  const order = scope === 'all' ? WORKSPACE_IDS : [scope, ...WORKSPACE_IDS.filter((w) => w !== scope)]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="gap-0 p-0 data-[side=right]:w-[min(96vw,38rem)] data-[side=right]:sm:max-w-none">
        <SheetHeader className="border-b px-5 py-4 pr-12">
          <SheetTitle className="font-display text-2xl font-normal">Google calendars</SheetTitle>
          <SheetDescription className="text-xs">Connect an account to a workspace. Each workspace shows its own; All workspaces shows them together, in their own colours.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <Spinner label="Loading" />
          ) : error || !data ? (
            <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <span>The calendar service isn’t reachable yet. It needs to be deployed on the server first (docs/CALENDAR_SETUP.md).</span>
            </p>
          ) : (
            <div className="grid gap-5">
              {!data.configured && (
                <p className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">Google isn’t set up on the server yet: it needs the OAuth client from Google Cloud before an account can be connected (docs/CALENDAR_SETUP.md).</p>
              )}
              {order.map((ws) => {
                const accounts = data.accounts.filter((a) => a.workspace === ws)
                return (
                  <section key={ws} aria-label={WORKSPACES[ws].name} className="grid gap-2">
                    <header className="flex items-center gap-2">
                      <WorkspaceDot ws={ws} />
                      <h3 className="text-sm font-semibold">{WORKSPACES[ws].name}</h3>
                      <Button variant="ghost" size="xs" className="ml-auto" disabled={!data.configured || connecting !== null} onClick={() => void connect(ws)}>
                        {connecting === ws ? <Spinner size="xs" tone="current" decorative /> : <Plus />} Connect a Google account
                      </Button>
                    </header>
                    {accounts.length === 0 ? <p className="rounded-xl border border-dashed px-3 py-3 text-xs text-muted-foreground">No Google account connected to {WORKSPACES[ws].short}.</p> : accounts.map((a) => <AccountCard key={a.id} account={a} sends={data.sends} onChange={change} onDisconnect={async () => (await calendar.disconnect(a.id), await refresh())} onReconnect={() => void connect(a.workspace)} />)}
                  </section>
                )
              })}
            </div>
          )}
        </div>
        {data && data.accounts.length > 0 && (
          <footer className="flex items-center gap-3 border-t px-5 py-3">
            <Button size="sm" variant="outline" onClick={() => void syncNow()} disabled={syncing}>
              {syncing ? <Spinner size="xs" tone="current" decorative /> : <RefreshCw />} Sync now
            </Button>
            <span className="text-xs text-muted-foreground">Read every 5 minutes, and whenever you open the calendar. Times shown in {data.timezone}.</span>
          </footer>
        )}
      </SheetContent>
    </Sheet>
  )
}

function AccountCard({ account: a, sends, onChange, onDisconnect, onReconnect }: { account: CalendarAccount; sends: boolean; onChange: (id: string, c: { enabled?: boolean; export?: boolean; color?: string }) => void; onDisconnect: () => Promise<unknown>; onReconnect: () => void }) {
  return (
    <article className="overflow-hidden rounded-xl border bg-card/80">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.email}</span>
        {a.lastSyncAt && a.status === 'ok' && <span className="hidden text-[11px] text-muted-foreground sm:inline">read {ago(a.lastSyncAt)}</span>}
        <ConfirmDelete verb="Disconnect" what={a.email} note="Its events are forgotten here. Nothing changes in Google." onConfirm={onDisconnect}>
          <Unplug /> Disconnect
        </ConfirmDelete>
      </header>
      {a.status === 'reconnect' && (
        <p role="alert" className="flex flex-wrap items-center gap-2 border-b bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="size-3.5 shrink-0" /> {a.error || 'Google no longer allows this.'}
          <Button size="xs" variant="outline" className="ml-auto" onClick={onReconnect}>
            Connect again
          </Button>
        </p>
      )}
      {a.status === 'ok' && a.error && <p className="border-b px-3 py-1.5 text-xs text-muted-foreground">{a.error}</p>}
      <ul className="divide-y">
        {a.calendars.map((c) => (
          <CalendarRow key={c.id} source={c} sends={sends} onChange={onChange} />
        ))}
        {a.calendars.length === 0 && <li className="px-3 py-2 text-xs text-muted-foreground">No calendars found in this account yet.</li>}
      </ul>
    </article>
  )
}

function CalendarRow({ source: c, sends, onChange }: { source: CalendarSource; sends: boolean; onChange: (id: string, c: { enabled?: boolean; export?: boolean; color?: string }) => void }) {
  const [picking, setPicking] = useState(false)
  return (
    <li className="grid gap-1.5 px-3 py-2">
      <div className="flex items-center gap-2.5">
        <input type="checkbox" aria-label={`Show ${c.name}`} checked={c.enabled} onChange={(e) => onChange(c.id, { enabled: e.target.checked })} className="size-4 accent-[var(--foreground)]" />
        <button type="button" aria-label={`Colour of ${c.name}`} aria-expanded={picking} onClick={() => setPicking(!picking)} className="size-4 shrink-0 rounded-full ring-offset-2 ring-offset-card transition-shadow hover:ring-2 hover:ring-foreground/30" style={{ background: c.color }} />
        <span className={cn('min-w-0 flex-1 truncate text-sm', !c.enabled && 'text-muted-foreground')}>{c.name}</span>
        {!c.writable && <span className="rounded bg-muted px-1.5 py-px text-[10px] text-muted-foreground">read only</span>}
        {c.writable && sends && (
          <Button variant={c.export ? 'secondary' : 'ghost'} size="xs" aria-pressed={c.export} onClick={() => onChange(c.id, { export: !c.export })} title="This workspace's meetings, hearings, tasks and follow-ups are added to this calendar">
            <Send /> {c.export ? 'Receiving my schedule' : 'Send my schedule here'}
          </Button>
        )}
      </div>
      {picking && (
        <div role="radiogroup" aria-label={`Colour of ${c.name}`} className="flex gap-1.5 pl-7">
          {SWATCHES.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={c.color.toLowerCase() === s.toLowerCase()} aria-label={s} onClick={() => (onChange(c.id, { color: s }), setPicking(false))} className={cn('size-5 rounded-full transition-transform hover:scale-110', c.color.toLowerCase() === s.toLowerCase() && 'ring-2 ring-foreground ring-offset-2 ring-offset-card')} style={{ background: s }} />
          ))}
        </div>
      )}
    </li>
  )
}
