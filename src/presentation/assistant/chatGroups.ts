import type { ConversationSummary } from '@/domain/ai/AgentApi'

export interface ChatGroup {
  label: string
  items: ConversationSummary[]
}

const DAY = 86_400_000

/** The chats by how long ago they were last used: today, yesterday, the last week, and earlier. Newest first within each. */
export function groupChats(items: ConversationSummary[], now = new Date()): ChatGroup[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const buckets: ChatGroup[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Previous 7 days', items: [] },
    { label: 'Earlier', items: [] },
  ]
  for (const c of [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))) {
    const at = Date.parse(c.updatedAt)
    buckets[at >= startOfToday ? 0 : at >= startOfToday - DAY ? 1 : at >= startOfToday - 7 * DAY ? 2 : 3].items.push(c)
  }
  return buckets.filter((b) => b.items.length > 0)
}
