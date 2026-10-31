import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ThumbsUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import type { ExecutionItem, FeedbackSuggestion } from '@/domain/ai/AgentApi'
import { useServices } from '@/presentation/app/services'
import { toast } from '@/presentation/notifications/toast'
import { parseMail } from './executions'

const AREA = 'w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

const QUICK = ['It is from a partner or an organisation we work with.', 'It is relevant to our work.', 'I asked for it, or was expecting it.', 'It is from someone I know.', 'It is an official or important notice.']

/**
 * "This isn't spam." It asks why, and the reason is what the agent learns from: it reads its whole setup, the email and the reason,
 * and suggests one extra point for the prompt. The owner sees it, can edit it, and decides whether to add it. What was written in
 * the prompt is never changed; the point is added after it.
 */
export function NotSpamDialog({ workflowId, keepLabel, item, pending, onClose }: { workflowId: string; keepLabel: string; item: ExecutionItem | null; pending: boolean; onClose: () => void }) {
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">{item && <Flow key={item.id} workflowId={workflowId} keepLabel={keepLabel} item={item} pending={pending} onClose={onClose} />}</DialogContent>
    </Dialog>
  )
}

function Flow({ workflowId, keepLabel, item, pending, onClose }: { workflowId: string; keepLabel: string; item: ExecutionItem; pending: boolean; onClose: () => void }) {
  const { agent } = useServices()
  const client = useQueryClient()
  const mail = parseMail(item.excerpt)
  const [reason, setReason] = useState('')
  const [suggestion, setSuggestion] = useState<FeedbackSuggestion | null>(null)
  const [point, setPoint] = useState('')
  const [protect, setProtect] = useState(false)
  const [busy, setBusy] = useState(false)

  const refresh = () => {
    for (const key of ['execution', 'executions', 'review', 'workflow']) void client.invalidateQueries({ queryKey: ['agent', key] })
  }

  /** Records that it is not spam: an email still waiting is kept, with the reason; one already in Trash can only be noted. */
  async function keep(why: string) {
    if (pending) await agent.decideReview(workflowId, [item.id], 'approve', keepLabel, why)
  }

  async function analyse() {
    setBusy(true)
    try {
      const s = await agent.analyseFeedback(workflowId, item.id, reason.trim())
      setSuggestion(s)
      setPoint(s.duplicate ? '' : s.point)
      setProtect(!!s.protectDomain)
    } catch (e) {
      toast.error('Couldn’t work out what to learn', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  async function finish(add: boolean) {
    setBusy(true)
    try {
      await keep(reason.trim())
      const domain = protect ? (suggestion?.protectDomain ?? suggestion?.senderDomain ?? undefined) : undefined
      if (add && (point.trim() || domain)) await agent.addRefinement(workflowId, { point: point.trim() || undefined, protectDomain: domain })
      toast.success(add && point.trim() ? 'Added to the prompt' : 'Noted', {
        description: pending ? 'The email stays in the inbox.' : 'It was already moved to Trash: open the mailbox’s Trash folder to put it back.',
      })
      refresh()
      onClose()
    } catch (e) {
      toast.error('Couldn’t save that', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  const domain = suggestion?.protectDomain ?? suggestion?.senderDomain

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-3xl font-normal tracking-tight">{suggestion ? 'What it learned' : 'Why isn’t this spam?'}</DialogTitle>
        <DialogDescription className="break-words">
          {mail.subject || item.title}
          {mail.sender && <span className="block text-xs">From {mail.sender}</span>}
        </DialogDescription>
      </DialogHeader>

      {!suggestion ? (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">Your reason is what the agent learns from. It reads its whole prompt first, then suggests one extra point to add to it. Nothing you wrote is changed.</p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <button key={q} type="button" onClick={() => setReason((r) => (r.includes(q) ? r : `${r}${r && !/\s$/.test(r) ? ' ' : ''}${q}`))} className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground">
                {q.replace(/\.$/, '')}
              </button>
            ))}
          </div>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} placeholder="Say why in your own words, for example: they are a funder we are applying to." aria-label="Why it isn’t spam" className={AREA} autoFocus />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void analyse()} disabled={busy || !reason.trim()}>
              {busy ? <Spinner size="xs" tone="current" decorative /> : <ThumbsUp />} Continue
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {suggestion.note && <p className="text-sm text-muted-foreground">{suggestion.note}</p>}
          {suggestion.duplicate ? (
            <p className="rounded-xl border bg-muted/40 px-3.5 py-2.5 text-sm">The prompt already covers this, so nothing needs adding. The email is kept.</p>
          ) : (
            <label className="grid gap-1">
              <span className="text-sm font-medium">Add this point to the prompt</span>
              <span className="text-xs text-muted-foreground">{suggestion.source === 'model' ? 'Written from your reason and the whole prompt. Change it if it isn’t right.' : 'Your own words. Change them into a general rule if you like.'}</span>
              <textarea value={point} onChange={(e) => setPoint(e.target.value)} rows={3} maxLength={300} aria-label="The point to add" className={AREA} />
            </label>
          )}
          {domain && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={protect} onChange={(e) => setProtect(e.target.checked)} className="size-4 accent-[var(--foreground)]" />
              Always keep mail from <b>{domain}</b>
            </label>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => void finish(false)} disabled={busy}>
              {suggestion.duplicate ? 'Keep this email' : 'Keep it, don’t add'}
            </Button>
            {(!suggestion.duplicate || protect) && (
              <Button onClick={() => void finish(true)} disabled={busy || (!point.trim() && !protect)}>
                {busy && <Spinner size="xs" tone="current" decorative />} Add to the prompt
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
