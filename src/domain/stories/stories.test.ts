import { describe, expect, it } from 'vitest'
import { arcProgress, checkpointsFromLines, currentCheckpoint, moveCheckpoint, phrase, sketchOf } from './Stories'
import type { Checkpoint, Profile } from './Stories'

const cp = (id: string, status: Checkpoint['status'] = 'ahead'): Checkpoint => ({ id, title: id.toUpperCase(), status })

describe('the arc', () => {
  it('is where the first checkpoint not yet passed is', () => {
    const s = { checkpoints: [cp('a', 'reached'), cp('b', 'skipped'), cp('c'), cp('d')] }
    expect(currentCheckpoint(s)?.id).toBe('c')
    expect(arcProgress(s)).toBe(0.5)
    expect(currentCheckpoint({ checkpoints: [cp('a', 'reached')] })).toBeNull()
    expect(arcProgress({ checkpoints: [] })).toBeNull()
  })

  it('reads checkpoints one per line, dropping bullets and numbers', () => {
    let n = 0
    const out = checkpointsFromLines('1. Pick a lender\n- Documents in\n\n  • Sanction letter ', () => `id${n++}`)
    expect(out.map((c) => c.title)).toEqual(['Pick a lender', 'Documents in', 'Sanction letter'])
    expect(out.every((c) => c.status === 'ahead' && c.addedBy === 'you')).toBe(true)
  })

  it('moves a checkpoint one place, never off the ends', () => {
    const list = [cp('a'), cp('b'), cp('c')]
    expect(moveCheckpoint(list, 'b', -1).map((c) => c.id)).toEqual(['b', 'a', 'c'])
    expect(moveCheckpoint(list, 'c', 1)).toBe(list)
  })
})

describe('what is known about a person', () => {
  const profile: Profile = {
    lenses: {
      under_pressure: { label: 'goes_quiet', share: 0.9, weight: 3.6, confidence: 'high', evidence: 4, labels: { goes_quiet: 3.6 } },
      wants: { label: 'money', also: 'avoiding_blame', share: 0.6, weight: 1.8, confidence: 'medium', evidence: 2, labels: { money: 1.1, avoiding_blame: 0.7 } },
      trust: { label: 'ally', share: 0.5, weight: 0.6, confidence: 'low', evidence: 1, labels: { ally: 0.6 } },
    },
    trackRecord: { tries: 10, answerRate: { call: 0.3, message: 0.8 }, bestHours: ['18:00–19:00'], promises: { kept: 2, of: 6 } },
    conflicts: [],
    asOf: '2026-11-12',
  }

  it('sketches only what is fairly sure, in plain words', () => {
    expect(sketchOf('Ravi', profile)).toBe('Ravi goes quiet under bad news, is moved by money and avoids the blame. Reach them by message (answers 80%), best 18:00–19:00. Kept 2 of 6 promised dates.')
    expect(sketchOf('Sam', undefined)).toBe('Not much is known about Sam yet.')
  })

  it('says a label in words, or the label itself when it is the person’s own', () => {
    expect(phrase('agrees_no_delivery')).toBe('agrees, then doesn’t deliver')
    expect(phrase('overpromises_a_lot')).toBe('overpromises a lot')
  })
})
