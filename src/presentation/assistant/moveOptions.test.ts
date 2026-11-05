import { describe, expect, it } from 'vitest'
import { moveOptions } from './moveOptions'

describe('where a task can be moved to in one tap', () => {
  it('offers today, tomorrow, the day after by name, and next Monday', () => {
    // Thursday 5 November 2026
    expect(moveOptions('2026-11-05')).toEqual([
      { label: 'Today', date: '2026-11-05' },
      { label: 'Tomorrow', date: '2026-11-06' },
      { label: 'Saturday', date: '2026-11-07' },
      { label: 'Next Monday', date: '2026-11-09' },
    ])
  })

  it('never offers the same day twice', () => {
    // Sunday 8 November: the day after tomorrow is Tuesday, and next Monday is tomorrow
    const dates = moveOptions('2026-11-08').map((o) => o.date)
    expect(new Set(dates).size).toBe(dates.length)
  })
})
