import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useParams } from 'react-router-dom'
import { Check, CheckCheck, Eye, Search, ThumbsUp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import type { ExecutionItem, ReviewItem } from '@/domain/ai/AgentApi'
import { cn } from '@/lib/utils'
import { EmptyState, Section } from '@/presentation/components/layout'
import { useConfirm } from '@/presentation/components/useConfirm'
import { EmailPreview } from './EmailPreview'
import { SORTS, parseMail, sortItems } from './executions'
import type { SortKey } from './executions'
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
  const [preview, setPreview] = useState<ExecutionItem | null>(null)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortKey>('sure-asc')
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

  const needle = q.trim().toLowerCase()
  const shown = (list: ReviewItem[]) => sortItems(list.filter((i) => !needle || `${i.title} ${i.excerpt} ${i.reason}`.toLowerCase().includes(needle)), sort)

  const group = (title: string, hint: string, all: ReviewItem[]) => {
    const rows = shown(all)
    return (
    <Section
      title={`${title} · ${rows.length}${rows.length !== all.length ? ` of ${all.length}` : ''}`}
      description={hint}
      actions={
        rows.length > 0 ? (
          <>
            <Button variant="ghost" size="sm" onClick={() => void decide(rows.map((i) => i.id), 'dismiss')}>
              <X /> Dismiss all
            </Button>
            <Button variant="outline" size="sm" disabled={!rows.some((i) => labelOf(i))} onClick={() => void approveAll(rows)}>
              <CheckCheck /> Approve all{trashLabel && rows.some((i) => labelOf(i) === trashLabel) ? ` · move ${rows.filter((i) => labelOf(i) === trashLabel).length} to Trash` : ''}
            </Button>
          </>
        ) : undefined
      }
      bodyClassName="p-2"
    >
      <ul className="grid">
        <AnimatePresence initial={false}>
        {rows.map((i) => (
          <motion.li key={i.id} layout="position" initial={false} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0, x: 24 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
            <div className="grid gap-2 rounded-xl px-2.5 py-2.5 hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <button type="button" onClick={() => setPreview(asItem(i))} className="min-w-0 text-left" aria-label={`Preview ${i.title}`}>
              <span className="block truncate text-sm font-medium">{parseMail(i.excerpt).subject || i.title}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {parseMail(i.excerpt).sender || 'Unknown sender'}
                {(i.reason || parseMail(i.excerpt).body) && ` · ${i.reason || parseMail(i.excerpt).body.replace(/\s+/g, ' ')}`}
              </span>
            </button>
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
              <Button variant="ghost" size="icon-sm" aria-label={`Preview ${i.title}`} title="Read the email" onClick={() => setPreview(asItem(i))}>
                <Eye />
              </Button>
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
  }

  return (
    <div className="grid gap-4">
      {dialog}
      <EmailPreview item={preview} folder={w.config.source.folder ?? 'INBOX'} trashed={false} onClose={() => setPreview(null)} />
      <NotSpamDialog workflowId={w.id} keepLabel={keepLabel} item={notSpam} pending onClose={() => setNotSpam(null)} />
      <p className="text-sm text-muted-foreground">
        {w.config.action?.trashLabel
          ? `Approving a message labelled ${w.config.action.trashLabel} moves it to Trash (it can be put back from the mailbox). Dismissing leaves it where it is.`
          : 'Approving records your decision. Nothing is changed in the source itself.'}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search the emails waiting" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-8 w-48 pl-8" />
        </div>
        <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={SELECT}>
          {SORTS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {unsure.length > 0 && group('Needs your eye', 'Under the confidence needed, or the answer couldn’t be read. Choose the right label.', unsure)}
      {proposed.length > 0 &&
        group(
          'Proposed',
          'Sure enough to propose.',
          proposed,
        )}
    </div>
  )
}
