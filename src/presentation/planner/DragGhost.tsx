import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import type { CalendarItem } from '@/domain/calendar/entities/CalendarItem'
import { ITEM_TYPE_STYLES } from '@/presentation/calendar/itemStyles'
import { spring } from '@/presentation/motion/presets'

/** The lifted card that follows the pointer while dragging. */
export function DragGhost({ item, overTimeline }: { item: CalendarItem; overTimeline: boolean }) {
  const style = ITEM_TYPE_STYLES[item.type]
  return (
    <motion.div
      initial={{ scale: 1, rotate: 0 }}
      animate={{ scale: 1.03, rotate: overTimeline ? 0 : -1.5, opacity: overTimeline ? 0.85 : 1 }}
      transition={spring.snappy}
      className={cn(
        'shadow-lift flex h-full min-h-9 w-full cursor-grabbing items-start gap-2 overflow-hidden rounded-lg border border-black/5 py-1.5 pr-2',
        style.chip,
      )}
    >
      <span className={cn('w-1 self-stretch', style.accent)} />
      <span className="truncate text-[13px] font-medium text-foreground">{item.title}</span>
    </motion.div>
  )
}
