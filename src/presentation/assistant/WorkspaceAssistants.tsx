import { useState } from 'react'
import { Bot, Check, ChevronDown, Sparkles } from 'lucide-react'
import type { Channel } from '@/domain/ai/AgentApi'
import { WORKSPACE_IDS, WORKSPACES } from '@/domain/shared/workspace'
import type { WorkspaceId } from '@/domain/shared/workspace'
import { cn } from '@/lib/utils'
import { TelegramCard } from '@/presentation/agents/ChannelsTab'
import { useAgentSettings } from '@/presentation/agents/useAgent'
import { ASSISTANT_ID } from './useChatAgents'

/**
 * An assistant for each workspace, each with a Telegram bot of its own. It answers about that workspace only (what is pending, what is on, adding
 * to it), chooses among the agents placed in the workspace, and that workspace's email alerts arrive on the same bot.
 */
export function WorkspaceAssistants({ channels }: { channels: Channel[] }) {
  const [open, setOpen] = useState<WorkspaceId | null>(null)
  const { settings } = useAgentSettings()
  const bots = channels.filter((c) => c.kind === 'telegram' && c.workspace)
  const agentsIn = (ws: WorkspaceId) => (settings?.agents ?? []).filter((a) => a.kind !== 'workflow' && a.workspaces.includes(ws)).map((a) => a.name)
  return (
    <section className="grid gap-3 rounded-xl border p-4">
      <header className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Workspace assistants</h3>
          <p className="text-xs text-muted-foreground">
            Each workspace has its own assistant and its own Telegram bot. Ask the S&amp;B bot what’s pending and it looks at S&amp;B only; it adds to S&amp;B only; and S&amp;B’s email alerts arrive there. Make a bot in @BotFather for each one. The general bot above stays the assistant for everything.
          </p>
        </div>
      </header>
      <ul className="grid gap-2">
        {WORKSPACE_IDS.map((id) => {
          const bot = bots.find((b) => b.workspace === id)
          const shown = open === id
          return (
            <li key={id} className="rounded-lg border">
              <button type="button" onClick={() => setOpen(shown ? null : id)} aria-expanded={shown} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{WORKSPACES[id].short} assistant</span>
                </span>
                {bot ? (
                  <span className="flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-[11px] font-medium text-success">
                    <Check className="size-3" /> @{bot.username}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Not connected</span>
                )}
                <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', shown && 'rotate-180')} />
              </button>
              {shown && (
                <div className="grid gap-3 border-t p-3">
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Bot className="size-3.5" /> Uses:
                    {agentsIn(id).length > 0 ? agentsIn(id).map((n) => <span key={n} className="rounded-md bg-muted px-1.5 py-0.5 font-medium text-foreground">{n}</span>) : <span>no agents are placed in {WORKSPACES[id].short} yet (Developer → an agent → its workspaces)</span>}
                  </p>
                  <TelegramCard agentId={ASSISTANT_ID} channel={bot} workspace={id} />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
