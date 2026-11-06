import { useState } from 'react'
import { Check, ChevronDown, Inbox } from 'lucide-react'
import type { Channel } from '@/domain/ai/AgentApi'
import { WORKSPACE_IDS, WORKSPACES } from '@/domain/shared/workspace'
import type { WorkspaceId } from '@/domain/shared/workspace'
import { cn } from '@/lib/utils'
import { TelegramCard } from '@/presentation/agents/ChannelsTab'
import { ASSISTANT_ID } from './useChatAgents'

/** A Telegram bot for each workspace's email, so S&B's mail doesn't arrive in the same chat as your personal mail. */
export function EmailBots({ channels }: { channels: Channel[] }) {
  const [open, setOpen] = useState<WorkspaceId | null>(null)
  const bots = channels.filter((c) => c.kind === 'telegram' && c.workspace)
  return (
    <section className="grid gap-3 rounded-xl border p-4">
      <header className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
          <Inbox className="size-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Email bots</h3>
          <p className="text-xs text-muted-foreground">One bot for each workspace. Alerts about a workspace’s mail arrive only on its bot. Turn them on for an agent under its <b>Email updates</b> setting.</p>
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
                  <span className="font-medium">{WORKSPACES[id].name}</span>
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
                <div className="border-t p-3">
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
