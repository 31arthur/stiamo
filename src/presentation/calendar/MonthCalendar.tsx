import { format, isSameMonth, isWeekend, parseISO } from 'date-fns'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DATE_FORMAT } from '@/domain/calendar/monthGrid'
import type { MonthView } from '@/domain/calendar/usecases/CalendarUseCases'
import type { CalendarItem } from '@/domain/calendar/entities/CalendarItem'
import { easeOutExpo, spring } from '@/presentation/motion/presets'
import { ITEM_TYPE_STYLES } from './itemStyles'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MAX_VISIBLE_ITEMS = 3

interface MonthCalendarProps {
  month: Date
  /** -1 when navigating back, 1 forward; drives the slide direction. */
  direction: number
  view: MonthView | null
  onAdd: (date: string) => void
  onOpenDay?: (date: string) => void
  onToggle: (item: CalendarItem) => void
  onDelete: (item: CalendarItem) => void
}

const slide = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 40, filter: 'blur(6px)' }),
  center: { opacity: 1, x: 0, filter: 'blur(0px)' },
  exit: (dir: number) => ({ opacity: 0, x: dir * -40, filter: 'blur(6px)' }),
}

export function MonthCalendar({ month, direction, view, onAdd, onOpenDay, onToggle, onDelete }: MonthCalendarProps) {
  const today = format(new Date(), DATE_FORMAT)
  const monthKey = format(month, 'yyyy-MM')

  return (
    <div className="overflow-hidden rounded-2xl border bg-card/80 shadow-float backdrop-blur">
      <div className="grid grid-cols-7 border-b text-center text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2.5">{d}</div>
        ))}
      </div>
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        {view && (
          <motion.div
            key={monthKey}
            custom={direction}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4, ease: easeOutExpo }}
          >
            {view.grid.weeks.map((week, w) => (
              <div key={week[0]} className="grid grid-cols-7 border-b last:border-b-0">
                {week.map((day, d) => (
                  <DayCell
                    key={day}
                    day={day}
                    index={w * 7 + d}
                    inMonth={isSameMonth(parseISO(day), month)}
                    isToday={day === today}
                    items={view.itemsByDate[day] ?? []}
                    onAdd={onAdd}
                    onOpenDay={onOpenDay}
                    onToggle={onToggle}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface DayCellProps extends Pick<MonthCalendarProps, 'onAdd' | 'onOpenDay' | 'onToggle' | 'onDelete'> {
  day: string
  index: number
  inMonth: boolean
  isToday: boolean
  items: CalendarItem[]
}

function DayCell({ day, index, inMonth, isToday, items, onAdd, onOpenDay, onToggle, onDelete }: DayCellProps) {
  const date = parseISO(day)
  const visible = items.slice(0, MAX_VISIBLE_ITEMS)
  const hidden = items.length - visible.length
  const done = items.filter((i) => i.completed).length

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: Math.min(index * 0.008, 0.3), duration: 0.3 }}
      className={cn(
        'group relative flex min-h-32 flex-col gap-1 border-r p-1.5 transition-colors last:border-r-0 hover:bg-muted/40',
        !inMonth && 'bg-muted/25 text-muted-foreground/70',
        inMonth && isWeekend(date) && 'bg-muted/15',
      )}
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onOpenDay?.(day)}
          disabled={!onOpenDay}
          aria-label={onOpenDay ? `Plan ${format(date, 'EEEE d MMMM')}` : undefined}
          className={cn(
            'relative flex size-7 items-center justify-center rounded-full text-xs tabular-nums transition-colors',
            onOpenDay && 'hover:bg-foreground hover:text-background',
            isToday && 'bg-foreground font-semibold text-background',
          )}
        >
          {isToday && (
            <motion.span
              className="absolute inset-0 rounded-full ring-2 ring-foreground/30"
              animate={{ scale: [1, 1.35], opacity: [0.8, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
            />
          )}
          {format(date, 'd')}
        </button>
        <div className="flex items-center gap-1">
          {items.length > 0 && (
            <span className="text-[10px] text-muted-foreground tabular-nums opacity-0 transition-opacity group-hover:opacity-100">
              {done}/{items.length}
            </span>
          )}
          <motion.button
            type="button"
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            transition={spring.snappy}
            aria-label={`Add item on ${day}`}
            className="flex size-6 items-center justify-center rounded-full text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-foreground hover:text-background focus-visible:opacity-100"
            onClick={() => onAdd(day)}
          >
            <Plus className="size-3.5" />
          </motion.button>
        </div>
      </div>
      <motion.ul layout className="flex flex-col gap-1">
        <AnimatePresence initial={false}>
          {visible.map((item) => (
            <CalendarItemRow key={item.id} item={item} onToggle={onToggle} onDelete={onDelete} />
          ))}
        </AnimatePresence>
        {hidden > 0 && (
          <motion.li layout className="px-1.5 text-[11px] text-muted-foreground">
            <button type="button" onClick={() => onOpenDay?.(day)} className="hover:text-foreground">
              +{hidden} more
            </button>
          </motion.li>
        )}
      </motion.ul>
    </motion.div>
  )
}

interface CalendarItemRowProps {
  item: CalendarItem
  onToggle: (item: CalendarItem) => void
  onDelete: (item: CalendarItem) => void
}

function CalendarItemRow({ item, onToggle, onDelete }: CalendarItemRowProps) {
  const style = ITEM_TYPE_STYLES[item.type]
  return (
    <motion.li
      layout
      initial={{ opacity: 0, scale: 0.9, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
      transition={spring.snappy}
      title={item.notes || item.title}
      className={cn('group/item flex items-center gap-1.5 rounded-md py-0.5 pr-1 pl-1 text-[11.5px] font-medium', style.chip)}
    >
      <motion.button
        type="button"
        whileTap={{ scale: 0.8 }}
        aria-label={item.completed ? 'Mark as not done' : 'Mark as done'}
        aria-pressed={item.completed}
        onClick={() => onToggle(item)}
        className={cn(
          'flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border border-current transition-colors',
          item.completed && style.accent,
        )}
      >
        <AnimatePresence>
          {item.completed && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={spring.snappy}>
              <Check className="size-2.5 text-white" strokeWidth={3.5} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
      <span className="relative min-w-0 flex-1 truncate text-foreground/85">
        {item.title}
        <motion.span
          className="absolute top-1/2 left-0 h-px bg-current"
          initial={false}
          animate={{ width: item.completed ? '100%' : '0%' }}
          transition={{ duration: 0.3, ease: easeOutExpo }}
        />
      </span>
      <button
        type="button"
        aria-label={`Delete ${item.title}`}
        onClick={() => onDelete(item)}
        className="opacity-0 transition-opacity group-hover/item:opacity-70 hover:!opacity-100 focus-visible:opacity-100"
      >
        <X className="size-3" />
      </button>
    </motion.li>
  )
}
