import { useState } from 'react'
import type { FormEvent } from 'react'
import { AlertTriangle, ArrowLeft, Check, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from '@/presentation/notifications/toast'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { MAIL_PRESETS } from '@/domain/mail/Mail'
import type { MailAccount } from '@/domain/mail/Mail'
import { WORKSPACES } from '@/domain/shared/workspace'
import type { WorkspaceId } from '@/domain/shared/workspace'
import { cn } from '@/lib/utils'
import { ConfirmDelete } from '@/presentation/components/confirm'
import { Field } from '@/presentation/components/form'
import { WorkspaceDot, WorkspacePicker } from '@/presentation/components/workspace'
import { useMailActions } from './useMail'

type Mode = { kind: 'list' } | { kind: 'form'; account?: MailAccount }

/** Connect, change and remove the mailboxes. Opens on the list, or straight on the form when there is nothing connected yet. */
export function MailboxesDialog({ open, onOpenChange, accounts, workspace, only }: { open: boolean; onOpenChange: (o: boolean) => void; accounts: MailAccount[]; workspace: WorkspaceId; only: WorkspaceId[] }) {
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const shown: Mode = accounts.length === 0 && mode.kind === 'list' ? { kind: 'form' } : mode
  const back = () => setMode({ kind: 'list' })

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) setMode({ kind: 'list' })
      }}
    >
      <DialogContent className="sm:max-w-lg">
        {shown.kind === 'list' ? (
          <List accounts={accounts} onAdd={() => setMode({ kind: 'form' })} onEdit={(account) => setMode({ kind: 'form', account })} />
        ) : (
          <Form account={shown.account} workspace={workspace} only={only} canGoBack={accounts.length > 0} onBack={back} onDone={() => (accounts.length === 0 && !shown.account ? onOpenChange(false) : back())} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function List({ accounts, onAdd, onEdit }: { accounts: MailAccount[]; onAdd: () => void; onEdit: (a: MailAccount) => void }) {
  const { disconnect, test } = useMailActions()

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-3xl font-normal tracking-tight">Mailboxes</DialogTitle>
        <DialogDescription>Each workspace shows the mailboxes you connect to it. Mail stays on your mail server; Stiamo only reads it.</DialogDescription>
      </DialogHeader>
      <ul className="grid gap-1.5">
        {accounts.map((a) => (
          <li key={a.id} className="flex items-center gap-3 rounded-xl border px-3 py-2.5">
            <WorkspaceDot ws={a.workspace} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{a.label}</div>
              <div className={cn('truncate text-xs', a.error ? 'text-destructive' : 'text-muted-foreground')}>
                {a.error ? (
                  <span className="inline-flex items-center gap-1">
                    <AlertTriangle className="size-3" /> {a.error}
                  </span>
                ) : (
                  `${a.address} · ${WORKSPACES[a.workspace]?.short ?? a.workspace}`
                )}
              </div>
            </div>
            <Button size="icon-sm" variant="ghost" aria-label={`Check ${a.address}`} disabled={test.isPending} onClick={() => test.mutate(a.id, { onSuccess: () => toast.success('Connected'), onError: (e) => toast.error(e.message) })}>
              {test.isPending && test.variables === a.id ? <Spinner size="xs" tone="current" decorative /> : <RefreshCw />}
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label={`Edit ${a.address}`} onClick={() => onEdit(a)}>
              <Pencil />
            </Button>
            <ConfirmDelete what={`the connection to ${a.address}`} onConfirm={() => disconnect.mutateAsync(a.id).then(() => toast.success('Mailbox disconnected'), (e: Error) => toast.error(e.message))}>
              <Trash2 />
            </ConfirmDelete>
          </li>
        ))}
      </ul>
      <Button variant="outline" onClick={onAdd}>
        <Plus /> Connect a mailbox
      </Button>
    </>
  )
}

function Form({ account, workspace, only, canGoBack, onBack, onDone }: { account?: MailAccount; workspace: WorkspaceId; only: WorkspaceId[]; canGoBack: boolean; onBack: () => void; onDone: () => void }) {
  const { connect, edit } = useMailActions()
  const editing = !!account
  const [ws, setWs] = useState<WorkspaceId>(account?.workspace ?? workspace)
  const [preset, setPreset] = useState<string>(account ? (MAIL_PRESETS.find((p) => p.host === account.host)?.id ?? 'other') : 'gmail')
  const chosen = MAIL_PRESETS.find((p) => p.id === preset)!
  const [label, setLabel] = useState(account?.label ?? '')
  const [address, setAddress] = useState(account?.address ?? '')
  const [password, setPassword] = useState('')
  const [host, setHost] = useState(account?.host ?? chosen.host)
  const [port, setPort] = useState(String(account?.port ?? 993))
  const [security, setSecurity] = useState<'ssl' | 'starttls'>(account?.security ?? 'ssl')
  const [username, setUsername] = useState(account?.username ?? '')
  const [error, setError] = useState<string | null>(null)
  const busy = connect.isPending || edit.isPending

  function pick(id: string) {
    const p = MAIL_PRESETS.find((x) => x.id === id)!
    setPreset(id)
    setHost(p.host)
    setPort(String(p.port))
    setSecurity(p.security)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const common = { workspace: ws, label: label.trim(), host: host.trim(), port: Number(port), security, username: username.trim() }
    const done = {
      onSuccess: () => {
        toast.success(editing ? 'Mailbox updated' : 'Mailbox connected')
        onDone()
      },
      onError: (err: Error) => setError(err.message),
    }
    if (account) edit.mutate({ id: account.id, changes: { ...common, ...(password && { password }) } }, done)
    else connect.mutate({ ...common, address: address.trim(), password }, done)
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle className="font-display text-3xl font-normal tracking-tight">{editing ? 'Edit mailbox' : 'Connect a mailbox'}</DialogTitle>
        <DialogDescription>{editing ? account.address : 'Stiamo signs in once to check the details, then keeps the password encrypted.'}</DialogDescription>
      </DialogHeader>

      <Field label="Workspace" hint="Where this mailbox shows up.">
        <WorkspacePicker value={ws} onChange={setWs} only={only} />
      </Field>

      {!editing && (
        <div role="group" aria-label="Provider" className="flex flex-wrap gap-2">
          {MAIL_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={preset === p.id}
              onClick={() => pick(p.id)}
              className={cn('flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors', preset === p.id ? 'border-foreground/40 bg-muted font-medium' : 'text-muted-foreground hover:border-foreground/30 hover:text-foreground')}
            >
              {preset === p.id && <Check className="size-3.5" />}
              {p.name}
            </button>
          ))}
        </div>
      )}

      {!editing && (
        <Field label="Email address" htmlFor="mail-address">
          <Input id="mail-address" type="email" autoComplete="off" required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="you@yourfirm.com" />
        </Field>
      )}
      <Field label={editing ? 'New password' : 'Password'} hint={editing ? 'Leave empty to keep the current one.' : chosen.hint} htmlFor="mail-password">
        <Input id="mail-password" type="password" autoComplete="new-password" required={!editing} value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Field label="Name" hint="Optional. How it is listed, for example “Chambers”." htmlFor="mail-label">
        <Input id="mail-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={address || 'Chambers'} />
      </Field>

      {(preset === 'other' || editing) && (
        <div className="grid gap-3 rounded-xl border bg-muted/30 p-3">
          <div className="grid grid-cols-[1fr_6rem] gap-3">
            <Field label="IMAP server" htmlFor="mail-host">
              <Input id="mail-host" required value={host} onChange={(e) => setHost(e.target.value)} placeholder="imap.example.com" />
            </Field>
            <Field label="Port" htmlFor="mail-port">
              <Input id="mail-port" inputMode="numeric" required value={port} onChange={(e) => setPort(e.target.value.replace(/\D/g, ''))} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Security" htmlFor="mail-security">
              <select id="mail-security" value={security} onChange={(e) => setSecurity(e.target.value as 'ssl' | 'starttls')} className="h-9 w-full rounded-lg border bg-background px-2.5 text-sm">
                <option value="ssl">SSL / TLS</option>
                <option value="starttls">STARTTLS</option>
              </select>
            </Field>
            <Field label="Username" hint="If not the address." htmlFor="mail-username">
              <Input id="mail-username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={address || 'same as the address'} />
            </Field>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        {canGoBack && (
          <Button type="button" variant="ghost" onClick={onBack}>
            <ArrowLeft /> Back
          </Button>
        )}
        <Button type="submit" disabled={busy}>
          {busy && <Spinner size="xs" tone="current" decorative />} {editing ? 'Save' : 'Connect'}
        </Button>
      </div>
    </form>
  )
}
