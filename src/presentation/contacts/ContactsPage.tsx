import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookUser, History, Mail, Phone, Search, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { activityOf } from '@/domain/contacts/activity'
import { initials } from '@/domain/contacts/Contacts'
import type { Contact } from '@/domain/contacts/Contacts'
import { WORKSPACES } from '@/domain/shared/workspace'
import { PageHeader } from '@/presentation/components/layout'
import { WorkspaceDot } from '@/presentation/components/workspace'
import { useWorkspaceFilter } from '@/presentation/app/workspaceFilter'
import { toast } from '@/presentation/notifications/toast'
import { useEntities, useToday } from '@/presentation/data/hooks'
import { friendlyDate } from '@/presentation/components/dates'
import { ContactAccountsSheet } from './ContactAccountsSheet'
import { ContactHistory } from './ContactHistory'
import { useContactList, useContactsAvailable, useContactsStatus } from './useContacts'

const PAGE = 60

/** The contacts of the workspace you are in (or all of them), from the Google accounts linked to it. */
export function ContactsPage() {
  const { scope } = useWorkspaceFilter()
  const available = useContactsAvailable()
  const status = useContactsStatus()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const [history, setHistory] = useState<Contact | null>(null)
  const today = useToday()
  const { data: followUps } = useEntities('followUp')
  const { data: tasks } = useEntities('task')
  useEffect(() => {
    const id = setTimeout(() => (setQ(typed.trim()), setLimit(PAGE)), 300)
    return () => clearTimeout(id)
  }, [typed])

  // Coming back from Google after allowing access (or not): say how it went, and tidy the address.
  const [params, setParams] = useSearchParams()
  useEffect(() => {
    const ok = params.get('contacts_connected')
    const bad = params.get('contacts_error')
    if (!ok && !bad) return
    if (ok) toast.success('Google account linked', { description: `${ok}’s contacts are being read now.` })
    else toast.error('Couldn’t link the account', { description: bad ?? undefined })
    setParams((p) => (p.delete('contacts_connected'), p.delete('contacts_error'), p), { replace: true })
    if (ok) setOpen(true)
  }, [params, setParams])

  const linked = (status.data?.accounts ?? []).filter((a) => scope === 'all' || a.workspace === scope)
  const { items, total, loading, error } = useContactList(scope, q, limit, available && linked.length > 0)
  const accountsHere = new Set(linked.map((a) => a.email)).size

  return (
    <>
      <PageHeader
        eyebrow={scope === 'all' ? 'All workspaces' : WORKSPACES[scope].name}
        title="Contacts"
        description="The people in your Google address books, kept per workspace. A workspace can have several Google accounts, and one account can be in several workspaces."
        actions={
          available && (
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              <BookUser /> Google accounts
            </Button>
          )
        }
      />

      {!available ? (
        <p className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Google contacts need the Stiamo backend.</p>
      ) : status.isLoading ? (
        <Spinner label="Loading" />
      ) : linked.length === 0 ? (
        <div className="grid justify-items-center gap-3 rounded-2xl border border-dashed px-4 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-muted">
            <Users className="size-5" />
          </span>
          <div>
            <p className="font-medium">No contacts yet{scope === 'all' ? '' : ` in ${WORKSPACES[scope].short}`}</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">Link a Google account and its contacts appear here. You can link several accounts to a workspace, and use the same account in more than one.</p>
          </div>
          <Button onClick={() => setOpen(true)}>
            <BookUser /> Link a Google account
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative block w-full sm:max-w-sm">
              <span className="sr-only">Search contacts</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Search by name, organisation, email or number" className="pl-9" />
            </label>
            <span className="text-xs text-muted-foreground">
              {total} {total === 1 ? 'contact' : 'contacts'} from {accountsHere} Google {accountsHere === 1 ? 'account' : 'accounts'}
            </span>
          </div>

          {error && (
            <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
              {error}
            </p>
          )}
          {loading ? (
            <Spinner label="Loading contacts" />
          ) : items.length === 0 ? (
            <p className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">{q ? `No one matches “${q}”.` : 'These accounts have no saved contacts yet.'}</p>
          ) : (
            <>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((c) => (
                  <li key={c.id}>
                    <ContactCard contact={c} showWorkspaces={scope === 'all'} showAccount={linked.length > 1 && scope !== 'all'} activity={activityOf(c, followUps, tasks)} today={today} onHistory={() => setHistory(c)} />
                  </li>
                ))}
              </ul>
              {items.length < total && (
                <Button variant="outline" className="mx-auto" onClick={() => setLimit((l) => l + PAGE)}>
                  Show more ({total - items.length} left)
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {available && <ContactAccountsSheet open={open} onOpenChange={setOpen} scope={scope} />}
      <ContactHistory contact={history} onClose={() => setHistory(null)} />
    </>
  )
}

function ContactCard({ contact: c, showWorkspaces, showAccount, activity, today, onHistory }: { contact: Contact; showWorkspaces: boolean; showAccount: boolean; activity: ReturnType<typeof activityOf>; today: string; onHistory: () => void }) {
  return (
    <article className="grid h-full content-start gap-2.5 rounded-2xl border bg-card/80 p-4">
      <header className="flex items-center gap-3">
        {c.photo ? <img src={c.photo} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-10 shrink-0 rounded-full object-cover" /> : <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold">{initials(c.name)}</span>}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{c.name}</h3>
          {(c.organisation || c.title) && <p className="truncate text-xs text-muted-foreground">{[c.title, c.organisation].filter(Boolean).join(' · ')}</p>}
        </div>
      </header>
      {(c.emails.length > 0 || c.phones.length > 0) && (
        <ul className="grid gap-1 text-sm">
          {c.emails.slice(0, 3).map((e) => (
            <li key={e.value} className="flex items-center gap-2">
              <Mail className="size-3.5 shrink-0 text-muted-foreground" />
              <a href={`mailto:${e.value}`} className="min-w-0 truncate hover:underline">
                {e.value}
              </a>
            </li>
          ))}
          {c.phones.slice(0, 3).map((p) => (
            <li key={p.value} className="flex items-center gap-2">
              <Phone className="size-3.5 shrink-0 text-muted-foreground" />
              <a href={`tel:${p.value.replace(/[^\d+]/g, '')}`} className="min-w-0 truncate hover:underline">
                {p.value}
              </a>
              {p.label && <span className="text-[11px] text-muted-foreground">{p.label}</span>}
            </li>
          ))}
        </ul>
      )}
      {c.notes && <p className="line-clamp-2 text-xs text-muted-foreground">{c.notes}</p>}
      <button type="button" onClick={onHistory} className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
        <History className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          {activity.tries || activity.openFollowUps || activity.openTasks
            ? `${activity.lastReached ? `Last spoke ${friendlyDate(activity.lastReached, today)} · ` : ''}${activity.tries} ${activity.tries === 1 ? 'try' : 'tries'}${activity.openFollowUps ? ` · ${activity.openFollowUps} open` : ''}`
            : 'No calls yet'}
        </span>
      </button>
      {(showWorkspaces || showAccount) && (
        <footer className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11px] text-muted-foreground">
          {showWorkspaces &&
            c.workspaces.map((w) => (
              <span key={w} className="flex items-center gap-1">
                <WorkspaceDot ws={w} /> {WORKSPACES[w].short}
              </span>
            ))}
          {showAccount && c.accounts[0] && <span className="truncate">{c.accounts[0]}</span>}
        </footer>
      )}
    </article>
  )
}
