import { describe, expect, it } from 'vitest'
import type { ExecutionItem } from '@/domain/ai/AgentApi'
import { mailRef, parseMail, sortItems } from './executions'

const item = (id: string, subject: string, from: string, confidence: number): ExecutionItem => ({
  id, title: subject, excerpt: `From: ${from}\nSubject: ${subject}\n\nbody`, label: 'spam', confidence, reason: '', status: 'needs_review', at: null, decidedAt: null,
})

describe('executions', () => {
  it('reads the sender, subject and text from what the agent kept', () => {
    const m = parseMail('From: "David Hogg" <info@e.example.com>\nSubject: The last weekend\n\nX-MSFB\nmore')
    expect(m).toMatchObject({ sender: 'David Hogg', subject: 'The last weekend', body: 'X-MSFB\nmore' })
    expect(parseMail('From: lone@example.com\nSubject: s').sender).toBe('lone@example.com')
    expect(parseMail('nothing like mail')).toMatchObject({ from: '', subject: '' })
  })

  it('finds the mailbox and message an item came from', () => {
    expect(mailRef('3f2a-uuid-1:7:4321')).toEqual({ accountId: '3f2a-uuid-1', uid: 4321 })
    expect(mailRef('m-abc123')).toBeNull()
  })

  it('sorts by how sure, by subject and by sender', () => {
    const items = [item('a:1:1', 'Zebra', 'Bob <b@x.com>', 0.9), item('a:1:2', 'apple', 'Zed <z@x.com>', 0.5), item('a:1:3', 'Mango', 'Amy <a@x.com>', 0.7)]
    expect(sortItems(items, 'sure-asc').map((i) => i.confidence)).toEqual([0.5, 0.7, 0.9])
    expect(sortItems(items, 'sure-desc')[0].confidence).toBe(0.9)
    expect(sortItems(items, 'subject').map((i) => i.title)).toEqual(['apple', 'Mango', 'Zebra'])
    expect(sortItems(items, 'sender').map((i) => i.id)).toEqual(['a:1:3', 'a:1:1', 'a:1:2'])
    expect(items[0].title).toBe('Zebra') // the original is left alone
  })
})
