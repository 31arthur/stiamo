import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { HORIZON_LABELS } from '@/domain/goals/Goal'
import type { Goal, GoalHorizon, KeyResult } from '@/domain/goals/Goal'
import { shiftDate } from '@/domain/shared/time'
import { WORKSPACE_IDS, WORKSPACES } from '@/domain/shared/workspace'
import type { WorkspaceId } from '@/domain/shared/workspace'
import { DateInput, Field, NativeSelect, Segmented } from '@/presentation/components/form'
import { useSave, useToday } from '@/presentation/data/hooks'
import { FormShell, usePatch } from './shared'

export type GoalDraft = Omit<Goal, 'id' | 'userId' | 'createdAt' | 'updatedAt'>

const HORIZON_DAYS: Record<GoalHorizon, number> = { quarter: 91, half: 182, year: 365, multi_year: 1095 }

export const newGoal = (today: string): GoalDraft => ({
  title: '',
  description: '',
  horizon: 'quarter',
  startDate: today,
  targetDate: shiftDate(today, HORIZON_DAYS.quarter),
  planIds: [],
  keyResults: [],
  checkIns: [],
  status: 'active',
})

export function GoalForm({ initial, onDone }: { initial: Goal | GoalDraft; onDone: (saved?: Goal) => void }) {
  const today = useToday()
  const [g, patch] = usePatch(initial)
  const editing = 'createdAt' in initial
  const save = useSave('goal', editing ? 'Goal updated' : 'Goal set')

  const setKr = (id: string, p: Partial<KeyResult>) => patch({ keyResults: g.keyResults.map((k) => (k.id === id ? { ...k, ...p } : k)) })

  return (
    <FormShell submitLabel={editing ? 'Save' : 'Set goal'} onCancel={() => onDone()} onSubmit={async () => onDone(await save.run(g))}>
      <Field label="Goal" htmlFor="goal-title">
        <Input id="goal-title" autoFocus value={g.title} onChange={(e) => patch({ title: e.target.value })} placeholder="e.g. Grow the litigation practice" />
      </Field>
      <Field label="Why it matters" htmlFor="goal-desc">
        <Textarea id="goal-desc" value={g.description} onChange={(e) => patch({ description: e.target.value })} className="min-h-14" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Horizon">
          <Segmented<GoalHorizon>
            size="sm"
            label="Horizon"
            value={g.horizon}
            onChange={(horizon) => patch({ horizon, ...(!editing && { targetDate: shiftDate(g.startDate, HORIZON_DAYS[horizon]) }) })}
            options={(Object.keys(HORIZON_LABELS) as GoalHorizon[]).map((h) => ({ value: h, label: HORIZON_LABELS[h] }))}
          />
        </Field>
        <Field label="Workspace" htmlFor="goal-ws">
          <NativeSelect id="goal-ws" value={g.workspace ?? ''} onChange={(e) => patch({ workspace: (e.target.value || undefined) as WorkspaceId | undefined })}>
            <option value="">Cross-cutting</option>
            {WORKSPACE_IDS.map((w) => (
              <option key={w} value={w}>
                {WORKSPACES[w].name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Starts" htmlFor="goal-start">
          <DateInput id="goal-start" value={g.startDate} onChange={(startDate) => patch({ startDate: startDate ?? today })} />
        </Field>
        <Field label="Target date" htmlFor="goal-target">
          <DateInput id="goal-target" value={g.targetDate} onChange={(targetDate) => patch({ targetDate: targetDate ?? g.targetDate })} />
        </Field>
      </div>
      <Field label="Key results" hint="Measurable evidence of progress: from → to, and where you are now">
        <div className="grid gap-2">
          {g.keyResults.map((k) => (
            <div key={k.id} className="grid grid-cols-[1fr_4.5rem_4.5rem_4.5rem_auto] items-center gap-1.5">
              <Input value={k.label} onChange={(e) => setKr(k.id, { label: e.target.value })} placeholder="Measure" aria-label="Key result" />
              <Input type="number" value={k.start} onChange={(e) => setKr(k.id, { start: Number(e.target.value) })} aria-label="From" title="From" />
              <Input type="number" value={k.target} onChange={(e) => setKr(k.id, { target: Number(e.target.value) })} aria-label="Target" title="Target" />
              <Input type="number" value={k.current} onChange={(e) => setKr(k.id, { current: Number(e.target.value) })} aria-label="Current" title="Current" />
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove key result" onClick={() => patch({ keyResults: g.keyResults.filter((x) => x.id !== k.id) })}>
                <X />
              </Button>
            </div>
          ))}
          {g.keyResults.length > 0 && <div className="grid grid-cols-[1fr_4.5rem_4.5rem_4.5rem_auto] gap-1.5 text-[10px] text-muted-foreground"><span /><span>From</span><span>Target</span><span>Now</span><span className="w-7" /></div>}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => patch({ keyResults: [...g.keyResults, { id: crypto.randomUUID(), label: '', start: 0, target: 10, current: 0 }] })}
          >
            <Plus /> Key result
          </Button>
        </div>
      </Field>
    </FormShell>
  )
}
