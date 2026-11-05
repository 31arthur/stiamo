import { describe, expect, it } from 'vitest'
import type { ConversationSummary } from '@/domain/ai/AgentApi'
import { groupChats } from './chatGroups'

const chat = (id: string, updatedAt: string): ConversationSummary => ({ id, agentId: 'daily-planner', workspace: 'sb', title: id, updatedAt, createdAt: updatedAt, turns: 1, preview: '' })

describe('the chat list', () => {
  it('groups chats by how long ago they were used, newest first, and leaves out empty groups', () => {
    const now = new Date(2026, 10, 10, 15, 0) // 10 Nov, 3 pm
    const at = (daysAgo: number, hour = 9) => new Date(2026, 10, 10 - daysAgo, hour).toISOString()
    const groups = groupChats([chat('old', at(30)), chat('week', at(4)), chat('morning', at(0, 8)), chat('yest', at(1, 22)), chat('noon', at(0, 12))], now)
    expect(groups.map((g) => g.label)).toEqual(['Today', 'Yesterday', 'Previous 7 days', 'Earlier'])
    expect(groups[0].items.map((c) => c.id)).toEqual(['noon', 'morning'])
    expect(groupChats([chat('only', at(0))], now).map((g) => g.label)).toEqual(['Today'])
  })
})
