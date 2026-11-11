import { ChevronRight, MessageSquare, Network, Route, Shield, Sparkles, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Link } from '@/presentation/routing'
import { Section } from '@/presentation/components/layout'
import { useAgentSettings } from './useAgent'

/**
 * The master assistant as a workflow: one bot in, the workspace worked out, an agent chosen, the answer back signed with both. Each agent is a
 * node that opens its own workflow. (The same flow runs for the chat in the app and for Telegram and WhatsApp.)
 */
export function MasterFlow() {
  const { settings } = useAgentSettings()
  const team = (settings?.agents ?? []).filter((a) => a.kind !== 'workflow')
  const jev = settings?.decision.enabled
  const step = (Icon: typeof Zap, title: string, text: string) => (
    <div className="flex w-36 flex-col gap-0.5 rounded-xl border bg-card px-3 py-2.5 text-sm sm:w-40">
      <span className="flex items-center gap-1.5 font-medium">
        <Icon className="size-4 text-muted-foreground" /> {title}
      </span>
      <span className="text-[11px] text-muted-foreground">{text}</span>
    </div>
  )
  const arrow = <ChevronRight aria-hidden className="mx-1 size-4 shrink-0 text-muted-foreground/60" />
  return (
    <Section title="Master assistant" description="One bot and one chat for everything. It decides the workspace and the agent for each message; every agent underneath only ever sees the one workspace it was asked about.">
      <div className="grid gap-3">
        <ol className="flex flex-wrap items-stretch gap-y-2" aria-label="Master assistant workflow">
          <li className="flex items-center">{step(Zap, 'Message', 'Telegram, WhatsApp or the app')}{arrow}</li>
          <li className="flex items-center">{step(Shield, 'Workspace', 'From the words; asks with buttons if unclear')}{arrow}</li>
          <li className="flex items-center">{step(Route, 'Choose agent', jev ? 'Decision model (Jev), else rules' : 'By rules (turn on Jev for smarter routing)')}{arrow}</li>
          <li className="flex items-center">{step(MessageSquare, 'Answer', 'Signed with the agent and workspace')}</li>
        </ol>
        <div className="rounded-xl border border-dashed p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
            <Sparkles className="size-3.5" /> Agents underneath · open one to see its nodes and executions
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {team.map((a) => (
              <li key={a.id}>
                <Link to={`/agents/${a.id}/workflow`} className={cn('flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-sm transition-colors hover:border-foreground/40')}>
                  <Network className="size-3.5 text-muted-foreground" /> {a.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  )
}
