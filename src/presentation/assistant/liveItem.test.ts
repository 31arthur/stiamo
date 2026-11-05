import { describe, expect, it } from 'vitest'
import type { BriefingItem } from '@/domain/ai/AgentApi'
import type { FollowUp } from '@/domain/followups/FollowUp'
import type { Task } from '@/domain/tasks/Task'
import { movedNote } from './liveItem'

const DAY = '2026-11-07'
const call = (over: Partial<FollowUp> = {}) => ({ id: 'f1', title: 'Call', channel: 'call', duration: 15, due: { date: DAY, time: 540 }, outcome: { status: 'open' }, ...over }) as unknown as FollowUp
const task = (over: Partial<Task> = {}) => ({ id: 't1', title: 'Draft', estimate: 30, outcome: { status: 'open' }, ...over }) as unknown as Task
const item = (over: Partial<BriefingItem> = {}): BriefingItem => ({ type: 'followUp', id: 'f1', title: 'Call', time: '09:00–09:15', ...over })

describe('what a briefing tile says about where its item is now', () => {
  it('shows the time as it was made when nothing has changed', () => {
    expect(movedNote(item(), call(), DAY)).toEqual({ time: '09:00–09:15', movedTo: undefined, changed: false })
  })

  it('shows the new time when it is moved within the day', () => {
    expect(movedNote(item(), call({ due: { date: DAY, time: 900 } }), DAY)).toEqual({ time: '15:00–15:15', movedTo: undefined, changed: true })
  })

  it('says where it went when it is moved to another day', () => {
    const moved = movedNote(item(), call({ due: { date: '2026-11-09', time: 600 } }), DAY)
    expect(moved.movedTo).toBe('Mon 9 Nov · 10:00–10:15')
    expect(moved.changed).toBe(true)
    expect(moved.time).toBeUndefined()
  })

  it('does not call an overdue task moved just because it was due on an earlier day', () => {
    const overdue = item({ type: 'task', id: 't1', time: undefined, due: '2026-11-02' })
    expect(movedNote(overdue, task({ dueDate: '2026-11-02' }), DAY).changed).toBe(false)
    expect(movedNote(overdue, task({ dueDate: '2026-11-09' }), DAY).movedTo).toBe('Mon 9 Nov')
  })

  it('falls back to the card when the record is not at hand', () => {
    expect(movedNote(item(), undefined, DAY)).toEqual({ time: '09:00–09:15', changed: false })
  })
})
