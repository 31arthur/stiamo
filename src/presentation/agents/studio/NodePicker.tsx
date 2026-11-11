import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { FlowCatalogNode } from '@/domain/ai/AgentApi'
import { Button } from '@/components/ui/button'
import { iconOf, toneOf } from './StudioCanvas'

const GROUPS: Record<string, string> = { Triggers: 'How it starts', Flow: 'Flow', Mail: 'Your mail', Contacts: 'Contacts', Work: 'Your work', Messages: 'Messages', AI: 'AI', Output: 'Answer' }

/**
 * The panel that slides in from the right when you press "+": every node you can add, grouped, with a search. When it was opened from the "+" on a
 * node's output, the new node is joined to it.
 */
export function NodePicker({ catalog, after, hasTrigger, onPick, onClose }: { catalog: FlowCatalogNode[]; after?: string; hasTrigger: boolean; onPick: (c: FlowCatalogNode) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => input.current?.focus(), [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return catalog.filter((c) => !t || `${c.label} ${c.description} ${c.type} ${c.group}`.toLowerCase().includes(t))
  }, [catalog, q])
  const groups = [...new Set(shown.map((c) => c.group))]
  // Nothing to join it to and no trigger yet: start with how it starts.
  groups.sort((a, b) => (a === 'Triggers' ? (hasTrigger ? 1 : -1) : b === 'Triggers' ? (hasTrigger ? -1 : 1) : 0))

  return (
    <aside aria-label="Add a node" className="absolute inset-y-0 right-0 z-20 flex w-full max-w-md flex-col border-l bg-background shadow-2xl">
      <div className="flex items-start gap-2 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">{after ? 'What happens next?' : 'Add a node'}</h2>
          <p className="truncate text-xs text-muted-foreground">{after ? `It will follow “${after}”.` : 'Pick a step, then join it on the canvas.'}</p>
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
        {groups.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">No node matches “{q}”.</p>}
        {groups.map((g) => (
          <section key={g} className="mb-2">
            <h3 className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">{GROUPS[g] ?? g}</h3>
            {shown
              .filter((c) => c.group === g)
              .map((c) => {
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
              })}
          </section>
        ))}
      </div>
    </aside>
  )
}
