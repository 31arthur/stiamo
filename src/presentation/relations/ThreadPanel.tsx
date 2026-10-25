import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { AnimatePresence, motion } from 'motion/react'
import { CalendarClock, ChevronRight, CircleDot, FilePlus2, Link2, MessageSquareText, Pencil, Plus, Sparkles, Trash2, Unlink, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Activity, ActivityAction } from '@/domain/activity/Activity'
import { RELATION_LABELS, refKey } from '@/domain/relations/graph'
import type { ThreadNode } from '@/domain/relations/graph'
import type { EntityRef } from '@/domain/shared/types'
import { useEditor } from '@/presentation/app/create'
import { Segmented } from '@/presentation/components/form'
import { OutcomeBadge } from '@/presentation/components/outcome'
import type { RecordInfo } from '@/presentation/components/records'
import { useRecordLookup } from '@/presentation/components/records'
import { WS_STYLE } from '@/presentation/components/workspace'
import { useAction, useEntities, useGraph } from '@/presentation/data/hooks'
import { spring } from '@/presentation/motion/presets'
import { LinkPicker } from './LinkPicker'

const ACTION_STYLE: Record<ActivityAction, { icon: LucideIcon; tone: string }> = {
  created: { icon: Sparkles, tone: 'bg-ws-sb-soft text-ws-sb' },
  updated: { icon: Pencil, tone: 'bg-muted text-muted-foreground' },
  outcome: { icon: CircleDot, tone: 'bg-success/12 text-success' },
  scheduled: { icon: CalendarClock, tone: 'bg-ws-fsa-soft text-ws-fsa' },
  deleted: { icon: Trash2, tone: 'bg-destructive/10 text-destructive' },
  linked: { icon: Link2, tone: 'bg-ws-media-soft text-ws-media' },
  unlinked: { icon: Unlink, tone: 'bg-muted text-muted-foreground' },
  attached: { icon: FilePlus2, tone: 'bg-ws-personal-soft text-ws-personal' },
  detached: { icon: X, tone: 'bg-muted text-muted-foreground' },
  note: { icon: MessageSquareText, tone: 'bg-foreground text-background' },
}

/**
 * Everything connected to a record — what it belongs to, what came out of it, what's linked — and
 * the merged history of that whole thread, with notes.
 */
export function ThreadPanel({ root, className }: { root: EntityRef; className?: string }) {
  const graph = useGraph()
  const { lookup } = useRecordLookup()
  const thread = useMemo(() => graph.thread(root), [graph, root])
  const self = lookup(root)

  return (
    <div className={cn('grid gap-4', className)}>
      <Structure root={root} thread={thread} self={self} lookup={lookup} />
      <History root={root} members={thread.members} rootTitle={self?.title ?? ''} lookup={lookup} />
    </div>
  )
}

function Structure({ root, thread, self, lookup }: { root: EntityRef; thread: ReturnType<ReturnType<typeof useGraph>['thread']>; self?: RecordInfo; lookup: (r?: EntityRef) => RecordInfo | undefined }) {
  const [picking, setPicking] = useState(false)
  const link = useAction<RecordInfo, unknown>((s, userId, target) => s.links.link(userId, root, target.ref, { a: self?.title ?? '', b: target.title }), { success: 'Linked' })
  const unlink = useAction<{ linkId: string; other: string }, void>((s, userId, a) => s.links.unlink(userId, a.linkId, { a: self?.title ?? '', b: a.other }), { success: 'Unlinked' })

  return (
    <section className="grid gap-3">
      {thread.ancestors.length > 0 && (
        <div className="grid gap-1.5">
          <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Part of</div>
          <div className="flex flex-wrap gap-1.5">
            {thread.ancestors.map((a) => {
              const info = lookup(a.ref)
              return info ? <RecordPill key={refKey(a.ref)} info={info} label={RELATION_LABELS[a.kind]} /> : null
            })}
          </div>
        </div>
      )}

      <div className="grid gap-1.5">
        <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Thread</div>
        {thread.tree.children.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing has branched off this yet. Further actions, steps, hearings and follow-ups will appear here.</p>
        ) : (
          <ul className="grid gap-0.5">
            {thread.tree.children.map((n) => (
              <TreeNode key={refKey(n.ref)} node={n} depth={0} lookup={lookup} />
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Linked</div>
          <Button variant="ghost" size="xs" onClick={() => setPicking(true)}>
            <Plus /> Link record
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <AnimatePresence initial={false}>
            {thread.peers.map((p) => {
              const info = lookup(p.ref)
              if (!info) return null
              return (
                <motion.span key={refKey(p.ref)} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={spring.snappy} className="inline-flex">
                  <RecordPill info={info} onRemove={() => p.linkId && unlink.run({ linkId: p.linkId, other: info.title })} />
                </motion.span>
              )
            })}
          </AnimatePresence>
          {thread.peers.length === 0 && <p className="text-sm text-muted-foreground">Link any related case, meeting, hearing, plan, goal or task.</p>}
        </div>
      </div>

      <LinkPicker open={picking} onOpenChange={setPicking} from={root} exclude={[...thread.peers.map((p) => p.ref), ...thread.ancestors.map((a) => a.ref)]} onPick={(t) => link.run(t)} />
    </section>
  )
}

function TreeNode({ node, depth, lookup }: { node: ThreadNode; depth: number; lookup: (r?: EntityRef) => RecordInfo | undefined }) {
  const info = lookup(node.ref)
  const { openRef } = useEditor()
  const [open, setOpen] = useState(depth < 1)
  if (!info) return null
  const hasChildren = node.children.length > 0
  return (
    <li className="relative">
      <div className="group flex items-center gap-1.5 rounded-lg py-1 pr-1 hover:bg-muted/50" style={{ paddingLeft: depth * 16 }}>
        <button type="button" aria-label={open ? 'Collapse' : 'Expand'} onClick={() => setOpen(!open)} className={cn('flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground', !hasChildren && 'invisible')}>
          <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} />
        </button>
        <span className={cn('size-1.5 shrink-0 rounded-full', info.workspace ? WS_STYLE[info.workspace].dot : 'bg-muted-foreground')} />
        <info.icon className="size-3.5 shrink-0 text-muted-foreground" />
        <button type="button" onClick={() => openRef(node.ref)} className="min-w-0 flex-1 truncate text-left text-sm hover:underline">
          {info.title}
        </button>
        {node.kind && <span className="hidden shrink-0 text-[10px] text-muted-foreground sm:inline">{RELATION_LABELS[node.kind]}</span>}
        {info.outcome && info.outcome.status !== 'open' && <OutcomeBadge outcome={info.outcome} className="shrink-0" />}
      </div>
      <AnimatePresence initial={false}>
        {open && hasChildren && (
          <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-l border-dashed" style={{ marginLeft: depth * 16 + 10 }}>
            {node.children.map((c) => (
              <TreeNode key={refKey(c.ref)} node={c} depth={depth + 1} lookup={lookup} />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </li>
  )
}

export function RecordPill({ info, label, onRemove }: { info: RecordInfo; label?: string; onRemove?: () => void }) {
  const { openRef } = useEditor()
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-lg border bg-background/70 py-0.5 pr-1 pl-1.5 text-xs">
      <info.icon className="size-3.5 shrink-0 text-muted-foreground" />
      {label && <span className="text-muted-foreground">{label}:</span>}
      <button type="button" onClick={() => openRef(info.ref)} className="max-w-56 truncate font-medium hover:underline">
        {info.title}
      </button>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Unlink ${info.title}`} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-destructive">
          <X className="size-3" />
        </button>
      )}
    </span>
  )
}

function History({ root, members, rootTitle, lookup }: { root: EntityRef; members: EntityRef[]; rootTitle: string; lookup: (r?: EntityRef) => RecordInfo | undefined }) {
  const { data: activity } = useEntities('activity')
  const [scope, setScope] = useState<'thread' | 'self'>('thread')
  const [note, setNote] = useState('')
  const addNote = useAction<string, void>((s, userId, text) => s.links.addNote(userId, root, rootTitle, text), { success: 'Note added' })

  const items = useMemo(() => {
    const keys = new Set((scope === 'self' ? [root] : members).map(refKey))
    return activity.filter((a) => keys.has(refKey(a.ref))).sort((a, b) => b.at.localeCompare(a.at))
  }, [activity, members, root, scope])

  const groups = useMemo(() => {
    const map = new Map<string, Activity[]>()
    for (const a of items) {
      const day = a.at.slice(0, 10)
      map.set(day, [...(map.get(day) ?? []), a])
    }
    return [...map.entries()]
  }, [items])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!note.trim()) return
    await addNote.run(note)
    setNote('')
  }

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">History</div>
        <Segmented size="sm" label="History scope" value={scope} onChange={setScope} options={[{ value: 'thread', label: 'Whole thread' }, { value: 'self', label: 'This record' }]} />
      </div>
      <form onSubmit={submit} className="flex items-end gap-2 rounded-xl border bg-background/70 p-2 focus-within:ring-2 focus-within:ring-ring/30">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e)
          }}
          rows={1}
          placeholder="Add a note to this thread — a call summary, a decision…"
          className="field-sizing-content max-h-40 min-h-8 flex-1 resize-none bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted-foreground"
        />
        <Button type="submit" size="sm" disabled={!note.trim() || addNote.pending}>
          Add
        </Button>
      </form>
      {groups.length === 0 && <p className="text-sm text-muted-foreground">No history yet.</p>}
      <ol className="grid gap-4">
        {groups.map(([day, list]) => (
          <li key={day}>
            <div className="mb-2 text-xs font-medium text-muted-foreground">{dayLabel(day)}</div>
            <ol className="relative grid gap-3 pl-5 before:absolute before:top-1 before:bottom-1 before:left-[9px] before:w-px before:bg-border">
              {list.map((a) => (
                <ActivityItem key={a.id} activity={a} showRecord={refKey(a.ref) !== refKey(root)} lookup={lookup} />
              ))}
            </ol>
          </li>
        ))}
      </ol>
    </section>
  )
}

function ActivityItem({ activity: a, showRecord, lookup }: { activity: Activity; showRecord: boolean; lookup: (r?: EntityRef) => RecordInfo | undefined }) {
  const [open, setOpen] = useState(false)
  const style = ACTION_STYLE[a.action]
  const record = lookup(a.ref)
  const related = lookup(a.related)
  const expandable = (a.changes?.length ?? 0) > 1 || a.changes?.some((c) => (c.to?.length ?? 0) > 50)
  return (
    <motion.li layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="relative">
      <span className={cn('absolute top-0.5 -left-5 flex size-[18px] items-center justify-center rounded-full ring-4 ring-card', style.tone)}>
        <style.icon className="size-2.5" />
      </span>
      <div className="min-w-0 text-sm">
        {showRecord && (
          <div className="mb-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            {record && <record.icon className="size-3" />}
            <span className="truncate">{record?.title ?? a.title}</span>
          </div>
        )}
        <div className={cn(a.action === 'note' && 'rounded-lg bg-muted/60 px-2.5 py-1.5 whitespace-pre-line')}>
          {a.summary}
          {related && a.action !== 'note' && <span className="text-muted-foreground"> · {related.title}</span>}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="tabular-nums">{format(parseISO(a.at), 'HH:mm')}</span>
          {expandable && (
            <button type="button" onClick={() => setOpen(!open)} className="hover:text-foreground">
              {open ? 'Hide details' : 'Details'}
            </button>
          )}
        </div>
        <AnimatePresence initial={false}>
          {open && a.changes && (
            <motion.dl initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-1.5 grid gap-1 overflow-hidden rounded-lg border p-2 text-xs">
              {a.changes.map((c, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,7rem)_1fr] gap-2">
                  <dt className="truncate text-muted-foreground">{c.field}</dt>
                  <dd className="min-w-0 break-words">
                    {c.from && c.from !== '—' && <span className="text-muted-foreground line-through">{c.from}</span>} {c.to}
                  </dd>
                </div>
              ))}
            </motion.dl>
          )}
        </AnimatePresence>
      </div>
    </motion.li>
  )
}

function dayLabel(day: string) {
  const d = parseISO(day)
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'EEE d MMM yyyy')
}
