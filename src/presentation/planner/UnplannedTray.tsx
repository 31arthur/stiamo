import { useState } from 'react'
import type { FormEvent } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { AnimatePresence, motion } from 'motion/react'
import { CornerDownLeft, GripVertical, Inbox, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CalendarItem, CalendarItemType } from '@/domain/calendar/entities/CalendarItem'
import { DEFAULT_DURATION } from '@/domain/planner/dayPlan'
import { formatDuration, ITEM_TYPE_STYLES } from '@/presentation/calendar/itemStyles'
import { spring } from '@/presentation/motion/presets'
import { dragId, TRAY_DROP_ID } from './geometry'

interface UnplannedTrayProps {
  items: CalendarItem[]
  ready: boolean
  /** True while a timeline block is being dragged, so the tray can invite the drop. */
  acceptingBlock: boolean
  onQuickAdd: (title: string, type: CalendarItemType) => Promise<void>
  onDelete: (item: CalendarItem) => void
}

const TYPES = Object.keys(ITEM_TYPE_STYLES) as CalendarItemType[]

export function UnplannedTray({ items, ready, acceptingBlock, onQuickAdd, onDelete }: UnplannedTrayProps) {
  const { setNodeRef, isOver } = useDroppable({ id: TRAY_DROP_ID })
  const [title, setTitle] = useState('')
  const [type, setType] = useState<CalendarItemType>('task')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    await onQuickAdd(title, type)
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
          <motion.span
            key={items.length}
            initial={{ scale: 1.4 }}
            animate={{ scale: 1 }}
            transition={spring.snappy}
            className="rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground tabular-nums"
          >
            {items.length}
          </motion.span>
        </h2>
        <span className="text-[11px] text-muted-foreground">Drag onto the day →</span>
      </header>

      <form onSubmit={submit} className="mx-3 mb-2 flex items-center gap-1 rounded-xl border bg-background px-2 py-1 focus-within:ring-2 focus-within:ring-ring/40">
        <button
          type="button"
          onClick={() => setType(TYPES[(TYPES.indexOf(type) + 1) % TYPES.length])}
          title={`Type: ${ITEM_TYPE_STYLES[type].label} (click to change)`}
          aria-label={`Type: ${ITEM_TYPE_STYLES[type].label}. Click to change`}
          className="flex size-6 shrink-0 items-center justify-center rounded-md hover:bg-muted"
        >
          <motion.span layout className={cn('size-2.5 rounded-full', ITEM_TYPE_STYLES[type].accent)} />
        </button>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={`Quick add a ${ITEM_TYPE_STYLES[type].label.toLowerCase()}…`}
          aria-label="Quick add"
          className="h-7 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <CornerDownLeft className={cn('size-3.5 text-muted-foreground transition-opacity', title ? 'opacity-100' : 'opacity-0')} />
      </form>

      <div className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 pb-3">
        <AnimatePresence initial={false} mode="popLayout">
          {items.map((item) => (
            <TrayCard key={item.id} item={item} onDelete={onDelete} />
          ))}
        </AnimatePresence>
        {ready && items.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="m-auto flex flex-col items-center gap-1 py-8 text-center text-sm text-muted-foreground"
            >
              <span className="font-display text-2xl text-foreground italic">All placed.</span>
              Everything has a time. Drag a block here to unplan it.
            </motion.div>
          )}
      </div>

      <AnimatePresence>
        {acceptingBlock && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-x-3 bottom-3 rounded-xl bg-foreground py-2 text-center text-xs font-medium text-background"
          >
            Drop here to unplan
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

function TrayCard({ item, onDelete }: { item: CalendarItem; onDelete: (item: CalendarItem) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: dragId(item.id), data: { item } })
  const style = ITEM_TYPE_STYLES[item.type]

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
      whileHover={{ y: -1 }}
      className={cn(
        'group/card flex cursor-grab touch-none items-center gap-2 rounded-xl border bg-background px-2.5 py-2 outline-none select-none',
        'transition-shadow hover:shadow-float focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing',
        isDragging && 'border-dashed shadow-none',
      )}
    >
      <GripVertical className="size-3.5 shrink-0 text-muted-foreground/50 group-hover/card:text-muted-foreground" />
      <span className={cn('size-2 shrink-0 rounded-full', style.accent)} />
      <span className={cn('min-w-0 flex-1 truncate text-sm', item.completed && 'text-muted-foreground line-through')}>{item.title}</span>
      <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-medium tabular-nums', style.chip)}>
        {formatDuration(DEFAULT_DURATION[item.type])}
      </span>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onDelete(item)}
        aria-label={`Delete ${item.title}`}
        className="text-muted-foreground opacity-0 transition-opacity group-hover/card:opacity-100 hover:text-foreground focus-visible:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </motion.div>
  )
}
