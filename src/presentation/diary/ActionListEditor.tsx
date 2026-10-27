import { CheckSquare, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ISODate } from '@/domain/shared/types'
import { DateInput } from '@/presentation/components/form'

export interface ActionRow {
  id?: string
  text: string
  due?: ISODate
  taskId?: string
}

/**
 * The work due before the next date, one row each with an optional deadline. A court direction
 * ("file the reply within two weeks") is just an action with a date. Rows that already have a task
 * say so.
 */
export function ActionListEditor({ actions, onChange, placeholder = 'e.g. File reply to the application' }: { actions: ActionRow[]; onChange: (a: ActionRow[]) => void; placeholder?: string }) {
  const update = (i: number, patch: Partial<ActionRow>) => onChange(actions.map((a, j) => (j === i ? { ...a, ...patch } : a)))
  const rows = actions.length ? actions : [{ text: '' }]

  return (
    <div className="grid gap-2">
      {rows.map((a, i) => (
        <div key={a.id ?? i} className="grid grid-cols-[1fr_auto] items-center gap-2 sm:grid-cols-[1fr_9.5rem_auto]">
          <div className="relative">
            <Input
              aria-label={`Action ${i + 1}`}
              value={a.text}
              onChange={(e) => update(i, { text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && a.text.trim()) {
                  e.preventDefault()
                  onChange([...actions, { text: '' }])
                }
              }}
              placeholder={placeholder}
              className={a.taskId ? 'pr-16' : undefined}
            />
            {a.taskId && (
              <span className="pointer-events-none absolute top-1/2 right-2 inline-flex -translate-y-1/2 items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                <CheckSquare className="size-3" /> task
              </span>
            )}
          </div>
          <div className="max-sm:order-3 max-sm:col-span-2">
            <DateInput aria-label={`Due date for action ${i + 1}`} value={a.due} onChange={(due) => update(i, { due })} />
          </div>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove action ${i + 1}`} onClick={() => onChange(actions.filter((_, j) => j !== i))} disabled={actions.length === 0}>
            <X />
          </Button>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => onChange([...actions, { text: '' }])}>
        <Plus /> Add an action
      </Button>
    </div>
  )
}
