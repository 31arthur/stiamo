import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { CalendarItemType, NewCalendarItem } from '@/domain/calendar/entities/CalendarItem'

interface AddItemDialogProps {
  /** yyyy-MM-dd of the day being added to; null keeps the dialog closed. */
  date: string | null
  onClose: () => void
  onSubmit: (input: NewCalendarItem) => Promise<void>
}

const TYPES: { value: CalendarItemType; label: string }[] = [
  { value: 'task', label: 'Task' },
  { value: 'follow_up', label: 'Follow-up' },
]

export function AddItemDialog({ date, onClose, onSubmit }: AddItemDialogProps) {
  return (
    <Dialog open={date !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>{date && <AddItemForm key={date} date={date} onClose={onClose} onSubmit={onSubmit} />}</DialogContent>
    </Dialog>
  )
}

function AddItemForm({ date, onClose, onSubmit }: Omit<AddItemDialogProps, 'date'> & { date: string }) {
  const [type, setType] = useState<CalendarItemType>('task')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    try {
      await onSubmit({ type, title, notes, date })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Add to {date}</DialogTitle>
      </DialogHeader>
      <div className="flex gap-2" role="radiogroup" aria-label="Type">
        {TYPES.map((t) => (
          <Button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={type === t.value}
            variant={type === t.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setType(t.value)}
          >
            {t.label}
          </Button>
        ))}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="item-title">Title</Label>
        <Input id="item-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="item-notes">Notes</Label>
        <Textarea id="item-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit">Add</Button>
      </DialogFooter>
    </form>
  )
}
