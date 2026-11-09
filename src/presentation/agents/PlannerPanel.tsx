import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import type { DayPlanSettings } from '@/domain/ai/AgentApi'
import { WORKSPACES } from '@/domain/shared/workspace'
import type { WorkspaceId } from '@/domain/shared/workspace'
import { Section } from '@/presentation/components/layout'
import { WorkspaceBadge } from '@/presentation/components/workspace'
import { useServices } from '@/presentation/app/services'
import { useUserId } from '@/presentation/data/hooks'
import { toast } from '@/presentation/notifications/toast'
import { Link } from '@/presentation/routing'
import { ago } from './format'
import { useDayPlans } from './useAgent'

const ZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Riyadh', 'Asia/Singapore', 'Europe/London', 'America/New_York', 'UTC']
/** The workspaces that plan their own day. */
const PLANNED: WorkspaceId[] = ['personal', 'sb', 'fsa']

/** When the daily planner plans tomorrow by itself, which workspaces get a plan of their own, and where each is sent. Most days end at nine. */
export function PlannerPanel() {
  const { agent } = useServices()
  const client = useQueryClient()
  const userId = useUserId()
  const { data } = useDayPlans()
  const [draft, setDraft] = useState<DayPlanSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [planning, setPlanning] = useState<string | null>(null)
  const saved = data?.settings
  useEffect(() => {
    if (saved && !draft) setDraft(saved)
  }, [saved, draft])
  if (!saved || !draft) return null

  const dirty = JSON.stringify(saved) !== JSON.stringify(draft)
  const set = (patch: Partial<DayPlanSettings>) => setDraft({ ...draft, ...patch })
  const waiting = data?.plans.filter((p) => p.status === 'proposed') ?? []
  const chosen = draft.workspaces ?? []
  const toggle = (ws: WorkspaceId) => set({ workspaces: chosen.includes(ws) ? chosen.filter((w) => w !== ws) : [...chosen, ws] })

  async function save() {
    setSaving(true)
    try {
      await agent.setDayPlanSettings(draft!)
      await client.invalidateQueries({ queryKey: ['agent', 'dayPlans', userId] })
      toast.success(draft!.enabled ? `Tomorrow gets planned every evening at ${draft!.time}` : 'The evening plan is off')
    } catch (e) {
      toast.error('Couldn’t save that', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setSaving(false)
    }
  }

  /** Plans tomorrow for one workspace, or for every chosen workspace in turn (one plan across everything when none is chosen). */
  async function planNow(workspace?: WorkspaceId) {
    const which: (WorkspaceId | undefined)[] = workspace ? [workspace] : chosen.length > 0 ? (chosen as WorkspaceId[]) : [undefined]
    setPlanning(workspace ?? 'all')
    const made: string[] = []
    let failed: string | undefined
    for (const ws of which) {
      try {
        const plan = await agent.generateDayPlan(undefined, true, ws)
        made.push(format(parseISO(plan.day), 'EEEE d MMMM'))
      } catch (e) {
        failed = e instanceof Error ? e.message : 'The planner couldn’t answer.'
      }
    }
    await client.invalidateQueries({ queryKey: ['agent', 'dayPlans', userId] })
    setPlanning(null)
    if (made.length > 0) toast.success(`Planned ${made[0]}${made.length > 1 ? ` for ${made.length} workspaces` : ''}`, { description: 'Waiting in Needs me, and on your phone, for you to approve.' })
    if (failed) toast.error(made.length > 0 ? 'One plan couldn’t be made' : 'Couldn’t plan the day', { description: failed })
  }

  return (
    <Section
      title="Evening plan"
      description="At the end of the day the planner reads tomorrow, workspace by workspace, and proposes what to prepare, who to call and what to do when. Each plan goes to that workspace's own Telegram bot with Approve and Not this buttons, and an approved plan is added to its Google calendar."
      actions={
        <Button variant="outline" size="sm" onClick={() => void planNow()} disabled={planning !== null}>
          {planning === 'all' ? <Spinner size="xs" tone="current" decorative /> : <CalendarClock />} Plan tomorrow now
        </Button>
      }
    >
      <div className="grid gap-4">
        <label className="flex items-center gap-2.5 text-sm font-medium">
          <input type="checkbox" checked={draft.enabled} onChange={(e) => set({ enabled: e.target.checked })} className="size-4 accent-[var(--foreground)]" />
          Plan tomorrow every evening
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            At
            <Input type="time" value={draft.time} onChange={(e) => set({ time: e.target.value })} disabled={!draft.enabled} className="w-36" />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Time zone
            <Input list="planner-zones" value={draft.timezone} onChange={(e) => set({ timezone: e.target.value })} disabled={!draft.enabled} className="max-w-60" />
            <datalist id="planner-zones">
              {ZONES.map((z) => (
                <option key={z} value={z} />
              ))}
            </datalist>
          </label>
        </div>
        <fieldset className="grid gap-1.5">
          <legend className="mb-1 text-xs font-medium text-muted-foreground">A plan of its own for</legend>
          {PLANNED.map((ws) => (
            <div key={ws} className="flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm">
              <input type="checkbox" id={`plan-${ws}`} checked={chosen.includes(ws)} onChange={() => toggle(ws)} disabled={!draft.enabled} className="size-4 accent-[var(--foreground)]" />
              <label htmlFor={`plan-${ws}`} className="flex min-w-0 flex-1 items-center gap-2">
                <WorkspaceBadge ws={ws} />
                <span className="truncate text-muted-foreground">{WORKSPACES[ws].name}</span>
              </label>
              <Button variant="ghost" size="xs" onClick={() => void planNow(ws)} disabled={planning !== null}>
                {planning === ws ? <Spinner size="xs" tone="current" decorative /> : <CalendarClock />} Plan now
              </Button>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            A workspace with nothing open is skipped. With none ticked, one plan covers everything. Connect each workspace's bot under{' '}
            <Link to="/assistant" className="underline">
              the Assistant
            </Link>
            , and its Google account under Calendar.
          </p>
        </fieldset>
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" checked={draft.channels} onChange={(e) => set({ channels: e.target.checked })} disabled={!draft.enabled} className="mt-0.5 size-4 accent-[var(--foreground)]" />
          <span>
            Also send it to my phone
            <span className="block text-xs text-muted-foreground">
              A workspace without a bot of its own uses your general Telegram bot or WhatsApp (<Link to="/agents/daily-planner/channels" className="underline">Channels</Link>).
            </span>
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={() => void save()} disabled={!dirty || saving}>
            {saving ? <Spinner size="xs" tone="current" decorative /> : <Send />} Save
          </Button>
          {saved.enabled && data?.schedule.nextRunAt && !dirty && <span className="text-xs text-muted-foreground">Next plan {ago(data.schedule.nextRunAt)}</span>}
          {data?.schedule.error && (
            <span role="alert" className="text-xs text-destructive">
              The last plan failed: {data.schedule.error}
            </span>
          )}
          {waiting.length > 0 && (
            <Link to="/needs" className="ml-auto text-xs font-medium hover:underline">
              {waiting.length === 1 ? `A plan for ${format(parseISO(waiting[0]!.day), 'EEE d MMM')} is waiting for you` : `${waiting.length} plans are waiting for you`}
            </Link>
          )}
        </div>
      </div>
    </Section>
  )
}
