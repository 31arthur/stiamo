import { useState } from 'react'
import type { FormEvent } from 'react'
import { format, parseISO } from 'date-fns'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { CalendarItemType, NewCalendarItem } from '@/domain/calendar/entities/CalendarItem'
import { spring } from '@/presentation/motion/presets'
import { DEFAULT_DURATION } from '@/domain/planner/dayPlan'
import { formatDuration, formatMinutes, ITEM_TYPE_STYLES } from './itemStyles'

interface AddItemDialogProps {
  /** yyyy-MM-dd of the day being added to; null keeps the dialog closed. */
  date: string | null
  /** When set, the new item is placed on the day's timeline at this minute. */
  start?: number
  onClose: () => void
  onSubmit: (input: NewCalendarItem) => Promise<void>
}

const TYPES = Object.keys(ITEM_TYPE_STYLES) as CalendarItemType[]

export function AddItemDialog({ date, start, onClose, onSubmit }: AddItemDialogProps) {
  return (
    <Dialog open={date !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {date && <AddItemForm key={`${date}-${start}`} date={date} start={start} onClose={onClose} onSubmit={onSubmit} />}
      </DialogContent>
    </Dialog>
  )
}

const DURATIONS = [15, 30, 45, 60, 90]

function AddItemForm({ date, start, onClose, onSubmit }: Omit<AddItemDialogProps, 'date'> & { date: string }) {
  const [type, setType] = useState<CalendarItemType>('task')
  const [duration, setDuration] = useState<number | null>(null)
  const effectiveDuration = duration ?? DEFAULT_DURATION[type]
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    try {
      await onSubmit({ type, title, notes, date, ...(start !== undefined && { schedule: { start, duration: effectiveDuration } }) })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <DialogHeader>
        <DialogTitle className="font-display text-3xl font-normal tracking-tight">New entry</DialogTitle>
        <DialogDescription>
          {format(parseISO(date), 'EEEE, d MMMM yyyy')}
          {start !== undefined && ` · ${formatMinutes(start)} – ${formatMinutes(start + effectiveDuration)}`}
        </DialogDescription>
      </DialogHeader>
      <div className="flex w-fit gap-1 rounded-full bg-muted p-1" role="radiogroup" aria-label="Type">
        {TYPES.map((t) => {
          const selected = type === t
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setType(t)}
              className={cn('relative rounded-full px-3.5 py-1 text-sm font-medium transition-colors', selected ? 'text-foreground' : 'text-muted-foreground')}
            >
              {selected && <motion.span layoutId="type-pill" transition={spring.snappy} className="absolute inset-0 rounded-full bg-background shadow-float" />}
              <span className="relative flex items-center gap-1.5">
                <span className={cn('size-2 rounded-full', ITEM_TYPE_STYLES[t].accent)} />
                {ITEM_TYPE_STYLES[t].label}
              </span>
            </button>
          )
        })}
      </div>
      {start !== undefined && (
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Duration">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={effectiveDuration === d}
              onClick={() => setDuration(d)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium tabular-nums transition-colors',
                effectiveDuration === d ? 'border-foreground bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {formatDuration(d)}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-2">
        <Label htmlFor="item-title">Title</Label>
        <Input id="item-title" className="h-10" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="What needs doing?" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="item-notes">Notes</Label>
        <Textarea id="item-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit">Add</Button>
      </DialogFooter>
    </form>
  )
}
