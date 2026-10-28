import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CHANNEL_LABELS } from '@/domain/followups/FollowUp'
import type { FollowUp, FollowUpChannel } from '@/domain/followups/FollowUp'
import { OPEN } from '@/domain/shared/outcome'
import { DateInput, Field, Segmented, TimeInput } from '@/presentation/components/form'
import { WorkspacePicker } from '@/presentation/components/workspace'
import { AttemptHistory } from '@/presentation/followups/chase'
import { useSave, useToday } from '@/presentation/data/hooks'
import { FormShell, usePatch } from './shared'

export type FollowUpDraft = Omit<FollowUp, 'id' | 'userId' | 'createdAt' | 'updatedAt'>

export const newFollowUp = (today: string, over: Partial<FollowUpDraft> = {}): FollowUpDraft => ({
  title: '',
  channel: 'call',
  workspace: 'personal',
  due: { date: today },
  duration: 15,
  outcome: OPEN,
  ...over,
})

export function FollowUpForm({ initial, onDone }: { initial: FollowUp | FollowUpDraft; onDone: (saved?: FollowUp) => void }) {
  const today = useToday()
  const [f, patch] = usePatch(initial)
  const save = useSave('followUp', 'createdAt' in initial ? 'Follow-up updated' : 'Follow-up created')

  return (
    <FormShell submitLabel={'createdAt' in initial ? 'Save' : 'Create follow-up'} onCancel={() => onDone()} onSubmit={async () => onDone(await save.run(f))}>
      <Field label="What to follow up on" htmlFor="fu-title">
        <Input id="fu-title" autoFocus value={f.title} onChange={(e) => patch({ title: e.target.value })} placeholder="e.g. Call client about documents" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Channel">
          <Segmented<FollowUpChannel>
            size="sm"
            label="Channel"
            value={f.channel}
            onChange={(channel) => patch({ channel })}
            options={(Object.keys(CHANNEL_LABELS) as FollowUpChannel[]).map((c) => ({ value: c, label: CHANNEL_LABELS[c] }))}
          />
        </Field>
        <Field label="Contact" htmlFor="fu-contact">
          <Input id="fu-contact" value={f.contact ?? ''} onChange={(e) => patch({ contact: e.target.value || undefined })} placeholder="Name, phone or email" />
        </Field>
      </div>
      <Field label="Workspace">
        <WorkspacePicker id="fu-ws" value={f.workspace} onChange={(workspace) => patch({ workspace })} />
      </Field>
      <Field label="When" hint="A follow-up can simply be pending — add a day, and a time only if it matters">
        <Segmented
          size="sm"
          label="When"
          value={!f.due ? 'none' : f.due.time === undefined ? 'day' : 'time'}
          onChange={(v) =>
            patch({ due: v === 'none' ? undefined : { date: f.due?.date ?? today, time: v === 'time' ? (f.due?.time ?? 10 * 60) : undefined } })
          }
          options={[
            { value: 'none', label: 'Anytime' },
            { value: 'day', label: 'On a day' },
            { value: 'time', label: 'At a time' },
          ]}
        />
      </Field>
      {f.due && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date" htmlFor="fu-date">
            <DateInput id="fu-date" value={f.due.date} onChange={(date) => patch({ due: { ...f.due!, date: date ?? today } })} />
          </Field>
          {f.due.time !== undefined && (
            <Field label="Time" htmlFor="fu-time">
              <TimeInput id="fu-time" value={f.due.time} onChange={(time) => patch({ due: { ...f.due!, time } })} />
            </Field>
          )}
        </div>
      )}
      <Field label="Notes" htmlFor="fu-notes">
        <Textarea id="fu-notes" value={f.notes ?? ''} onChange={(e) => patch({ notes: e.target.value })} />
      </Field>
      {'attempts' in f && !!f.attempts?.length && (
        <Field label="Tries so far" hint="Log a new one with “Log call” on the follow-up">
          <AttemptHistory followUp={f} today={today} />
        </Field>
      )}
    </FormShell>
  )
}
