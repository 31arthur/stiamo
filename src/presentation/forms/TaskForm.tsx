import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { OPEN } from '@/domain/shared/outcome'
import { formatDuration } from '@/domain/shared/time'
import { PRIORITY_LABELS } from '@/domain/tasks/Task'
import type { Task, TaskPriority } from '@/domain/tasks/Task'
import { DateInput, DURATION_PRESETS, Field, NativeSelect, Segmented } from '@/presentation/components/form'
import { WorkspacePicker } from '@/presentation/components/workspace'
import { useEntities, useSave } from '@/presentation/data/hooks'
import { FormShell, usePatch } from './shared'

export type TaskDraft = Omit<Task, 'id' | 'userId' | 'createdAt' | 'updatedAt'>

export const newTask = (over: Partial<TaskDraft> = {}): TaskDraft => ({
  title: '',
  notes: '',
  workspace: 'personal',
  priority: 'normal',
  estimate: 30,
  outcome: OPEN,
  ...over,
})

export function TaskForm({ initial, onDone }: { initial: Task | TaskDraft; onDone: (saved?: Task) => void }) {
  const [t, patch] = usePatch(initial)
  const { data: plans } = useEntities('plan')
  const save = useSave('task', 'createdAt' in initial ? 'Task updated' : 'Task created')

  return (
    <FormShell submitLabel={'createdAt' in initial ? 'Save' : 'Create task'} onCancel={() => onDone()} onSubmit={async () => onDone(await save.run(t))}>
      <Field label="Title" htmlFor="task-title">
        <Input id="task-title" autoFocus value={t.title} onChange={(e) => patch({ title: e.target.value })} placeholder="What needs doing?" />
      </Field>
      <Field label="Workspace">
        <WorkspacePicker id="task-ws" value={t.workspace} onChange={(workspace) => patch({ workspace })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Priority">
          <Segmented<TaskPriority>
            size="sm"
            label="Priority"
            value={t.priority}
            onChange={(priority) => patch({ priority })}
            options={(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
          />
        </Field>
        <Field label="Due date" htmlFor="task-due">
          <DateInput id="task-due" value={t.dueDate} onChange={(dueDate) => patch({ dueDate })} />
        </Field>
      </div>
      <Field label="Estimate">
        <Segmented
          size="sm"
          label="Estimate"
          value={String(t.estimate)}
          onChange={(v) => patch({ estimate: Number(v) })}
          options={[...new Set([...DURATION_PRESETS, t.estimate])].sort((a, b) => a - b).map((d) => ({ value: String(d), label: formatDuration(d) }))}
        />
      </Field>
      <Field label="Action plan" htmlFor="task-plan" hint="Make this a step of a plan">
        <NativeSelect id="task-plan" value={t.planId ?? ''} onChange={(e) => patch({ planId: e.target.value || undefined })}>
          <option value="">No plan</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Notes" htmlFor="task-notes">
        <Textarea id="task-notes" value={t.notes} onChange={(e) => patch({ notes: e.target.value })} />
      </Field>
    </FormShell>
  )
}
