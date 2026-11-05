import { useMemo } from 'react'
import type { AgentSummary } from '@/domain/ai/AgentApi'
import { useAgentSettings } from '@/presentation/agents/useAgent'

/** The Assistant: not an agent of its own but the one you talk to, which chooses the right agent for each message. */
export const ASSISTANT_ID = 'assistant'

const ASSISTANT_SUGGESTIONS = ['Plan tomorrow', 'Who should I call today?', 'Prepare me for my next hearing', 'What is due this week?']

/**
 * Who can be talked to: first the Assistant (it works across every workspace and chooses the agent), then the team's own agents for
 * when you want one in particular. The ones built for a single job are not chat agents.
 */
export function useChatAgents(scope: string): AgentSummary[] {
  const { settings } = useAgentSettings()
  return useMemo(() => {
    const team = (settings?.agents ?? []).filter((a) => a.kind !== 'workflow' && (scope === 'all' || a.workspaces.includes(scope)))
    const sorted = [...team].sort((a, b) => Number(b.id === 'daily-planner') - Number(a.id === 'daily-planner'))
    const assistant: AgentSummary = {
      id: ASSISTANT_ID,
      kind: 'chat',
      name: 'Assistant',
      description: 'Ask anything. It picks the right agent for the job and keeps the thread of the conversation.',
      suggestions: ASSISTANT_SUGGESTIONS,
      selection: sorted.find((a) => a.selection)?.selection ?? null,
      selectionInherited: false,
      customPrompt: false,
      workspaces: [],
    }
    return team.length > 0 ? [assistant, ...sorted] : []
  }, [settings, scope])
}

const LAST = 'stiamo.assistant.agent'

/** The agent used last, so a new chat starts with it (the Assistant, until another is chosen). */
export function lastAgent(): string {
  try {
    return localStorage.getItem(LAST) ?? ASSISTANT_ID
  } catch {
    return ASSISTANT_ID
  }
}

export function rememberAgent(id: string) {
  try {
    localStorage.setItem(LAST, id)
  } catch {
    // A convenience only.
  }
}
