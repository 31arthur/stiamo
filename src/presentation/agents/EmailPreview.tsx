import { Inbox } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import type { ExecutionItem } from '@/domain/ai/AgentApi'
import { MessageReader } from '@/presentation/mail/MessageReader'
import { useMessage } from '@/presentation/mail/useMail'
import { mailRef, parseMail } from './executions'

/**
 * A look at one email an agent judged, without leaving the page. It opens the real message from the mailbox (and leaves it unread).
 * Mail that has been moved to Trash, or is gone, is shown from the start of it that the agent kept.
 */
export function EmailPreview({ item, folder, trashed, onClose }: { item: ExecutionItem | null; folder: string; trashed: boolean; onClose: () => void }) {
  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-2xl">
        <SheetTitle className="sr-only">Email preview</SheetTitle>
        <SheetDescription className="sr-only">The email as it is in the mailbox.</SheetDescription>
        {item && <Body item={item} folder={folder} trashed={trashed} />}
      </SheetContent>
    </Sheet>
  )
}

function Body({ item, folder, trashed }: { item: ExecutionItem; folder: string; trashed: boolean }) {
  const ref = mailRef(item.id)
  const live = !!ref && !trashed
  const { error, isLoading } = useMessage(ref?.accountId, folder, live ? ref.uid : undefined)
  const saved = parseMail(item.excerpt)

  if (live && ref && !error) return <div className="h-full pt-10"><MessageReader key={item.id} accountId={ref.accountId} folder={folder} uid={ref.uid} markRead={false} /></div>
  if (live && isLoading) return null

  return (
    <div className="grid content-start gap-3 p-5 pt-12">
      <p className="flex items-start gap-2 rounded-xl border bg-muted/40 px-3.5 py-2.5 text-sm text-muted-foreground">
        <Inbox className="mt-0.5 size-4 shrink-0" />
        {trashed ? 'This email was moved to Trash, so only the start of it is shown. Open the mailbox’s Trash folder to read all of it or to put it back.' : 'The mailbox no longer has this email, so only the start of it is shown.'}
      </p>
      <h2 className="font-display text-2xl leading-snug break-words">{saved.subject || item.title}</h2>
      <p className="text-sm text-muted-foreground">From {saved.from || 'an unknown sender'}</p>
      <pre className="rounded-xl bg-muted/50 p-3.5 font-sans text-sm leading-relaxed break-words whitespace-pre-wrap">{saved.body || 'Nothing else was kept.'}</pre>
      {item.reason && (
        <p className="text-sm">
          <span className="font-semibold tracking-widest text-muted-foreground uppercase text-[11px]">Why </span>
          {item.reason}
        </p>
      )}
    </div>
  )
}
