import { useCallback, useEffect, useState } from 'react'
import { addMonths, format, startOfMonth } from 'date-fns'
import type { Container } from '@/di/container'
import type { CalendarItem, NewCalendarItem } from '@/domain/calendar/entities/CalendarItem'
import type { MonthView } from '@/domain/calendar/usecases/CalendarUseCases'

const monthKey = (d: Date) => format(d, 'yyyy-MM')

export function useMonthCalendar(calendar: Container['calendar'], userId: string) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [direction, setDirection] = useState(0)
  const [loaded, setLoaded] = useState<{ key: string; view: MonthView } | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    calendar.getMonthView.execute(userId, month).then((view) => active && setLoaded({ key: monthKey(month), view }))
    return () => {
      active = false
    }
  }, [calendar, userId, month, version])

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  const goTo = (target: Date) => {
    const next = startOfMonth(target)
    setDirection(Math.sign(next.getTime() - month.getTime()))
    setMonth(next)
  }

  const addItem = useCallback(
    async (input: NewCalendarItem) => {
      await calendar.addItem.execute(userId, input)
      refresh()
    },
    [calendar, userId, refresh],
  )

  const toggleItem = useCallback(
    async (item: CalendarItem) => {
      await calendar.toggleItem.execute(item)
      refresh()
    },
    [calendar, refresh],
  )

  const deleteItem = useCallback(
    async (item: CalendarItem) => {
      await calendar.deleteItem.execute(userId, item.id)
      refresh()
    },
    [calendar, userId, refresh],
  )

  return {
    month,
    direction,
    // Only expose data that belongs to the month on screen, so transitions never flash stale weeks.
    view: loaded?.key === monthKey(month) ? loaded.view : null,
    goToPrevious: () => goTo(addMonths(month, -1)),
    goToNext: () => goTo(addMonths(month, 1)),
    goToToday: () => goTo(new Date()),
    addItem,
    toggleItem,
    deleteItem,
  }
}
