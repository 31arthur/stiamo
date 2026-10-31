import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, Flag, Inbox, Paperclip, Plus, Search, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import type { LiveState, MailAccount, MailSummary } from '@/domain/mail/Mail'
import { WORKSPACES } from '@/domain/shared/workspace'
import type { WorkspaceId } from '@/domain/shared/workspace'
import { cn } from '@/lib/utils'
import { usePages } from '@/presentation/app/pages'
import { useScope } from '@/presentation/app/workspaceFilter'
import { workspacesWith } from '@/domain/shared/pages'
import { EmptyState, PageHeader } from '@/presentation/components/layout'
import { WorkspaceDot } from '@/presentation/components/workspace'
import { listDate, who } from './format'
import { MailboxesDialog } from './MailboxesDialog'
import { MessageReader } from './MessageReader'
import { useFolders, useLiveFolders, useMailAccounts, useMailAvailable, useMessages, useUnifiedMessages } from './useMail'

/** The mailboxes of the workspace you are in (all of them under "All workspaces"), read live from the mail server. */
export function MailPage() {
  const available = useMailAvailable()
  const scope = useScope()
  const { accounts, loading, error } = useMailAccounts()
  const [managing, setManaging] = useState(false)
  const here = scope === 'all' ? null : WORKSPACES[scope]
  const { hidden } = usePages()
  // Only the workspaces that have Mail switched on show their mailboxes or take new ones.
  const withMail = workspacesWith(hidden, 'mail')
  const mine = accounts.filter((a) => withMail.includes(a.workspace) && (scope === 'all' || a.workspace === scope))
  const newWorkspace: WorkspaceId = scope !== 'all' ? scope : (withMail[0] ?? 'sb')

  const header = (
    <PageHeader
      eyebrow={here ? here.name : 'All workspaces'}
      title="Mail"
      description={here ? `The mailboxes of ${here.short}, read straight from the mail server.` : 'Every mailbox you have connected, read straight from the mail server.'}
      actions={
        mine.length > 0 ? (
          <Button variant="outline" onClick={() => setManaging(true)}>
            <Settings2 /> Mailboxes
          </Button>
        ) : undefined
      }
    />
  )

  if (!available)
    return (
      <>
        {header}
        <EmptyState title="Mail needs the Stiamo backend">Sign in to a Stiamo server to connect mailboxes.</EmptyState>
      </>
    )
  if (loading)
    return (
      <>
        {header}
        <Skeleton className="h-[60vh] w-full rounded-2xl" />
      </>
    )

  return (
    <>
      {header}
      {error && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
          {error}
        </p>
      )}
      {mine.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed px-6 py-14 text-center">
          <Inbox className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="font-display text-2xl italic">{here ? `No mailbox in ${here.short} yet` : 'No mailboxes yet'}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Connect the mailbox this work uses. New mail appears here the moment it arrives, without refreshing.</p>
          <Button className="mt-4" onClick={() => setManaging(true)}>
            <Plus /> Connect a mailbox
          </Button>
        </div>
      ) : (
        <Mailbox accounts={mine} />
      )}
      <MailboxesDialog open={managing} onOpenChange={setManaging} accounts={mine} workspace={newWorkspace} only={withMail} />
    </>
  )
}

const ALL = 'all'

function Mailbox({ accounts }: { accounts: MailAccount[] }) {
  const [params, setParams] = useSearchParams()
  const many = accounts.length > 1
  // With several mailboxes the default is to see them together; one of them can be picked to see just that one.
  const picked = accounts.find((a) => a.id === params.get('a'))
  const everything = many && !picked
  const account = picked ?? accounts[0]
  const folder = everything ? 'INBOX' : params.get('f') || 'INBOX'
  const uid = Number(params.get('m')) || undefined
  // Together, a message could be in any mailbox, so which one is kept beside its number.
  const openAccount = everything ? accounts.find((a) => a.id === params.get('o')) : account
  const [typed, setTyped] = useState('')
  const [q, setQ] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setQ(typed.trim()), 350)
    return () => clearTimeout(id)
  }, [typed])

  const set = (changes: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(changes)) {
          if (v === null) next.delete(k)
          else next.set(k, v)
        }
        return next
      },
      { replace: true },
    )

  const folders = useFolders(everything ? undefined : account.id)
  const live = useLiveFolders(everything ? accounts.map((a) => a.id) : [account.id], folder)
  const one = useMessages(everything ? undefined : account.id, folder, q)
  const together = useUnifiedMessages(accounts, q, everything)
  const list = everything ? { ...together, error: null as string | null } : { ...one, problems: [] as string[] }
  const byId = new Map(accounts.map((a) => [a.id, a]))
  const rows: (MailSummary & { accountId?: string })[] = list.messages

  return (
    <div className="grid h-[calc(100dvh-13rem)] min-h-[480px] overflow-hidden rounded-2xl border bg-card/80 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
      <section aria-label="Messages" className={cn('flex min-h-0 flex-col border-r', uid && openAccount && 'max-lg:hidden')}>
        <div className="grid gap-2 border-b p-3">
          <div className="flex items-center gap-2">
            {many ? (
              <select aria-label="Mailbox" value={everything ? ALL : account.id} onChange={(e) => set({ a: e.target.value === ALL ? null : e.target.value, f: null, m: null, o: null })} className="h-8 min-w-0 flex-1 rounded-lg border bg-background px-2 text-sm font-medium">
                <option value={ALL}>All mailboxes ({accounts.length})</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} ({WORKSPACES[a.workspace].short})
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
                <WorkspaceDot ws={account.workspace} />
                <span className="truncate">{account.label}</span>
              </div>
            )}
            <LiveBadge state={live} />
          </div>
          <div className="flex items-center gap-2">
            {everything ? (
              <span className="flex h-8 w-36 shrink-0 items-center rounded-lg border bg-muted/40 px-2.5 text-sm text-muted-foreground">Inboxes</span>
            ) : (
              <select aria-label="Folder" value={folder} onChange={(e) => set({ f: e.target.value, m: null })} className="h-8 w-36 shrink-0 rounded-lg border bg-background px-2 text-sm">
                {(folders.data ?? [{ name: 'INBOX', label: 'Inbox', unseen: 0 }]).map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.label}
                    {f.unseen > 0 ? ` (${f.unseen})` : ''}
                  </option>
                ))}
                {folders.data && !folders.data.some((f) => f.name === folder) && <option value={folder}>{folder}</option>}
              </select>
            )}
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Search this folder" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Search" className="h-8 pl-8" />
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {list.problems.map((p) => (
            <Notice key={p}>{p}</Notice>
          ))}
          {!everything && account.error && !rows.length ? (
            <Notice>{account.error}</Notice>
          ) : list.error ? (
            <Notice>{list.error}</Notice>
          ) : list.loading ? (
            <ul className="divide-y">
              {Array.from({ length: 7 }, (_, i) => (
                <li key={i} className="grid gap-1.5 px-4 py-3">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </li>
              ))}
            </ul>
          ) : rows.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-muted-foreground">{q ? `Nothing matches “${q}”.` : 'Nothing in this folder.'}</p>
          ) : (
            <ul className="divide-y">
              {rows.map((m) => {
                const owner = everything && m.accountId ? byId.get(m.accountId) : undefined
                return (
                  <li key={`${m.accountId ?? ''}/${m.uid}`}>
                    <Row message={m} mailbox={owner} active={m.uid === uid && (!everything || m.accountId === openAccount?.id)} onOpen={() => set(everything ? { m: String(m.uid), o: m.accountId ?? null } : { m: String(m.uid) })} />
                  </li>
                )
              })}
              {list.more && (
                <li className="p-3 text-center">
                  <Button size="sm" variant="ghost" disabled={list.loadingMore} onClick={list.loadMore}>
                    {list.loadingMore && <Spinner size="xs" tone="current" decorative />} Older messages
                  </Button>
                </li>
              )}
            </ul>
          )}
        </div>
        <footer className="flex items-center justify-between border-t px-4 py-1.5 text-[11px] text-muted-foreground">
          <span>
            {list.total} {q ? 'found' : 'messages'}
          </span>
          {list.refreshing && <Spinner size="xs" tone="current" decorative />}
        </footer>
      </section>

      <section aria-label="Message" className={cn('min-h-0', !(uid && openAccount) && 'max-lg:hidden')}>
        {uid && openAccount ? (
          <MessageReader key={`${openAccount.id}/${folder}/${uid}`} accountId={openAccount.id} folder={folder} uid={uid} onBack={() => set({ m: null, o: null })} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <Inbox className="size-8" />
            <p className="text-sm">Choose a message to read it.</p>
          </div>
        )}
      </section>
    </div>
  )
}

function Row({ message: m, mailbox, active, onOpen }: { message: MailSummary; mailbox?: MailAccount; active: boolean; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} aria-current={active} className={cn('relative grid w-full gap-0.5 px-4 py-3 text-left transition-colors hover:bg-muted/60', active && 'bg-muted')}>
      {!m.seen && <span aria-label="Unread" className="absolute top-1/2 left-1.5 size-1.5 -translate-y-1/2 rounded-full bg-primary" />}
      <div className="flex items-baseline gap-2">
        <span className={cn('min-w-0 flex-1 truncate text-sm', m.seen ? 'text-muted-foreground' : 'font-semibold')}>{who(m.sender)}</span>
        <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{listDate(m.date)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={cn('min-w-0 flex-1 truncate text-sm', !m.seen && 'font-medium')}>{m.subject}</span>
        {m.flagged && <Flag className="size-3 shrink-0 fill-warning text-warning" aria-label="Flagged" />}
        {m.hasAttachments && <Paperclip className="size-3 shrink-0 text-muted-foreground" aria-label="Has attachments" />}
      </div>
      {m.snippet && <p className="line-clamp-1 text-xs text-muted-foreground">{m.snippet}</p>}
      {mailbox && (
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          <WorkspaceDot ws={mailbox.workspace} />
          <span className="truncate">{mailbox.label}</span>
        </span>
      )}
    </button>
  )
}

const LIVE: Record<LiveState, { label: string; dot: string }> = {
  live: { label: 'Live', dot: 'bg-success' },
  connecting: { label: 'Connecting', dot: 'bg-muted-foreground/50 animate-pulse' },
  down: { label: 'Reconnecting', dot: 'bg-warning animate-pulse' },
  auth: { label: 'Check password', dot: 'bg-destructive' },
}

/** Whether new mail will arrive by itself: the server is holding the folder open and will say when something changes. */
function LiveBadge({ state }: { state: LiveState }) {
  const s = LIVE[state]
  return (
    <span title={state === 'live' ? 'The mail server tells Stiamo the moment something arrives.' : undefined} className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className={cn('size-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  )
}

function Notice({ children }: { children: string }) {
  return (
    <p role="alert" className="m-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
      {children}
    </p>
  )
}
