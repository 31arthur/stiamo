import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import type { DayPlanSettings } from '@/domain/ai/AgentApi'
import { Section } from '@/presentation/components/layout'
import { useServices } from '@/presentation/app/services'
import { useUserId } from '@/presentation/data/hooks'
import { toast } from '@/presentation/notifications/toast'
import { Link } from '@/presentation/routing'
import { ago } from './format'
import { useDayPlans } from './useAgent'

const ZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Riyadh', 'Asia/Singapore', 'Europe/London', 'America/New_York', 'UTC']

/** When the daily planner plans tomorrow by itself, and where it tells you. Most days end at nine, so that is where it starts. */
export function PlannerPanel() {
  const { agent } = useServices()
  const client = useQueryClient()
  const userId = useUserId()
  const { data } = useDayPlans()
  const [draft, setDraft] = useState<DayPlanSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [planning, setPlanning] = useState(false)
  const saved = data?.settings
  useEffect(() => {
    if (saved && !draft) setDraft(saved)
  }, [saved, draft])
  if (!saved || !draft) return null

  const dirty = JSON.stringify(saved) !== JSON.stringify(draft)
  const set = (patch: Partial<DayPlanSettings>) => setDraft({ ...draft, ...patch })
  const waiting = data?.plans.find((p) => p.status === 'proposed')

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

  async function planNow() {
    setPlanning(true)
    try {
      const plan = await agent.generateDayPlan(undefined, true)
      await client.invalidateQueries({ queryKey: ['agent', 'dayPlans', userId] })
      toast.success(`Planned ${format(parseISO(plan.day), 'EEEE d MMMM')}`, { description: 'It is waiting in Attention for you to approve.' })
    } catch (e) {
      toast.error('Couldn’t plan the day', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setPlanning(false)
    }
  }

  return (
    <Section
      title="Evening plan"
      description="At the end of the day the planner reads tomorrow, and proposes what to prepare, who to call and what to do when. It appears in Attention for you to approve."
      actions={
        <Button variant="outline" size="sm" onClick={() => void planNow()} disabled={planning}>
          {planning ? <Spinner size="xs" tone="current" decorative /> : <CalendarClock />} Plan tomorrow now
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
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" checked={draft.channels} onChange={(e) => set({ channels: e.target.checked })} disabled={!draft.enabled} className="mt-0.5 size-4 accent-[var(--foreground)]" />
          <span>
            Also send it to my phone
            <span className="block text-xs text-muted-foreground">
              Through the Telegram chats and WhatsApp numbers you have connected (<Link to="/agents/daily-planner/channels" className="underline">Channels</Link>).
            </span>
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={() => void save()} disabled={!dirty || saving}>
            {saving ? <Spinner size="xs" tone="current" decorative /> : <Send />} Save
          </Button>
          {saved.enabled && data?.schedule.nextRunAt && !dirty && <span className="text-xs text-muted-foreground">Next plan {ago(data.schedule.nextRunAt)}</span>}
          {data?.schedule.error && <span role="alert" className="text-xs text-destructive">The last plan failed: {data.schedule.error}</span>}
          {waiting && (
            <Link to="/attention" className="ml-auto text-xs font-medium hover:underline">
              A plan for {format(parseISO(waiting.day), 'EEE d MMM')} is waiting for you
            </Link>
          )}
        </div>
      </div>
    </Section>
  )
}
