import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Bot, Boxes, ChevronRight, GitBranch, MessageSquare, Search, Shuffle, Zap, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { FlowCatalogNode } from '@/domain/ai/AgentApi'
import { Button } from '@/components/ui/button'
import { iconOf, toneOf } from './StudioCanvas'

interface Category {
  id: string
  label: string
  description: string
  icon: LucideIcon
  has: (type: string) => boolean
}

/** What the panel offers first, as n8n's does: a few kinds of thing, each with a line on what it is for. A node belongs to the first that claims it. */
const CATEGORIES: Category[] = [
  { id: 'ai', label: 'AI', description: 'Let a model think, sort or read for you, with the tools you give it.', icon: Bot, has: (t) => t.startsWith('ai.') },
  { id: 'data', label: 'Your data', description: 'Read your mail, contacts, tasks, cases, calendar and Drive.', icon: Boxes, has: (t) => t.startsWith('data.') },
  { id: 'transform', label: 'Data transformation', description: 'Change, filter, sort, limit or combine the items that pass through.', icon: Shuffle, has: (t) => ['core.set', 'core.filter', 'core.sort', 'core.limit', 'core.split_out', 'core.aggregate', 'core.safe_senders', 'core.only_new'].includes(t) },
  { id: 'flow', label: 'Flow', description: 'Branch, merge or loop the flow, and stop it on a problem.', icon: GitBranch, has: (t) => t.startsWith('core.') },
  { id: 'action', label: 'Send and act', description: 'Message your phone, draft an email, move mail to Trash, propose an event, add to Attention.', icon: MessageSquare, has: (t) => t.startsWith('msg.') || t === 'respond' },
]
const TRIGGERS: Category = { id: 'triggers', label: 'Triggers', description: 'What starts the workflow: a message, a schedule, a click.', icon: Zap, has: (t) => t.startsWith('trigger.') }

/**
 * The panel that slides in from the right when you press "+", laid out the way n8n's is: kinds of node first, each with what it is for; open one to
 * see its nodes (the popular ones, then the rest); or type to search them all. When it was opened from the "+" on a node's output, the new node is
 * joined to it. With no trigger yet, "Add a trigger" comes first.
 */
export function NodePicker({ catalog, after, hasTrigger, onPick, onClose }: { catalog: FlowCatalogNode[]; after?: string; hasTrigger: boolean; onPick: (c: FlowCatalogNode) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => input.current?.focus(), [open])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (open && !q) setOpen(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, open, q])

  const categories = hasTrigger || after ? CATEGORIES : [TRIGGERS, ...CATEGORIES]
  const all = useMemo(() => [TRIGGERS, ...CATEGORIES], [])
  const of = (c: FlowCatalogNode) => all.find((k) => k.has(c.type))?.id ?? 'flow'
  const term = q.trim().toLowerCase()
  const searching = term.length > 0
  const category = open ? all.find((k) => k.id === open) : undefined
  const shown = useMemo(() => {
    const matches = (c: FlowCatalogNode) => !term || `${c.label} ${c.description} ${c.type}`.toLowerCase().includes(term)
    return catalog.filter((c) => matches(c) && (searching || !open || of(c) === open))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, term, open, searching])
  const counts = (k: Category) => catalog.filter((c) => of(c) === k.id).length

  const row = (c: FlowCatalogNode) => {
    const Icon = iconOf(c.type)
    return (
      <button key={c.type} type="button" onClick={() => onPick(c)} className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border bg-card">
          <Icon className={`size-4.5 ${toneOf(c.type)}`} strokeWidth={1.7} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium">{c.label}</span>
          <span className="block text-xs leading-snug text-muted-foreground">{c.description}</span>
        </span>
      </button>
    )
  }

  return (
    <aside aria-label="Add a node" className="absolute inset-y-0 right-0 z-20 flex w-full max-w-md flex-col border-l bg-background shadow-2xl">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        {category && !searching ? (
          <Button variant="ghost" size="icon-sm" aria-label="Back to the kinds of node" onClick={() => setOpen(null)}>
            <ArrowLeft />
          </Button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-1.5 text-base font-semibold">
            {category && !searching && <category.icon className="size-4 text-muted-foreground" />}
            {searching ? 'Search results' : category ? category.label : after ? 'What happens next?' : hasTrigger ? 'Add a node' : 'What starts it?'}
          </h2>
          <p className="truncate text-xs text-muted-foreground">{after && !category ? `It will follow “${after}”.` : category && !searching ? category.description : ' '}</p>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
          <X />
        </Button>
      </div>
      <div className="relative border-b px-4 py-3">
        <Search className="pointer-events-none absolute top-1/2 left-7 size-4 -translate-y-1/2 text-muted-foreground" />
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search nodes…" aria-label="Search nodes" className="h-9 w-full rounded-lg border border-input bg-transparent pr-3 pl-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {searching || category ? (
          shown.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No node matches “{q}”.</p>
          ) : (
            <div>{shown.map(row)}</div>
          )
        ) : (
          <ul>
            {categories.map((k) => (
              <li key={k.id}>
                <button type="button" onClick={() => setOpen(k.id)} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none">
                  <k.icon className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.6} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{k.label}</span>
                    <span className="block text-xs leading-snug text-muted-foreground">{k.description}</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">{counts(k)}</span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
            {hasTrigger && !after && (
              <li>
                <button type="button" onClick={() => setOpen('triggers')} className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  <Zap className="size-5 shrink-0" strokeWidth={1.6} /> Add another trigger
                  <ChevronRight className="ml-auto size-4" />
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    </aside>
  )
}
