import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { AnimatePresence, motion } from 'motion/react'
import { useParams } from 'react-router-dom'
import { ArrowLeft, Check, CheckCheck, Eye, Search, ThumbsUp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import type { ExecutionItem, LedgerStatus } from '@/domain/ai/AgentApi'
import { cn } from '@/lib/utils'
import { Section } from '@/presentation/components/layout'
import { useConfirm } from '@/presentation/components/useConfirm'
import { Link } from '@/presentation/routing'
import { EmailPreview } from './EmailPreview'
import { NotSpamDialog } from './NotSpamDialog'
import { useDecisions } from './useDecisions'
import { GROUPS, SORTS, parseMail, sortItems } from './executions'
import type { SortKey } from './executions'
import { formatMs } from './format'
import { Stat } from './TestResults'
import { useExecution, useWorkflow } from './useAgent'

const SELECT = 'h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

const STATUS_CHIP: Record<LedgerStatus, { text: string; tone: string }> = {
  needs_review: { text: 'Needs review', tone: 'bg-warning/15 text-warning' },
  proposed: { text: 'Waiting to move', tone: 'bg-warning/15 text-warning' },
  applied: { text: 'Moved to Trash', tone: 'bg-success/12 text-success' },
  approved: { text: 'Approved', tone: 'bg-success/12 text-success' },
  dismissed: { text: 'Dismissed', tone: 'bg-muted text-muted-foreground' },
  kept: { text: 'Kept', tone: 'bg-muted text-muted-foreground' },
  protected: { text: 'Protected', tone: 'bg-muted text-muted-foreground' },
}

/** One run of the agent: what it read, and every email it decided about, grouped so what needs you comes first. */
export function ExecutionPage() {
  const { agentId, runId } = useParams()
  const { data: w } = useWorkflow(agentId)
  const { data, isLoading, error } = useExecution(agentId, runId)
  const [chosen, setChosen] = useState<LedgerStatus | null>(null)
  const [sort, setSort] = useState<SortKey>('sure-asc')
  const [q, setQ] = useState('')
  /** A label picked in the list, before it is approved. */
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<ExecutionItem | null>(null)
  const [notSpam, setNotSpam] = useState<ExecutionItem | null>(null)
  const { confirm, dialog } = useConfirm()
  const decideNow = useDecisions(agentId)

  if (isLoading || !w) return <Spinner label="Loading" />
  if (error || !data) return <p role="alert" className="text-sm text-destructive">{error instanceof Error ? error.message : 'Couldn’t load that run.'}</p>

  const { execution: e, items } = data
  const labels = w.config.labels.map((l) => l.name)
  const trashLabel = w.config.action?.trashLabel
  const folder = w.config.source.folder ?? 'INBOX'
  const keepLabel = w.config.labels.find((l) => l.name !== trashLabel)?.name ?? 'keep'
  /** Judged spam (or waiting to be), so "not spam" is a correction worth learning from. */
  const canCorrect = (i: ExecutionItem) => !!trashLabel && i.label === trashLabel && ['needs_review', 'proposed', 'applied'].includes(i.status)
  const isTrashed = (i: ExecutionItem) => i.status === 'applied' || (i.status === 'approved' && !!trashLabel && i.label === trashLabel)

  const counts = new Map<LedgerStatus, number>()
  for (const i of items) counts.set(i.status, (counts.get(i.status) ?? 0) + 1)
  const groups = GROUPS.filter((g) => counts.get(g.status))
  const active = groups.find((g) => g.status === chosen) ?? groups[0]
  const needle = q.trim().toLowerCase()
  const rows = sortItems(
    items.filter((i) => i.status === active?.status && (!needle || `${i.title} ${i.excerpt} ${i.reason}`.toLowerCase().includes(needle))),
    sort,
  )
  const labelOf = (i: ExecutionItem) => picked[i.id] ?? i.label ?? ''
  const s = e.stats

  /** Gone from the list at once; the server is told in the background (see useDecisions). */
  const decide = (ids: string[], action: 'approve' | 'dismiss', label?: string) =>
    decideNow([{ ids, label }], action, { moving: action === 'approve' && trashLabel ? ids.filter((id) => (label ?? items.find((i) => i.id === id)?.label) === trashLabel).length : 0 })

  /** How many of these approvals would move an email to Trash: approving a row labelled with the trash label does exactly that. */
  const willMove = (list: ExecutionItem[]) => (trashLabel ? list.filter((i) => labelOf(i) === trashLabel).length : 0)

  async function approveShown() {
    const moving = willMove(rows)
    if (moving > 0) {
      const yes = await confirm({
        title: 'Move to Trash?',
        highlight: `${moving} email${moving === 1 ? '' : 's'}`,
        description: `Approving these ${rows.length} sends the ${moving === rows.length ? 'ones' : `${moving} labelled ${trashLabel}`} to the mailbox’s Trash. They can be put back from there.`,
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

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" nativeButton={false} render={<Link to={`/agents/${agentId}/executions`} />}>
          <ArrowLeft /> Executions
        </Button>
        <h2 className="text-sm font-semibold">{format(parseISO(e.startedAt), 'd MMM yyyy, p')}</h2>
        <span className="text-xs text-muted-foreground">{formatMs(e.durationMs)}</span>
      </div>
      <p className="text-sm text-muted-foreground">{e.summary}</p>
      {e.error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">{e.error}</p>}

      <dl className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 xl:grid-cols-8">
        <Stat label="In range" value={`${s.inRange ?? '—'}`} hint="Emails in the dates chosen" />
        <Stat label="Read" value={`${s.scanned ?? '—'}`} />
        <Stat label="Protected" value={`${s.protected ?? e.counts.protected ?? 0}`} hint="Kept by your rules, not judged" />
        <Stat label="Judged" value={`${s.judged ?? e.counts.items ?? 0}`} />
        <Stat label="Requests" value={`${s.requests ?? '—'}`} hint={s.batchSize && s.batchSize > 1 ? `Up to ${s.batchSize} per request` : undefined} />
        <Stat label="Model" value={s.model || '—'} hint={s.provider} />
        <Stat label="Cost" value={s.cost ? `$${s.cost.toFixed(s.cost < 0.01 ? 5 : 3)}` : '—'} />
        <Stat label="Still to go" value={`${s.remaining ?? 0}`} hint="Run again to carry on" />
      </dl>

      {groups.length === 0 ? (
        <Section>
          <p className="py-6 text-center text-sm text-muted-foreground">Nothing was decided in this run.</p>
        </Section>
      ) : (
        <Section
          title={active ? `${active.title} · ${rows.length}${rows.length !== (counts.get(active.status) ?? 0) ? ` of ${counts.get(active.status)}` : ''}` : undefined}
          description={active?.hint}
          actions={
            active?.pending && rows.length > 0 ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => void decide(rows.map((i) => i.id), 'dismiss')}>
                  <X /> Dismiss all
                </Button>
                <Button variant="outline" size="sm" disabled={!rows.some((i) => labelOf(i))} onClick={() => void approveShown()}>
                  <CheckCheck /> Approve all{willMove(rows) > 0 ? ` · move ${willMove(rows)} to Trash` : ''}
                </Button>
              </>
            ) : undefined
          }
          bodyClassName="p-2"
        >
          <div className="mb-2 flex flex-wrap items-center gap-2 px-1">
            <div role="tablist" aria-label="Groups" className="flex flex-wrap gap-1.5">
              {groups.map((g) => (
                <button
                  key={g.status}
                  type="button"
                  role="tab"
                  aria-selected={active?.status === g.status}
                  onClick={() => setChosen(g.status)}
                  className={cn('rounded-full border px-3 py-1 text-sm transition-colors', active?.status === g.status ? 'border-foreground/40 bg-background font-medium shadow-float' : 'text-muted-foreground hover:border-foreground/30 hover:text-foreground')}
                >
                  {g.title} <span className="tabular-nums text-muted-foreground">{counts.get(g.status)}</span>
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input aria-label="Search these emails" value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="Search" className="h-8 w-40 pl-8" />
              </div>
              <select aria-label="Sort" value={sort} onChange={(ev) => setSort(ev.target.value as SortKey)} className={SELECT}>
                {SORTS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{needle ? `Nothing here matches “${q}”.` : 'Nothing here.'}</p>
          ) : (
            <ul className="grid">
              <AnimatePresence initial={false}>
              {rows.map((i) => {
                const m = parseMail(i.excerpt)
                const chip = STATUS_CHIP[i.status]
                return (
                  <motion.li key={i.id} layout="position" initial={false} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0, x: 24 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
                    <div className="grid gap-2 rounded-xl px-2.5 py-2.5 hover:bg-muted/40 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                    <button type="button" onClick={() => setPreview(i)} className="min-w-0 text-left" aria-label={`Preview ${m.subject || i.title}`}>
                      <span className="block truncate text-sm font-medium">{m.subject || i.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {m.sender || 'Unknown sender'}
                        {(i.reason || m.body) && ` · ${i.reason || m.body.replace(/\s+/g, ' ')}`}
                      </span>
                    </button>
                    <div className="flex flex-wrap items-center gap-1.5 md:flex-nowrap">
                      {i.label && i.status !== 'protected' && (
                        <span className="w-9 text-right text-[11px] text-muted-foreground tabular-nums" title={`${Math.round(i.confidence * 100)}% sure`}>
                          {Math.round(i.confidence * 100)}%
                        </span>
                      )}
                      {active?.pending ? (
                        <select value={labelOf(i)} onChange={(ev) => setPicked((p) => ({ ...p, [i.id]: ev.target.value }))} aria-label={`Label for ${m.subject || i.title}`} className={SELECT}>
                          {!labelOf(i) && <option value="">Choose…</option>}
                          {labels.map((l) => (
                            <option key={l} value={l}>
                              {l}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <>
                          {i.label && <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium">{i.label}</span>}
                          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap', chip.tone)}>{chip.text}</span>
                        </>
                      )}
                      {canCorrect(i) && (
                        <Button variant="outline" size="xs" onClick={() => setNotSpam(i)} aria-label={`${m.subject || i.title} is not spam`}>
                          <ThumbsUp /> Not spam
                        </Button>
                      )}
                      <Button variant="ghost" size="icon-sm" aria-label={`Preview ${m.subject || i.title}`} title={isTrashed(i) ? 'See what was kept of it' : 'Read the email'} onClick={() => setPreview(i)}>
                        <Eye />
                      </Button>
                      {active?.pending && (
                        <>
                          <Button variant="outline" size="icon-sm" title={trashLabel && labelOf(i) === trashLabel ? 'Approve: moves this email to Trash' : 'Approve: keeps this email'} aria-label={`Approve ${m.subject || i.title}${trashLabel && labelOf(i) === trashLabel ? ', moves it to Trash' : ''}`} disabled={!labelOf(i)} onClick={() => void decide([i.id], 'approve', labelOf(i) !== i.label ? labelOf(i) : undefined)}>
                            <Check />
                          </Button>
                          <Button variant="ghost" size="icon-sm" aria-label={`Dismiss ${m.subject || i.title}`} onClick={() => void decide([i.id], 'dismiss')}>
                            <X />
                          </Button>
                        </>
                      )}
                    </div>
                    </div>
                  </motion.li>
                )
              })}
              </AnimatePresence>
            </ul>
          )}
        </Section>
      )}

      {dialog}
      <NotSpamDialog workflowId={w.id} keepLabel={keepLabel} item={notSpam} pending={!!notSpam && ['needs_review', 'proposed'].includes(notSpam.status)} onClose={() => setNotSpam(null)} />
      <EmailPreview item={preview} folder={folder} trashed={!!preview && isTrashed(preview)} onClose={() => setPreview(null)} />
    </div>
  )
}
