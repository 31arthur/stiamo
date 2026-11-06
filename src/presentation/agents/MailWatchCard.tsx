import { useQueryClient } from '@tanstack/react-query'
import { AlertCircle, BellRing, Check, Radio } from 'lucide-react'
import { Section } from '@/presentation/components/layout'
import type { MailWatch } from '@/domain/ai/AgentApi'
import { useServices } from '@/presentation/app/services'
import { Switch } from '@/presentation/components/Switch'
import { useUserId } from '@/presentation/data/hooks'
import { toast } from '@/presentation/notifications/toast'
import { Link } from '@/presentation/routing'
import { ago } from './format'
import { useMailWatch } from './useAgent'

/**
 * The priority mail watch: an agent for each workspace that has a mailbox, made and kept running for you. It listens all the time and tells your
 * phone about mail that can't wait. This says whether each is listening and what, if anything, stands between it and the phone.
 */
export function MailWatchCard() {
  const { data, isLoading, error } = useMailWatch()
  if (isLoading) return null
  if (error || !data || data.length === 0) return null
  return (
    <Section title="Priority mail watch" description="Always on. Each workspace with a mailbox has an agent reading its new mail as it arrives, and telling your phone about anything that can’t wait." actions={<BellRing className="size-4 text-muted-foreground" />}>
      <ul className="grid divide-y">
        {data.map((w) => (
          <Row key={w.workspace} watch={w} />
        ))}
      </ul>
    </Section>
  )
}

function Row({ watch: w }: { watch: MailWatch }) {
  const { agent } = useServices()
  const client = useQueryClient()
  const userId = useUserId()

  async function toggle(on: boolean) {
    try {
      await agent.setMailWatch(w.workspace, on)
      await client.invalidateQueries({ queryKey: ['agent', 'mailWatch', userId] })
      toast.success(on ? `${w.name}’s mail is being watched again` : `${w.name}’s watch is paused`)
    } catch (e) {
      toast.error('Couldn’t change that', { description: e instanceof Error ? e.message : undefined })
    }
  }

  const problems: { key: string; text: React.ReactNode }[] = []
  if (w.enabled && w.agentId && !w.model) problems.push({ key: 'model', text: <>It needs a model to read mail. <Link to={`/agents/${w.agentId}/settings`} className="underline">Choose one</Link>.</> })
  if (w.enabled && w.phone === 'none') problems.push({ key: 'phone', text: <>No Telegram chat is paired, so alerts only appear in Attention. Connect one under Assistant → On your phone.</> })
  if (w.enabled && w.error) problems.push({ key: 'error', text: w.error })

  return (
    <li className="grid gap-1.5 py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {w.agentId ? (
              <Link to={`/agents/${w.agentId}`} className="text-sm font-medium hover:underline">
                {w.name}
              </Link>
            ) : (
              <span className="text-sm font-medium">{w.name}</span>
            )}
            {!w.enabled ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Paused</span>
            ) : w.listening ? (
              <span className="flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-[11px] font-medium text-success">
                <Radio className="size-3" /> Listening
              </span>
            ) : (
              <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">Starting…</span>
            )}
            {w.enabled && w.phone !== 'none' && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Check className="size-3" /> Alerts to {w.phone === 'workspace' ? `the ${w.name} email bot` : 'your Telegram'}
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {w.mailboxes.join(', ')}
            {w.lastRunAt && ` · last looked ${ago(w.lastRunAt)}`}
          </p>
        </div>
        <Switch checked={w.enabled} onChange={(on) => void toggle(on)} label={`Watch ${w.name} mail`} />
      </div>
      {problems.map((p) => (
        <p key={p.key} className="flex items-start gap-1.5 text-xs text-warning">
          <AlertCircle className="mt-px size-3.5 shrink-0" /> <span>{p.text}</span>
        </p>
      ))}
    </li>
  )
}

