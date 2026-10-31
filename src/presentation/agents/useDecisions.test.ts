import { describe, expect, it } from 'vitest'
import type { ExecutionDetail, ExecutionItem } from '@/domain/ai/AgentApi'
import { decided } from './useDecisions'

const item = (id: string, status: ExecutionItem['status'], label: string | null = 'spam'): ExecutionItem => ({ id, title: id, excerpt: '', label, confidence: 0.6, reason: '', status, at: null, decidedAt: null })
const run = (items: ExecutionItem[]): ExecutionDetail => ({ execution: { id: 'r', startedAt: '', durationMs: 0, status: 'ok', summary: '', counts: {}, stats: {}, error: null, version: 1, now: { needs_review: 2, kept: 1 } }, items })

describe('approving and dismissing before the server answers', () => {
  const d = run([item('a', 'needs_review'), item('b', 'needs_review'), item('c', 'kept', 'keep')])

  it('moves the chosen emails out of their group and recounts the run', () => {
    const out = decided(d, new Map([['a', undefined]]), 'approved')
    expect(out.items.map((i) => [i.id, i.status])).toEqual([['a', 'approved'], ['b', 'needs_review'], ['c', 'kept']])
    expect(out.execution.now).toEqual({ approved: 1, needs_review: 1, kept: 1 })
  })

  it('uses the label the person chose, and leaves the original untouched', () => {
    const out = decided(d, new Map([['b', 'keep']]), 'approved')
    expect(out.items[1]).toMatchObject({ status: 'approved', label: 'keep' })
    expect(d.items[1]).toMatchObject({ status: 'needs_review', label: 'spam' }) // so a failure can put it back
  })

  it('counts a dismissal', () => {
    expect(decided(d, new Map([['a', undefined], ['b', undefined]]), 'dismissed').execution.now).toEqual({ dismissed: 2, kept: 1 })
  })
})
