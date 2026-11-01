import { useQueryClient } from '@tanstack/react-query'
import type { AttentionEvent, AttentionItem } from '@/domain/ai/AgentApi'
import { useServices } from '@/presentation/app/services'
import { useUserId } from '@/presentation/data/hooks'
import { toast } from '@/presentation/notifications/toast'

export type AttentionAction = 'done' | 'dismiss' | 'approve_event' | 'skip_event'

type Queue = { items: AttentionItem[]; count: number }

/**
 * Deciding about a card. It leaves the queue at once, the server is told in the background, and a toast says how it went; if the server
 * says no the card comes back. One function for every card, so a new kind of decision is added here and nowhere else.
 */
export function useAttentionActions() {
  const { agent } = useServices()
  const client = useQueryClient()
  const userId = useUserId()

  return async (item: AttentionItem, action: AttentionAction, event?: AttentionEvent) => {
    const key = ['agent', 'attention', userId]
    const before = client.getQueriesData<Queue>({ queryKey: key })
    const same = (i: AttentionItem) => i.agentId === item.agentId && i.itemId === item.itemId
    client.setQueriesData<Queue>({ queryKey: key }, (d) => {
      if (!d) return d
      const items = action === 'skip_event' ? d.items.map((i) => (same(i) ? { ...i, status: 'queued' as const, event: null } : i)) : d.items.filter((i) => !same(i))
      return { ...d, items, count: items.length }
    })
    const pending = toast.loading(action === 'approve_event' ? 'Adding it to your calendar…' : 'Saving…')
    try {
      await agent.actOnAttention({ agentId: item.agentId, itemId: item.itemId, action, event })
      toast.success(action === 'approve_event' ? 'Added to your calendar' : action === 'done' ? 'Marked as done' : action === 'dismiss' ? 'Marked as not important' : 'Kept without the event', {
        id: pending,
        description: action === 'approve_event' && event ? `${event.title}, ${event.date}${event.start ? ` at ${event.start}` : ''}` : undefined,
      })
    } catch (e) {
      for (const [k, d] of before) client.setQueryData(k, d)
      toast.error('Couldn’t save that. It is back in the queue.', { id: pending, description: e instanceof Error ? e.message : undefined })
    } finally {
      void client.invalidateQueries({ queryKey: key })
      if (action === 'approve_event') for (const k of ['meetings', 'calendar']) void client.invalidateQueries({ queryKey: [k] })
    }
  }
}
