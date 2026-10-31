import { Bot } from 'lucide-react'
import type { AgentSummary } from '@/domain/ai/AgentApi'

const SELECT = 'h-8 rounded-lg border border-input bg-transparent px-2 text-sm font-medium outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

/** Which agent: shown only once there is more than one to choose from. */
export function AgentPicker({ agents, value, onChange, label = 'Agent' }: { agents: AgentSummary[]; value: string; onChange: (id: string) => void; label?: string }) {
  if (agents.length < 2) return null
  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Bot className="size-3.5" />
      <span className="sr-only sm:not-sr-only">{label}</span>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={SELECT} title={agents.find((a) => a.id === value)?.description}>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
    </label>
  )
}
