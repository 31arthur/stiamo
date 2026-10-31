import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useParams } from 'react-router-dom'
import { Check, CheckCheck, ThumbsUp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { ExecutionItem, ReviewItem } from '@/domain/ai/AgentApi'
import { cn } from '@/lib/utils'
import { EmptyState, Section } from '@/presentation/components/layout'
import { useConfirm } from '@/presentation/components/useConfirm'
import { NotSpamDialog } from './NotSpamDialog'
import { useDecisions } from './useDecisions'
import { useReview, useWorkflow } from './useAgent'

const SELECT = 'h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

/** What the agent proposed, and what it wasn't sure about: approve it, correct the label, or dismiss it. */
export function ReviewTab() {
  const { agentId } = useParams()
  const { data: w } = useWorkflow(agentId)
  const { data: items, isLoading, error } = useReview(agentId)
  /** A label picked in the list, before it is approved. */
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [notSpam, setNotSpam] = useState<ExecutionItem | null>(null)
  const { confirm, dialog } = useConfirm()
  const decideNow = useDecisions(agentId)

  if (isLoading || !w) return <Spinner label="Loading" />
  if (error) return <p role="alert" className="text-sm text-destructive">{error instanceof Error ? error.message : 'Couldn’t load the review queue.'}</p>
  const labels = w.config.labels.map((l) => l.name)
  const trashLabel = w.config.action?.trashLabel
  const keepLabel = w.config.labels.find((l) => l.name !== trashLabel)?.name ?? 'keep'
  const asItem = (i: ReviewItem): ExecutionItem => ({ ...i, at: i.at, decidedAt: null })

  /** Gone from the list at once; the server is told in the background (see useDecisions). */
  const decide = (ids: string[], action: 'approve' | 'dismiss', label?: string) =>
    decideNow([{ ids, label }], action, { moving: action === 'approve' && trashLabel ? ids.filter((id) => (label ?? (items ?? []).find((i) => i.id === id)?.label) === trashLabel).length : 0 })

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

  const approveAll = async (rows: ReviewItem[]) => {
    const moving = trashLabel ? rows.filter((i) => labelOf(i) === trashLabel).length : 0
    if (moving > 0) {
      const yes = await confirm({
        title: 'Move to Trash?',
        highlight: `${moving} email${moving === 1 ? '' : 's'}`,
        description: `Approving these ${rows.length} sends the ones labelled ${trashLabel} to the mailbox’s Trash. They can be put back from there.`,
        confirmLabel: `Move ${moving} to Trash`,
        tone: 'danger',
      })
      if (!yes) return
    }
    // Those left as they were go in one call; one whose label was changed is a correction, sent on its own.
    const same = rows.filter((i) => labelOf(i) === i.label).map((i) => i.id)
    const changed = rows.filter((x) => labelOf(x) !== x.label && labelOf(x))
    void decideNow([{ ids: same }, ...changed.map((i) => ({ ids: [i.id], label: labelOf(i) }))], 'approve', { moving })
  }

  const group = (title: string, hint: string, rows: ReviewItem[], bulk?: boolean) => (
    <Section
      title={`${title} · ${rows.length}`}
      description={hint}
      actions={
        bulk && rows.length > 1 ? (
          <Button variant="outline" size="sm" onClick={() => void approveAll(rows)}>
            <CheckCheck /> Approve all{trashLabel && rows.some((i) => labelOf(i) === trashLabel) ? ` · move ${rows.filter((i) => labelOf(i) === trashLabel).length} to Trash` : ''}
          </Button>
        ) : undefined
      }
      bodyClassName="p-2"
    >
      <ul className="grid">
        <AnimatePresence initial={false}>
        {rows.map((i) => (
          <motion.li key={i.id} layout="position" initial={false} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0, x: 24 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
            <div className="grid gap-2 rounded-xl px-2.5 py-2.5 hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
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
              {trashLabel && i.label === trashLabel && (
                <Button variant="outline" size="xs" onClick={() => setNotSpam(asItem(i))} aria-label={`${i.title} is not spam`}>
                  <ThumbsUp /> Not spam
                </Button>
              )}
              <Button variant="outline" size="icon-sm" title={trashLabel && labelOf(i) === trashLabel ? 'Approve: moves this email to Trash' : 'Approve: keeps this email'} aria-label={`Approve ${i.title}${trashLabel && labelOf(i) === trashLabel ? ', moves it to Trash' : ''}`} disabled={!labelOf(i)} onClick={() => void decide([i.id], 'approve', labelOf(i) !== i.label ? labelOf(i) : undefined)}>
                <Check />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={`Dismiss ${i.title}`} onClick={() => void decide([i.id], 'dismiss')}>
                <X />
              </Button>
            </div>
            </div>
          </motion.li>
        ))}
        </AnimatePresence>
      </ul>
    </Section>
  )

  return (
    <div className="grid gap-4">
      {dialog}
      <NotSpamDialog workflowId={w.id} keepLabel={keepLabel} item={notSpam} pending onClose={() => setNotSpam(null)} />
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
          true,
        )}
    </div>
  )
}
