import { useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { AttentionItem } from '@/domain/ai/AgentApi'
import { WORKSPACES } from '@/domain/shared/workspace'
import { cn } from '@/lib/utils'
import { useScope } from '@/presentation/app/workspaceFilter'
import { EmptyState, PageHeader } from '@/presentation/components/layout'
import { Link } from '@/presentation/routing'
import { AttentionCard } from './AttentionCard'
import { DayPlanCard } from './DayPlanCard'
import { AttentionSheet } from './AttentionSheet'
import { CARD_KINDS, CARD_SORTS, KIND_ORDER, cardKey, countKinds, filterCards, nextCard, sortCards } from './attentionCards'
import type { CardKind, CardSort } from './attentionCards'
import { useAttentionActions } from './useAttentionActions'
import type { AttentionAction } from './useAttentionActions'
import { useAgentAttention, useDayPlans } from './useAgent'

const SELECT = 'h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

/** What your agents found that needs you, as cards: look, open one, decide, and the next one is there. */
export function AttentionPage() {
  const scope = useScope()
  const here = scope === 'all' ? null : WORKSPACES[scope]
  const { data, isLoading, error } = useAgentAttention(scope === 'all' ? undefined : scope)
  const act = useAttentionActions()
  const plans = (useDayPlans().data?.plans ?? []).filter((p) => p.status === 'proposed')
  const [kind, setKind] = useState<CardKind | 'all'>('all')
  const [sort, setSort] = useState<CardSort>('urgent')
  const [openKey, setOpenKey] = useState<string | null>(null)

  const all = data?.items ?? []
  const counts = countKinds(all)
  const shown = sortCards(filterCards(all, kind), sort)
  const open = all.find((i) => cardKey(i) === openKey) ?? null
  const at = open ? shown.findIndex((i) => cardKey(i) === openKey) : -1

  /** Deciding about a card moves on to the next one, so a queue can be cleared in one sitting. */
  function decide(item: AttentionItem, action: AttentionAction, event?: Parameters<typeof act>[2]) {
    const next = openKey === cardKey(item) ? nextCard(shown, item) : null
    setOpenKey(openKey === cardKey(item) ? (next ? cardKey(next) : null) : openKey)
    void act(item, action, event)
  }

  const step = (by: 1 | -1) => {
    if (shown.length === 0) return
    setOpenKey(cardKey(shown[(Math.max(at, 0) + by + shown.length) % shown.length]))
  }

  return (
    <>
      <PageHeader
        eyebrow={here ? here.name : 'All workspaces'}
        title="Attention"
        description="What your agents read and found worth your time: problems, important mail, and meetings or events they could add to your calendar. Open a card to decide. Nothing is added until you say so."
      />
      {plans.length > 0 && (
        <section aria-label="Plans for your approval" className="grid gap-3">
          <AnimatePresence initial={false}>
            {plans.map((p) => (
              <DayPlanCard key={p.id} plan={p} />
            ))}
          </AnimatePresence>
        </section>
      )}
      {isLoading ? (
        <Spinner label="Loading" />
      ) : error ? (
        <p role="alert" className="text-sm text-destructive">{error instanceof Error ? error.message : 'Couldn’t load the queue.'}</p>
      ) : all.length === 0 && plans.length > 0 ? null : all.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed">
          <EmptyState
            title="Nothing needs you"
            action={
              <Button variant="outline" nativeButton={false} render={<Link to="/agents/new" />}>
                <Inbox /> Set up a mail agent
              </Button>
            }
          >
            When an agent reads your mail and finds a problem, something important, or a meeting with a date, it appears here as a card.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div role="tablist" aria-label="Kind" className="flex flex-wrap gap-1.5">
              {([['all', 'All', all.length] as const, ...KIND_ORDER.filter((k) => counts[k] > 0).map((k) => [k, CARD_KINDS[k].plural, counts[k]] as const)]).map(([k, label, n]) => (
                <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={cn('rounded-full border px-3 py-1 text-sm transition-colors', kind === k ? 'border-foreground/40 bg-background font-medium shadow-float' : 'text-muted-foreground hover:border-foreground/30 hover:text-foreground')}>
                  {label} <span className="tabular-nums text-muted-foreground">{n}</span>
                </button>
              ))}
            </div>
            <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as CardSort)} className={cn(SELECT, 'ml-auto')}>
              {CARD_SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {shown.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nothing of that kind is waiting.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <AnimatePresence initial={false}>
                {shown.map((i) => (
                  <AttentionCard key={cardKey(i)} item={i} selected={cardKey(i) === openKey} onOpen={() => setOpenKey(cardKey(i))} onQuick={(a) => decide(i, a)} />
                ))}
              </AnimatePresence>
            </ul>
          )}
        </>
      )}
      <AttentionSheet item={open} position={at + 1} total={shown.length} onClose={() => setOpenKey(null)} onStep={step} onDecide={decide} />
    </>
  )
}
