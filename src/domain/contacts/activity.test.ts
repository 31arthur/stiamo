import { describe, expect, it } from 'vitest'
import type { FollowUp } from '../followups/FollowUp'
import type { Task } from '../tasks/Task'
import { activityOf } from './activity'

const person = { id: 'a1:abc', phones: [{ value: '+91 98765 43210', label: 'mobile' }], emails: [{ value: 'Ada@Labour.gov.in', label: 'work' }] }

const fu = (over: Partial<FollowUp>): FollowUp => ({ id: 'f', userId: 'u', createdAt: '', updatedAt: '', title: 'Call', channel: 'call', workspace: 'sb', duration: 15, outcome: { status: 'open' }, ...over }) as FollowUp
const task = (over: Partial<Task>): Task => ({ id: 't', userId: 'u', createdAt: '', updatedAt: '', title: 'Do', notes: '', workspace: 'sb', priority: 'normal', estimate: 30, outcome: { status: 'open' }, ...over }) as Task

describe('what the practice has done with a person', () => {
  it('finds their follow-ups by the contact they point at, or by a number or address of theirs, but never by name alone', () => {
    const items = [
      fu({ id: '1', contactId: 'a1:abc', contact: 'someone' }),
      fu({ id: '2', contact: 'Ada · 098765 43210' }),
      fu({ id: '3', contact: 'ada@labour.gov.in' }),
      fu({ id: '4', contact: 'Ada Lovelace' }),
      fu({ id: '5', contact: 'Other · +91 90000 11111' }),
    ]
    expect(activityOf(person, items, []).followUps.map((f) => f.id).sort()).toEqual(['1', '2', '3'])
  })

  it('counts the tries and the ones that got through, and when', () => {
    const calls = [
      fu({ id: '1', contactId: 'a1:abc', due: { date: '2026-11-02' }, attempts: [{ date: '2026-11-02', minute: 600, result: 'no_answer' }, { date: '2026-11-03', minute: 600, result: 'reached' }] }),
      fu({ id: '2', contactId: 'a1:abc', due: { date: '2026-11-05' }, attempts: [{ date: '2026-11-05', minute: 600, result: 'left_message' }] }),
    ]
    const a = activityOf(person, calls, [task({ id: 't1', contactId: 'a1:abc' }), task({ id: 't2', contactId: 'a1:abc', outcome: { status: 'done' } })])
    expect([a.tries, a.reached, a.lastReached, a.lastTried, a.openFollowUps, a.openTasks]).toEqual([3, 1, '2026-11-03', '2026-11-05', 2, 1])
    expect(a.followUps[0]!.id).toBe('2') // newest first
  })

  it('says nothing about someone with no history', () => {
    expect(activityOf(person, [], [])).toMatchObject({ tries: 0, reached: 0, lastReached: undefined, openFollowUps: 0 })
  })
})
