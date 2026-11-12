import { useState } from 'react'
import { Cpu, Play, ScanSearch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import type { AiSelection } from '@/domain/ai/types'
import type { EditorSettings } from '@/domain/stories/Stories'
import { useWorkspaceFilter } from '@/presentation/app/workspaceFilter'
import { Field, Segmented } from '@/presentation/components/form'
import { Switch } from '@/presentation/components/Switch'
import { ModelChoice } from '@/presentation/agents/ModelPicker'
import { toast } from '@/presentation/notifications/toast'
import { useEditorOverview, useJobs, useStoryAction } from './useStories'

const DAYS: { value: EditorSettings['roomDay']; label: string }[] = [
  { value: 'mon', label: 'Mon' },
  { value: 'tue', label: 'Tue' },
  { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' },
  { value: 'sat', label: 'Sat' },
  { value: 'sun', label: 'Sun' },
]

/** The story editor's settings, run it now, and which model each small AI job runs on (and so what it costs). */
export function EditorSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const overview = useEditorOverview()
  const jobs = useJobs(open)
  const { run, busy } = useStoryAction()
  const { scope } = useWorkspaceFilter()
  const [changed, setSettings] = useState<EditorSettings | null>(null)
  const settings: EditorSettings = changed ?? overview.data?.settings ?? { enabled: true, roomDay: 'sun' }

  async function save(next: EditorSettings) {
    setSettings(next)
    await run((s) => s.stories.setEditorSettings(next), { success: 'Saved', failure: 'Couldn’t save the editor’s settings' })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="font-display text-3xl font-normal tracking-tight">The editor</SheetTitle>
          <SheetDescription>
            Each evening, with the evening plan, it looks at every story against its pace. A quiet story gets one question a day per workspace on its bot: a nudge, three ways the next chapter could start, a harder question, then whether the ending still holds. It also asks up to two short questions about people.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-5 px-4 pb-6">
          <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
            <span>
              <span className="block text-sm font-medium">Come looking when a story goes quiet</span>
              <span className="block text-xs text-muted-foreground">Runs only while the evening plan is on (Developer → Daily planner).</span>
            </span>
            <Switch checked={settings.enabled} onChange={(v) => void save({ ...settings, enabled: v })} label="Story editor on" />
          </div>
          <Field label="The writers’ room" hint="Once a week, one message per workspace: what moved, what went quiet, and the story for your next hour">
            <Segmented label="Writers’ room day" size="sm" value={settings.roomDay} onChange={(d) => void save({ ...settings, roomDay: d })} options={DAYS} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() =>
                void run(async (s) => {
                  const out = await s.stories.runEditor(scope === 'all' ? undefined : scope)
                  toast.success(out.sent.length ? `Sent ${out.sent.length} message${out.sent.length === 1 ? '' : 's'}` : 'Nothing to send today', { description: out.sent.length ? 'They’re on the workspace’s bot.' : 'Every story is on pace, or already had its question today.' })
                })
              }
            >
              {busy ? <Spinner size="xs" tone="current" decorative /> : <Play />} Run it now
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() =>
                void run(async (s) => {
                  const out = await s.stories.codeScenes()
                  toast.success(out.reason ? 'Not read yet' : `Read ${out.coded} scene${out.coded === 1 ? '' : 's'}`, { description: out.reason ?? `${out.evidence} new piece${out.evidence === 1 ? '' : 's'} of evidence about people.` })
                })
              }
            >
              <ScanSearch /> Read new scenes now
            </Button>
          </div>

          <section className="grid gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Cpu className="size-4" /> The small AI jobs
            </h3>
            <p className="text-xs text-muted-foreground">
              Each job does one narrow thing and is checked by code, so a cheap model is usually enough. A job without its own model uses the one you chose last for your agents. Score a model on the jobs’ test sets before moving a job onto it (see the server’s <code>eval_jobs</code>).
            </p>
            {jobs.isLoading ? (
              <Spinner label="Loading the jobs" />
            ) : (
              <ul className="grid gap-2">
                {(jobs.data ?? []).map((j) => (
                  <li key={j.name} className="grid gap-2 rounded-xl border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-mono text-xs">{j.name}</div>
                        <div className="text-xs text-muted-foreground">{j.purpose}</div>
                      </div>
                      {j.ownChoice && (
                        <Button size="xs" variant="ghost" onClick={() => void run((s) => s.stories.setJobModel(j.name, null), { success: 'Back on the shared model' })}>
                          Use the shared model
                        </Button>
                      )}
                    </div>
                    <ModelChoice
                      value={(j.selection as AiSelection | null) ?? null}
                      onChange={(sel) => void run((s) => s.stories.setJobModel(j.name, { provider: sel.providerId, model: sel.modelId, thinking: sel.thinking }), { success: `${j.name} now runs on ${sel.modelId}` })}
                    />
                    {!j.ownChoice && <span className="text-[11px] text-muted-foreground">Using the shared model.</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
