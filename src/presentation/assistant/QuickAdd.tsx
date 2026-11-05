import { Phone, Plus, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ListChecks } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEditor } from '@/presentation/app/create'
import { useToday } from '@/presentation/data/hooks'

/** Add something yourself, without asking: opens the same form as anywhere else in the app, already set to today. */
export function QuickAdd() {
  const editor = useEditor()
  const today = useToday()
  const add: { label: string; icon: LucideIcon; open: () => void }[] = [
    { label: 'Task', icon: ListChecks, open: () => editor.open({ kind: 'task', value: { dueDate: today } }) },
    { label: 'Call', icon: Phone, open: () => editor.open({ kind: 'followUp', value: { due: { date: today } } }) },
    { label: 'Meeting', icon: Users, open: () => editor.open({ kind: 'meeting', value: { slot: { date: today, start: 10 * 60, duration: 60 } } }) },
  ]
  return (
    <div className="flex items-center gap-0.5" role="group" aria-label="Add">
      {add.map((a) => (
        <Button key={a.label} type="button" variant="ghost" size="sm" className="h-9 gap-1 rounded-full px-2.5 text-muted-foreground" onClick={a.open} aria-label={`Add a ${a.label.toLowerCase()}`}>
          <Plus className="size-3" />
          <a.icon className="size-4" />
          <span className="max-sm:sr-only">{a.label}</span>
        </Button>
      ))}
    </div>
  )
}
