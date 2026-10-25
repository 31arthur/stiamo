import { useState } from 'react'
import type { FormEvent } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { AnimatePresence, motion } from 'motion/react'
import { CornerDownLeft, GripVertical, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgendaEntry } from '@/domain/agenda/agenda'
import type { OutcomeTarget } from '@/domain/shared/RecordOutcomeUseCase'
import { formatDuration } from '@/domain/shared/time'
import type { WorkspaceId } from '@/domain/shared/workspace'
import { WORKSPACES } from '@/domain/shared/workspace'
import { entryIcon } from '@/presentation/components/kinds'
import { OutcomeControl } from '@/presentation/components/outcome'
import { WS_STYLE, WorkspaceDot } from '@/presentation/components/workspace'
import { spring } from '@/presentation/motion/presets'
import { dragId, TRAY_DROP_ID } from './geometry'

interface UnplannedTrayProps {
  /** Due on this day but without a time. */
  entries: AgendaEntry[]
  /** Overdue tasks from earlier days that can be pulled onto this day. */
  carryOver: AgendaEntry[]
  ready: boolean
  /** True while a timeline block is being dragged, so the tray can invite the drop. */
  acceptingBlock: boolean
  quickAddWorkspace: WorkspaceId
  onQuickAdd: (title: string) => Promise<unknown>
  onOpen: (entry: AgendaEntry) => void
}

export function UnplannedTray({ entries, carryOver, ready, acceptingBlock, quickAddWorkspace, onQuickAdd, onOpen }: UnplannedTrayProps) {
  const { setNodeRef, isOver } = useDroppable({ id: TRAY_DROP_ID })
  const [title, setTitle] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    await onQuickAdd(title.trim())
    setTitle('')
  }

  return (
    <section
      ref={setNodeRef}
      aria-label="Unplanned items"
      className={cn(
        'relative flex min-h-0 flex-1 flex-col rounded-2xl border bg-card/70 backdrop-blur transition-[box-shadow,background-color]',
        acceptingBlock && 'border-dashed',
        isOver && acceptingBlock && 'bg-muted/60 ring-2 ring-foreground/20',
      )}
    >
      <header className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Inbox className="size-4 text-muted-foreground" /> Unplanned
          <motion.span key={entries.length} initial={{ scale: 1.4 }} animate={{ scale: 1 }} transition={spring.snappy} className="rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground tabular-nums">
            {entries.length}
          </motion.span>
        </h2>
        <span className="text-[11px] text-muted-foreground">Drag onto the day →</span>
      </header>

      <form onSubmit={submit} className="mx-3 mb-2 flex items-center gap-2 rounded-xl border bg-background px-2.5 py-1 focus-within:ring-2 focus-within:ring-ring/40">
        <WorkspaceDot ws={quickAddWorkspace} />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={`Quick add a ${WORKSPACES[quickAddWorkspace].short} task…`}
          aria-label="Quick add task"
          className="h-7 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <CornerDownLeft className={cn('size-3.5 text-muted-foreground transition-opacity', title ? 'opacity-100' : 'opacity-0')} />
      </form>

      <div className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 pb-3">
        <AnimatePresence initial={false} mode="popLayout">
          {entries.map((e) => (
            <TrayCard key={e.key} entry={e} onOpen={onOpen} />
          ))}
        </AnimatePresence>
        {ready && entries.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex flex-col items-center gap-1 py-6 text-center text-sm text-muted-foreground">
            <span className="font-display text-2xl text-foreground italic">All placed.</span>
            Drag a block here to take it off the timeline.
          </motion.div>
        )}
        {carryOver.length > 0 && (
          <>
            <div className="mt-2 px-1 text-[10px] font-semibold tracking-widest text-destructive uppercase">Overdue — pull into this day</div>
            <AnimatePresence initial={false} mode="popLayout">
              {carryOver.map((e) => (
                <TrayCard key={e.key} entry={e} onOpen={onOpen} overdue />
              ))}
            </AnimatePresence>
          </>
        )}
      </div>

      <AnimatePresence>
        {acceptingBlock && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-x-3 bottom-3 rounded-xl bg-foreground py-2 text-center text-xs font-medium text-background">
            Drop here to take it off the timeline
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

function TrayCard({ entry, onOpen, overdue }: { entry: AgendaEntry; onOpen: (e: AgendaEntry) => void; overdue?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: dragId(entry.key), data: { entry } })
  const Icon = entryIcon(entry)
  const ws = WS_STYLE[entry.workspace]

  return (
    <motion.div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      layout
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: isDragging ? 0.4 : 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
      transition={spring.soft}
      className={cn(
        'group/card flex cursor-grab touch-manipulation items-center gap-2 rounded-xl border bg-background px-2 py-1.5 outline-none select-none',
        'transition-shadow hover:shadow-float focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing',
        isDragging && 'border-dashed shadow-none',
        overdue && 'border-destructive/30',
      )}
    >
      <GripVertical className="size-3.5 shrink-0 text-muted-foreground/40 group-hover/card:text-muted-foreground" />
      <span onPointerDown={(e) => e.stopPropagation()} className="contents">
        <OutcomeControl target={entry.kind as OutcomeTarget} id={entry.ref.id} outcome={entry.outcome} size="sm" />
      </span>
      <Icon className={cn('size-3.5 shrink-0', ws.text)} />
      <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => onOpen(entry)} className="min-w-0 flex-1 truncate text-left text-sm hover:underline">
        {entry.title}
      </button>
      <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-medium tabular-nums', ws.soft, ws.text)}>{formatDuration(entry.duration)}</span>
    </motion.div>
  )
}
