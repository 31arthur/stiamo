import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Download, Flag, ImageOff, MailOpen, Paperclip } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import type { MailAttachment, MailMessage } from '@/domain/mail/Mail'
import { cn } from '@/lib/utils'
import { useServices } from '@/presentation/app/services'
import { bytes, fullDate, initials, who } from './format'
import { useMailActions, useMessage } from './useMail'

/**
 * A message. Its HTML has already been cleaned by the server and is shown here in a frame that cannot run scripts, submit forms or
 * reach this page, with remote images blocked until the person asks (they tell the sender you opened it).
 */
export function MessageReader({ accountId, folder, uid, onBack }: { accountId: string; folder: string; uid: number; onBack: () => void }) {
  const { data: m, isLoading, error } = useMessage(accountId, folder, uid)
  const { mark } = useMailActions()

  // Opening a message reads it, like any mail program. (The server fetched it without touching the flag.)
  useEffect(() => {
    if (m && !m.seen) mark.mutate({ accountId, folder, uid, seen: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m?.uid, m?.seen])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 border-b px-3 py-2 lg:hidden">
        <Button size="sm" variant="ghost" onClick={onBack}>
          <ArrowLeft /> Inbox
        </Button>
      </div>
      {isLoading ? (
        <div className="grid gap-3 p-5">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="mt-4 h-40 w-full" />
        </div>
      ) : error || !m ? (
        <p role="alert" className="m-5 rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
          {error instanceof Error ? error.message : 'Couldn’t open that message.'}
        </p>
      ) : (
        <Body m={m} accountId={accountId} folder={folder} />
      )}
    </div>
  )
}

function Body({ m, accountId, folder }: { m: MailMessage; accountId: string; folder: string }) {
  const { mark } = useMailActions()
  const [images, setImages] = useState(false) // the reader is keyed by message, so this starts closed for each one

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <header className="grid gap-3 border-b px-5 py-4">
        <div className="flex items-start gap-3">
          <h2 className="min-w-0 flex-1 font-display text-2xl leading-snug break-words">{m.subject}</h2>
          <div className="flex shrink-0 gap-1">
            <Button size="icon" variant="ghost" aria-label={m.flagged ? 'Remove flag' : 'Flag'} aria-pressed={m.flagged} onClick={() => mark.mutate({ accountId, folder, uid: m.uid, flagged: !m.flagged })}>
              <Flag className={cn(m.flagged && 'fill-warning text-warning')} />
            </Button>
            <Button size="icon" variant="ghost" aria-label="Mark as unread" onClick={() => mark.mutate({ accountId, folder, uid: m.uid, seen: false })}>
              <MailOpen />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            {initials(m.sender)}
          </span>
          <div className="min-w-0 text-sm">
            <div className="truncate">
              <span className="font-medium">{who(m.sender)}</span> {m.sender.name && <span className="text-muted-foreground">&lt;{m.sender.address}&gt;</span>}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              To {m.to.map(who).join(', ') || 'you'}
              {m.cc.length > 0 && ` · Cc ${m.cc.map(who).join(', ')}`} · {fullDate(m.date)}
            </div>
          </div>
        </div>
        {m.attachments.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {m.attachments.map((a) => (
              <li key={a.index}>
                <AttachmentChip accountId={accountId} folder={folder} uid={m.uid} attachment={a} />
              </li>
            ))}
          </ul>
        )}
      </header>

      {m.html && m.hasRemoteContent && !images && (
        <div className="flex items-center gap-2 border-b bg-muted/40 px-5 py-2 text-xs text-muted-foreground">
          <ImageOff className="size-3.5 shrink-0" />
          <span className="flex-1">Pictures from the internet are hidden, so the sender can’t tell you opened this.</span>
          <Button size="xs" variant="outline" onClick={() => setImages(true)}>
            Show pictures
          </Button>
        </div>
      )}

      {m.html ? <Frame html={m.html} images={images} /> : <pre className="px-5 py-4 font-sans text-sm leading-relaxed break-words whitespace-pre-wrap">{m.text || <span className="text-muted-foreground">This message has no text.</span>}</pre>}
    </div>
  )
}

/** The message in a sandbox: no scripts, no forms, no same-origin access. The CSP inside it also stops anything but inline pictures loading. */
function Frame({ html, images }: { html: string; images: boolean }) {
  const doc = useMemo(
    () =>
      `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:${images ? ' https:' : ''}; font-src 'none'">` +
      `<base target="_blank"><style>body{margin:0;padding:16px 20px;font:14px/1.55 system-ui,sans-serif;color:#1c1c1c;background:#fff;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{max-width:100%}a{color:#2563eb}blockquote{margin:8px 0;padding-left:12px;border-left:3px solid #ddd;color:#555}</style>${html}`,
    [html, images],
  )
  return <iframe title="Message" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={doc} className="min-h-[60vh] w-full flex-1 border-0 bg-white" />
}

function AttachmentChip({ accountId, folder, uid, attachment }: { accountId: string; folder: string; uid: number; attachment: MailAttachment }) {
  const { mail } = useServices()
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    try {
      const blob = await mail.download(accountId, folder, uid, attachment)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = attachment.filename
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn’t download it')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button type="button" onClick={() => void save()} disabled={busy} className="flex max-w-64 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-muted disabled:opacity-60">
      {busy ? <Spinner size="xs" tone="current" decorative /> : <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />}
      <span className="min-w-0 flex-1 truncate font-medium">{attachment.filename}</span>
      <span className="shrink-0 text-muted-foreground">{bytes(attachment.size)}</span>
      <Download className="size-3.5 shrink-0 text-muted-foreground" />
    </button>
  )
}
