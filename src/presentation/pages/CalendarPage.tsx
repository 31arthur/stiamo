import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { container } from '@/di/container'
import { useAuth } from '@/presentation/auth/AuthProvider'
import { AddItemDialog } from '@/presentation/calendar/AddItemDialog'
import { ITEM_TYPE_STYLES } from '@/presentation/calendar/itemStyles'
import { MonthCalendar } from '@/presentation/calendar/MonthCalendar'
import { useMonthCalendar } from '@/presentation/calendar/useMonthCalendar'
import { easeOutExpo } from '@/presentation/motion/presets'
import type { CalendarItemType } from '@/domain/calendar/entities/CalendarItem'

interface CalendarPageProps {
  onOpenDay?: (date: string) => void
}

export function CalendarPage({ onOpenDay }: CalendarPageProps) {
  const { user } = useAuth()
  const calendar = useMonthCalendar(container.calendar, user!.id)
  const { month, direction, view } = calendar
  const [addingDate, setAddingDate] = useState<string | null>(null)

  const stats = useMemo(() => {
    const prefix = format(month, 'yyyy-MM')
    const items = Object.entries(view?.itemsByDate ?? {})
      .filter(([date]) => date.startsWith(prefix))
      .flatMap(([, list]) => list)
    const byType = {} as Record<CalendarItemType, number>
    for (const i of items) byType[i.type] = (byType[i.type] ?? 0) + 1
    return { total: items.length, done: items.filter((i) => i.completed).length, byType }
  }, [view, month])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="relative h-14 overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false} custom={direction}>
              <motion.h1
                key={month.toISOString()}
                custom={direction}
                initial={{ y: direction >= 0 ? 40 : -40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: direction >= 0 ? -40 : 40, opacity: 0 }}
                transition={{ duration: 0.45, ease: easeOutExpo }}
                className="font-display text-5xl leading-tight tracking-tight"
              >
                {format(month, 'MMMM')} <span className="text-muted-foreground italic">{format(month, 'yyyy')}</span>
              </motion.h1>
            </AnimatePresence>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {(Object.keys(ITEM_TYPE_STYLES) as CalendarItemType[]).map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${ITEM_TYPE_STYLES[t].accent}`} />
                <span className="tabular-nums">{stats.byType[t] ?? 0}</span> {ITEM_TYPE_STYLES[t].label.toLowerCase()}s
              </span>
            ))}
            <span className="tabular-nums">· {stats.done}/{stats.total} done</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-full" onClick={calendar.goToToday}>
            Today
          </Button>
          <div className="flex rounded-full border bg-background p-0.5">
            <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label="Previous month" onClick={calendar.goToPrevious}>
              <ChevronLeft />
            </Button>
            <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label="Next month" onClick={calendar.goToNext}>
              <ChevronRight />
            </Button>
          </div>
        </div>
      </div>

      <MonthCalendar
        month={month}
        direction={direction}
        view={view}
        onAdd={setAddingDate}
        onOpenDay={onOpenDay}
        onToggle={calendar.toggleItem}
        onDelete={calendar.deleteItem}
      />

      <AddItemDialog date={addingDate} onClose={() => setAddingDate(null)} onSubmit={calendar.addItem} />
    </div>
  )
}
