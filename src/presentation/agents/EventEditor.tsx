import { CalendarPlus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { AttentionEvent } from '@/domain/ai/AgentApi'
import { DateInput } from '@/presentation/components/form'

const MODES = [
  { value: 'in_person', label: 'In person' },
  { value: 'virtual', label: 'Virtual' },
  { value: 'phone', label: 'Phone' },
]

/** The event an email names, to check and change before it goes in the calendar. Controlled: the card's decision bar adds it. */
export function EventEditor({ event, onChange }: { event: AttentionEvent; onChange: (e: AttentionEvent) => void }) {
  const set = (p: Partial<AttentionEvent>) => onChange({ ...event, ...p })
  return (
    <fieldset className="grid gap-3 rounded-xl border bg-muted/30 p-3.5">
      <legend className="flex items-center gap-1.5 px-1 text-sm font-medium">
        <CalendarPlus className="size-4" /> The event it names
      </legend>
      <label className="grid gap-1 text-xs text-muted-foreground">
        Title
        <Input value={event.title} onChange={(e) => set({ title: e.target.value })} maxLength={150} className="h-8 text-sm text-foreground" />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="grid gap-1 text-xs text-muted-foreground">
          Date
          <DateInput value={event.date} onChange={(d) => d && set({ date: d })} aria-label="Date" />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Starts
          <Input type="time" value={event.start ?? ''} onChange={(e) => set({ start: e.target.value || null })} className="h-8" />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Minutes
          <Input type="number" min={5} max={1440} value={event.durationMinutes ?? (event.start && event.end ? '' : 60)} placeholder="60" onChange={(e) => set({ durationMinutes: e.target.value ? Number(e.target.value) : null, end: null })} className="h-8" />
        </label>
      </div>
      <div className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)]">
        <label className="grid gap-1 text-xs text-muted-foreground">
          How
          <select value={event.mode} onChange={(e) => set({ mode: e.target.value as AttentionEvent['mode'] })} className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground dark:bg-input/30">
            {MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Place or link
          <Input value={event.location ?? event.link ?? ''} onChange={(e) => (e.target.value.startsWith('http') ? set({ link: e.target.value, location: null }) : set({ location: e.target.value || null, link: null }))} className="h-8 text-foreground" />
        </label>
      </div>
      {!event.start && <p className="text-xs text-warning">The email doesn’t give a time. Set one, or it is added at 09:00 for an hour.</p>}
    </fieldset>
  )
}
