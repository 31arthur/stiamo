import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Conversation, ConversationSummary, ConversationTurn } from '@/domain/ai/AgentApi'
import { useServices } from '@/presentation/app/services'
import { useUserId } from '@/presentation/data/hooks'
import { useAgentAvailable } from '@/presentation/agents/useAgent'

/** The person's chats in a workspace (or every one under "all"), newest first. */
export function useConversations(scope: string) {
  const { agent } = useServices()
  const userId = useUserId()
  const enabled = useAgentAvailable()
  return useQuery<ConversationSummary[]>({ queryKey: ['agent', 'conversations', userId, scope], queryFn: () => agent.conversations(scope), enabled, staleTime: 15_000, retry: false })
}

export function useConversation(id: string | undefined) {
  const { agent } = useServices()
  const userId = useUserId()
  return useQuery<Conversation>({ queryKey: ['agent', 'conversation', userId, id], queryFn: () => agent.conversation(id!), enabled: !!id, staleTime: 30_000, retry: false })
}

/** What the person can do with their chats; each keeps the lists and the open chat in step. */
export function useConversationActions() {
  const { agent } = useServices()
  const client = useQueryClient()
  const userId = useUserId()
  const refreshLists = () => client.invalidateQueries({ queryKey: ['agent', 'conversations', userId] })

  return {
    async start(agentId: string, workspace: string): Promise<Conversation> {
      const c = await agent.startConversation(agentId, workspace)
      client.setQueryData(['agent', 'conversation', userId, c.id], c)
      void refreshLists()
      return c
    },
    async say(id: string, message: string): Promise<ConversationTurn> {
      const { turn, conversation } = await agent.say(id, message)
      client.setQueryData<Conversation>(['agent', 'conversation', userId, id], (c) => c && { ...c, title: conversation.title, updatedAt: conversation.updatedAt, turns: [...c.turns, turn] })
      void refreshLists()
      return turn
    },
    async rename(id: string, title: string) {
      const s = await agent.renameConversation(id, title)
      client.setQueryData<Conversation>(['agent', 'conversation', userId, id], (c) => c && { ...c, title: s.title })
      void refreshLists()
    },
    async remove(id: string) {
      await agent.deleteConversation(id)
      client.removeQueries({ queryKey: ['agent', 'conversation', userId, id] })
      await refreshLists()
    },
  }
}
