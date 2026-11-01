import { describe, expect, it } from 'vitest'
import type { AttentionItem } from '@/domain/ai/AgentApi'
import { cardKind, countKinds, filterCards, nextCard, sortCards } from './attentionCards'

const item = (id: string, over: Partial<AttentionItem> = {}): AttentionItem => ({
  agentId: 'a', agentName: 'Triage', itemId: id, title: id, excerpt: '', label: 'issue', confidence: 0.9, status: 'queued', summary: '', priority: 'normal', action: null, due: null, event: null, note: null, at: '2026-11-01T10:00:00Z', folder: 'INBOX', workspaces: [], ...over,
})

describe('attention cards', () => {
  it('knows a card by what the agent decided', () => {
    expect(cardKind(item('1', { status: 'event_proposed', label: 'meeting' }))).toBe('event')
    expect(cardKind(item('2', { label: 'meeting' }))).toBe('event') // a meeting with no date is still about an event
    expect(cardKind(item('3', { label: 'issue' }))).toBe('issue')
    expect(cardKind(item('4', { label: 'Important' }))).toBe('important')
    expect(cardKind(item('5', { label: null }))).toBe('mail')
  })

  it('puts events to approve first, then the most urgent, then the newest', () => {
    const items = [
      item('low', { priority: 'low' }),
      item('old-high', { priority: 'high', at: '2026-10-30T10:00:00Z' }),
      item('new-high', { priority: 'high', at: '2026-11-01T09:00:00Z' }),
      item('event', { status: 'event_proposed', priority: 'low' }),
    ]
    expect(sortCards(items, 'urgent').map((i) => i.itemId)).toEqual(['event', 'new-high', 'old-high', 'low'])
    expect(sortCards(items, 'newest').map((i) => i.itemId)[3]).toBe('old-high')
    expect(items[0].itemId).toBe('low') // the original is left alone
  })

  it('counts and filters by kind', () => {
    const items = [item('a'), item('b', { label: 'important' }), item('c', { label: 'issue' }), item('d', { status: 'event_proposed' })]
    expect(countKinds(items)).toEqual({ event: 1, issue: 2, important: 1, mail: 0 })
    expect(filterCards(items, 'issue').map((i) => i.itemId)).toEqual(['a', 'c'])
    expect(filterCards(items, 'all')).toHaveLength(4)
  })

  it('moves on to the next card, or the one before when it was the last', () => {
    const items = [item('a'), item('b'), item('c')]
    expect(nextCard(items, items[0])?.itemId).toBe('b')
    expect(nextCard(items, items[2])?.itemId).toBe('b')
    expect(nextCard([items[0]], items[0])).toBeNull()
  })
})
