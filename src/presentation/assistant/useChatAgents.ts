import { useMemo } from 'react'
import type { AgentSummary } from '@/domain/ai/AgentApi'
import { useAgentSettings } from '@/presentation/agents/useAgent'

/** The agents that can be talked to here: the team (not the ones built for one job), those shown in this workspace. The Daily planner first. */
export function useChatAgents(scope: string): AgentSummary[] {
  const { settings } = useAgentSettings()
  return useMemo(() => {
    const all = (settings?.agents ?? []).filter((a) => a.kind !== 'workflow' && (scope === 'all' || a.workspaces.includes(scope)))
    return [...all].sort((a, b) => Number(b.id === 'daily-planner') - Number(a.id === 'daily-planner'))
  }, [settings, scope])
}

const LAST = 'stiamo.assistant.agent'

/** The agent used last, so a new chat starts with it. */
export function lastAgent(): string | null {
  try {
    return localStorage.getItem(LAST)
  } catch {
    return null
  }
}

export function rememberAgent(id: string) {
  try {
    localStorage.setItem(LAST, id)
  } catch {
    // A convenience only.
  }
}
