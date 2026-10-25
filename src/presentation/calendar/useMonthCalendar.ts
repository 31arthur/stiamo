import { useCallback, useEffect, useState } from 'react'
import { addMonths, startOfMonth } from 'date-fns'
import type { Container } from '@/di/container'
import type { CalendarItem, NewCalendarItem } from '@/domain/calendar/entities/CalendarItem'
import type { MonthView } from '@/domain/calendar/usecases/CalendarUseCases'

export function useMonthCalendar(calendar: Container['calendar'], userId: string) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [view, setView] = useState<MonthView | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    calendar.getMonthView.execute(userId, month).then((v) => active && setView(v))
    return () => {
      active = false
    }
  }, [calendar, userId, month, version])

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

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
    view,
    goToPrevious: () => setMonth((m) => addMonths(m, -1)),
    goToNext: () => setMonth((m) => addMonths(m, 1)),
    goToToday: () => setMonth(startOfMonth(new Date())),
    addItem,
    toggleItem,
    deleteItem,
  }
}
