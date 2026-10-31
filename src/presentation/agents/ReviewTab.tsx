import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Check, CheckCheck, X } from 'lucide-react'
import { toast } from '@/presentation/notifications/toast'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { ReviewItem } from '@/domain/ai/AgentApi'
import { cn } from '@/lib/utils'
import { useServices } from '@/presentation/app/services'
import { EmptyState, Section } from '@/presentation/components/layout'
import { useReview, useWorkflow } from './useAgent'

const SELECT = 'h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

/** What the agent proposed, and what it wasn't sure about: approve it, correct the label, or dismiss it. */
export function ReviewTab() {
  const { agentId } = useParams()
  const { agent } = useServices()
  const client = useQueryClient()
  const { data: w } = useWorkflow(agentId)
  const { data: items, isLoading, error } = useReview(agentId)
  /** A label picked in the list, before it is approved. */
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  if (isLoading || !w) return <Spinner label="Loading" />
  if (error) return <p role="alert" className="text-sm text-destructive">{error instanceof Error ? error.message : 'Couldn’t load the review queue.'}</p>
  const labels = w.config.labels.map((l) => l.name)

  async function decide(ids: string[], action: 'approve' | 'dismiss', label?: string) {
    setBusy(true)
    try {
      const { changed, moved } = await agent.decideReview(w!.id, ids, action, label)
      if (changed === 0) toast.error('Choose a label first.')
      else toast.success(action === 'approve' ? `Approved ${changed}${moved ? `, moved ${moved} to Trash` : ''}` : `Dismissed ${changed}`)
      for (const key of ['review', 'workflow']) void client.invalidateQueries({ queryKey: ['agent', key] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn’t save that')
    } finally {
      setBusy(false)
    }
  }

  const labelOf = (i: ReviewItem) => picked[i.id] ?? i.label ?? ''
  const proposed = (items ?? []).filter((i) => i.status === 'proposed')
  const unsure = (items ?? []).filter((i) => i.status === 'needs_review')

  if (!items?.length) {
    return (
      <Section>
        <EmptyState title="Nothing waiting">When the agent runs, what it proposes and what it isn’t sure about lands here for you to approve, correct or dismiss.</EmptyState>
      </Section>
    )
  }

  const group = (title: string, hint: string, rows: ReviewItem[], bulk?: () => void) => (
    <Section
      title={`${title} · ${rows.length}`}
      description={hint}
      actions={
        bulk && rows.length > 1 ? (
          <Button variant="outline" size="sm" onClick={bulk} disabled={busy}>
            <CheckCheck /> Approve all
          </Button>
        ) : undefined
      }
      bodyClassName="p-2"
    >
      <ul className="grid gap-1">
        {rows.map((i) => (
          <li key={i.id} className="grid gap-2 rounded-xl px-2.5 py-2.5 hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{i.title}</div>
              <div className="truncate text-xs text-muted-foreground">{i.reason || i.excerpt}</div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={cn('w-10 text-right text-[11px] tabular-nums', i.status === 'needs_review' ? 'text-warning' : 'text-muted-foreground')}>{i.label ? `${Math.round(i.confidence * 100)}%` : ''}</span>
              <select value={labelOf(i)} onChange={(e) => setPicked((p) => ({ ...p, [i.id]: e.target.value }))} aria-label={`Label for ${i.title}`} className={SELECT}>
                {!labelOf(i) && <option value="">Choose…</option>}
                {labels.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <Button variant="outline" size="icon-sm" aria-label={`Approve ${i.title}`} disabled={busy || !labelOf(i)} onClick={() => void decide([i.id], 'approve', labelOf(i) !== i.label ? labelOf(i) : undefined)}>
                <Check />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={`Dismiss ${i.title}`} disabled={busy} onClick={() => void decide([i.id], 'dismiss')}>
                <X />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  )

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        {w.config.action?.trashLabel
          ? `Approving a message labelled ${w.config.action.trashLabel} moves it to Trash (it can be put back from the mailbox). Dismissing leaves it where it is.`
          : 'Approving records your decision. Nothing is changed in the source itself.'}
      </p>
      {unsure.length > 0 && group('Needs your eye', 'Under the confidence needed, or the answer couldn’t be read. Choose the right label.', unsure)}
      {proposed.length > 0 &&
        group(
          'Proposed',
          'Sure enough to propose.',
          proposed,
          () =>
            void (async () => {
              // Those left as proposed go in one call; one whose label was changed is a correction, sent on its own.
              const same = proposed.filter((i) => labelOf(i) === i.label).map((i) => i.id)
              if (same.length) await decide(same, 'approve')
              for (const i of proposed.filter((x) => labelOf(x) !== x.label && labelOf(x))) await decide([i.id], 'approve', labelOf(i))
            })(),
        )}
    </div>
  )
}
