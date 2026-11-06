import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Plus, RefreshCw, Unplug } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import type { ContactAccount } from '@/domain/contacts/Contacts'
import { WORKSPACE_IDS, WORKSPACES } from '@/domain/shared/workspace'
import type { WorkspaceId } from '@/domain/shared/workspace'
import { useServices } from '@/presentation/app/services'
import { ago } from '@/presentation/agents/format'
import { ConfirmDelete } from '@/presentation/components/confirm'
import { WorkspaceDot } from '@/presentation/components/workspace'
import { useUserId } from '@/presentation/data/hooks'
import { toast } from '@/presentation/notifications/toast'
import { useContactsStatus, useContactsSync } from './useContacts'

/**
 * The Google accounts whose contacts each workspace shows. A workspace can have several accounts, and one account can be in several
 * workspaces: add it to another from its own row, with no new sign-in.
 */
export function ContactAccountsSheet({ open, onOpenChange, scope }: { open: boolean; onOpenChange: (open: boolean) => void; scope: WorkspaceId | 'all' }) {
  const { contacts } = useServices()
  const client = useQueryClient()
  const userId = useUserId()
  const { data, isLoading, error } = useContactsStatus()
  const { sync, syncing } = useContactsSync()
  const [connecting, setConnecting] = useState<WorkspaceId | null>(null)
  const refresh = () => client.invalidateQueries({ queryKey: ['contacts', userId] })

  async function connect(workspace: WorkspaceId, email?: string) {
    setConnecting(workspace)
    try {
      const { url } = await contacts.start(workspace, email)
      window.location.assign(url)
    } catch (e) {
      setConnecting(null)
      toast.error('Couldn’t start linking', { description: e instanceof Error ? e.message : undefined })
    }
  }

  async function syncNow(accountId?: string) {
    try {
      const r = await sync(accountId)
      if (r.problems.length) toast.warning('Read with problems', { description: r.problems[0] })
      else toast.success('Contacts up to date', { description: `${r.contacts} contacts read.` })
    } catch (e) {
      toast.error('Couldn’t read the contacts', { description: e instanceof Error ? e.message : undefined })
    }
  }

  async function addTo(account: ContactAccount, workspace: WorkspaceId) {
    try {
      await contacts.link(account.id, workspace)
      await refresh()
      toast.success(`Added to ${WORKSPACES[workspace].short}`, { description: `${account.email}’s contacts are in ${WORKSPACES[workspace].name} too.` })
    } catch (e) {
      toast.error('Couldn’t add it', { description: e instanceof Error ? e.message : undefined })
    }
  }

  const order = scope === 'all' ? WORKSPACE_IDS : [scope, ...WORKSPACE_IDS.filter((w) => w !== scope)]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="gap-0 p-0 data-[side=right]:w-[min(96vw,38rem)] data-[side=right]:sm:max-w-none">
        <SheetHeader className="border-b px-5 py-4 pr-12">
          <SheetTitle className="font-display text-2xl font-normal">Google accounts</SheetTitle>
          <SheetDescription className="text-xs">Choose whose contacts each workspace shows. A workspace can have several Google accounts, and one account can be in several workspaces. Stiamo only reads: it can’t change your Google contacts.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <Spinner label="Loading" />
          ) : error || !data ? (
            <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <span>The contacts service isn’t reachable yet. It needs the latest version deployed on the server (docs/CONTACTS_SETUP.md).</span>
            </p>
          ) : (
            <div className="grid gap-5">
              {!data.configured && <p className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">Google isn’t set up on the server yet: it needs the OAuth client from Google Cloud before an account can be linked (docs/CALENDAR_SETUP.md, then docs/CONTACTS_SETUP.md).</p>}
              {order.map((ws) => {
                const accounts = data.accounts.filter((a) => a.workspace === ws)
                return (
                  <section key={ws} aria-label={WORKSPACES[ws].name} className="grid gap-2">
                    <header className="flex items-center gap-2">
                      <WorkspaceDot ws={ws} />
                      <h3 className="text-sm font-semibold">{WORKSPACES[ws].name}</h3>
                      <Button variant="ghost" size="xs" className="ml-auto" disabled={!data.configured || connecting !== null} onClick={() => void connect(ws)}>
                        {connecting === ws ? <Spinner size="xs" tone="current" decorative /> : <Plus />} Link a Google account
                      </Button>
                    </header>
                    {accounts.length === 0 ? (
                      <p className="rounded-xl border border-dashed px-3 py-3 text-xs text-muted-foreground">No Google account linked to {WORKSPACES[ws].short}.</p>
                    ) : (
                      accounts.map((a) => <AccountRow key={a.id} account={a} all={data.accounts} onSync={() => syncNow(a.id)} onAdd={(w) => addTo(a, w)} onUnlink={async () => (await contacts.unlink(a.id), await refresh())} onRelink={() => void connect(a.workspace, a.email)} />)
                    )}
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
            <span className="text-xs text-muted-foreground">Read again every hour, and whenever you press this.</span>
          </footer>
        )}
      </SheetContent>
    </Sheet>
  )
}

function AccountRow({ account: a, all, onSync, onAdd, onUnlink, onRelink }: { account: ContactAccount; all: ContactAccount[]; onSync: () => Promise<void>; onAdd: (workspace: WorkspaceId) => Promise<void>; onUnlink: () => Promise<unknown>; onRelink: () => void }) {
  // The workspaces this same Google account is not yet in.
  const others = WORKSPACE_IDS.filter((w) => !all.some((x) => x.email === a.email && x.workspace === w))
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <article className="overflow-hidden rounded-xl border bg-card/80">
      <header className="flex flex-wrap items-center gap-2 px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.email}</span>
        <span className="text-xs text-muted-foreground">
          {a.contacts} {a.contacts === 1 ? 'contact' : 'contacts'}
          {a.lastSyncAt && a.status === 'ok' ? ` · read ${ago(a.lastSyncAt)}` : ''}
        </span>
        <Button variant="ghost" size="icon-xs" aria-label={`Read ${a.email} again`} onClick={() => void onSync()}>
          <RefreshCw />
        </Button>
        <ConfirmDelete verb="Unlink" what={a.email} note="Its contacts are removed from this workspace. Nothing changes in Google." onConfirm={onUnlink}>
          <Unplug /> Unlink
        </ConfirmDelete>
      </header>
      {a.status === 'reconnect' && (
        <p role="alert" className="flex flex-wrap items-center gap-2 border-t bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="size-3.5 shrink-0" /> {a.error || 'Google no longer allows this.'}
          <Button size="xs" variant="outline" className="ml-auto" onClick={onRelink}>
            Link again
          </Button>
        </p>
      )}
      {a.status === 'ok' && a.error && <p className="border-t px-3 py-1.5 text-xs text-muted-foreground">{a.error}</p>}
      {others.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Also in
            <select value={pick} onChange={(e) => setPick(e.target.value)} className="h-7 rounded-lg border bg-background px-2 text-xs text-foreground" aria-label={`Add ${a.email} to another workspace`}>
              <option value="">another workspace…</option>
              {others.map((w) => (
                <option key={w} value={w}>
                  {WORKSPACES[w].name}
                </option>
              ))}
            </select>
          </label>
          <Button
            size="xs"
            variant="outline"
            disabled={!pick || busy}
            onClick={async () => {
              setBusy(true)
              try {
                await onAdd(pick as WorkspaceId)
                setPick('')
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? <Spinner size="xs" tone="current" decorative /> : <Plus />} Add
          </Button>
        </div>
      )}
    </article>
  )
}
