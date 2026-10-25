import { format, isSameMonth, parseISO } from 'date-fns'
import { Check, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { DATE_FORMAT } from '@/domain/calendar/monthGrid'
import type { MonthView } from '@/domain/calendar/usecases/CalendarUseCases'
import type { CalendarItem } from '@/domain/calendar/entities/CalendarItem'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface MonthCalendarProps {
  month: Date
  view: MonthView | null
  onAdd: (date: string) => void
  onToggle: (item: CalendarItem) => void
  onDelete: (item: CalendarItem) => void
}

export function MonthCalendar({ month, view, onAdd, onToggle, onDelete }: MonthCalendarProps) {
  const today = format(new Date(), DATE_FORMAT)

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="grid grid-cols-7 border-b bg-muted/50 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2">{d}</div>
        ))}
      </div>
      {(view?.grid.weeks ?? []).map((week) => (
        <div key={week[0]} className="grid grid-cols-7 border-b last:border-b-0">
          {week.map((day) => {
            const date = parseISO(day)
            const items = view?.itemsByDate[day] ?? []
            return (
              <div
                key={day}
                className={cn(
                  'group flex min-h-28 flex-col gap-1 border-r p-1.5 last:border-r-0',
                  !isSameMonth(date, month) && 'bg-muted/30 text-muted-foreground',
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      'flex size-6 items-center justify-center rounded-full text-xs',
                      day === today && 'bg-primary font-semibold text-primary-foreground',
                    )}
                  >
                    {format(date, 'd')}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Add item on ${day}`}
                    className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                    onClick={() => onAdd(day)}
                  >
                    <Plus />
                  </Button>
                </div>
                <ul className="flex flex-col gap-1">
                  {items.map((item) => (
                    <CalendarItemRow key={item.id} item={item} onToggle={onToggle} onDelete={onDelete} />
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

interface CalendarItemRowProps {
  item: CalendarItem
  onToggle: (item: CalendarItem) => void
  onDelete: (item: CalendarItem) => void
}

function CalendarItemRow({ item, onToggle, onDelete }: CalendarItemRowProps) {
  const isFollowUp = item.type === 'follow_up'
  return (
    <li
      title={item.notes || item.title}
      className={cn(
        'group/item flex items-center gap-1 rounded px-1.5 py-0.5 text-xs',
        isFollowUp ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100' : 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100',
      )}
    >
      <button
        type="button"
        aria-label={item.completed ? 'Mark as not done' : 'Mark as done'}
        aria-pressed={item.completed}
        onClick={() => onToggle(item)}
        className="flex size-3.5 shrink-0 items-center justify-center rounded-sm border border-current"
      >
        {item.completed && <Check className="size-3" />}
      </button>
      <span className={cn('min-w-0 flex-1 truncate', item.completed && 'line-through opacity-60')}>
        {isFollowUp && <span className="font-medium">↪ </span>}
        {item.title}
      </span>
      <button
        type="button"
        aria-label={`Delete ${item.title}`}
        onClick={() => onDelete(item)}
        className="opacity-0 focus-visible:opacity-100 group-hover/item:opacity-100"
      >
        <Trash2 className="size-3" />
      </button>
    </li>
  )
}
