import { useState } from 'react'
import { format } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { container } from '@/di/container'
import { useAuth } from '@/presentation/auth/AuthProvider'
import { AddItemDialog } from '@/presentation/calendar/AddItemDialog'
import { MonthCalendar } from '@/presentation/calendar/MonthCalendar'
import { useMonthCalendar } from '@/presentation/calendar/useMonthCalendar'

export function HomePage() {
  const { user, logout } = useAuth()
  const { month, view, goToPrevious, goToNext, goToToday, addItem, toggleItem, deleteItem } = useMonthCalendar(
    container.calendar,
    user!.id,
  )
  const [addingDate, setAddingDate] = useState<string | null>(null)

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Stiamo</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{user?.email}</span>
          <Button variant="outline" size="sm" onClick={logout}>
            Sign out
          </Button>
        </div>
      </header>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">{format(month, 'MMMM yyyy')}</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday}>Today</Button>
            <Button variant="outline" size="icon" aria-label="Previous month" onClick={goToPrevious}>
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="icon" aria-label="Next month" onClick={goToNext}>
              <ChevronRight />
            </Button>
          </div>
        </div>
        <MonthCalendar month={month} view={view} onAdd={setAddingDate} onToggle={toggleItem} onDelete={deleteItem} />
      </section>

      <AddItemDialog date={addingDate} onClose={() => setAddingDate(null)} onSubmit={addItem} />
    </div>
  )
}
