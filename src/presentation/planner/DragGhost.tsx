import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import type { AgendaEntry } from '@/domain/agenda/agenda'
import { entryIcon } from '@/presentation/components/kinds'
import { WS_STYLE } from '@/presentation/components/workspace'
import { spring } from '@/presentation/motion/presets'

/** The lifted card that follows the pointer while dragging. */
export function DragGhost({ entry, overTimeline }: { entry: AgendaEntry; overTimeline: boolean }) {
  const ws = WS_STYLE[entry.workspace]
  const Icon = entryIcon(entry)
  return (
    <motion.div
      initial={{ scale: 1, rotate: 0 }}
      animate={{ scale: 1.03, rotate: overTimeline ? 0 : -1.5, opacity: overTimeline ? 0.85 : 1 }}
      transition={spring.snappy}
      className={cn('shadow-lift flex h-full min-h-9 w-full cursor-grabbing items-start gap-2 overflow-hidden rounded-lg border border-black/5 py-1.5 pr-2', ws.soft)}
    >
      <span className={cn('w-1 self-stretch', ws.bar)} />
      <Icon className={cn('mt-0.5 size-3.5 shrink-0', ws.text)} />
      <span className="truncate text-[13px] font-medium text-foreground">{entry.title}</span>
    </motion.div>
  )
}
