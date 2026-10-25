import { describe, expect, it } from 'vitest'
import type { CalendarItem } from '@/domain/calendar/entities/CalendarItem'
import { buildDayPlan, clampBlock, DAY_END, DAY_START, packDay } from './dayPlan'

let seq = 0
const item = (overrides: Partial<CalendarItem>): CalendarItem => ({
  id: `i${++seq}`,
  userId: 'u',
  title: 'x',
  notes: '',
  date: '2026-10-25',
  type: 'task',
  completed: false,
  ...overrides,
})
const at = (h: number, m = 0) => h * 60 + m

describe('packDay', () => {
  it('packs flexible blocks back-to-back and flows around pinned meetings', () => {
    const meeting = item({ type: 'meeting', schedule: { start: at(10), duration: 60 } })
    const a = item({ schedule: { start: at(14), duration: 45 } })
    const b = item({ schedule: { start: at(15), duration: 30 } })
    const changed = packDay([meeting, a, b], [], { from: at(9, 20), gap: 0 })
    const byId = new Map(changed.map((i) => [i.id, i.schedule]))
    // 09:20 rounds up to 09:30, but 45m would collide with the meeting, so it lands after it; order is preserved.
    expect(byId.get(a.id)).toEqual({ start: at(11), duration: 45 })
    expect(byId.get(b.id)).toEqual({ start: at(11, 45), duration: 30 })
    expect(byId.has(meeting.id)).toBe(false)
  })

  it('keeps completed and already-finished blocks fixed, and applies the gap', () => {
    const done = item({ completed: true, schedule: { start: at(9), duration: 60 } })
    const past = item({ schedule: { start: at(7), duration: 30 } })
    const later = item({ schedule: { start: at(16), duration: 30 } })
    const extra = item({ type: 'follow_up' })
    const changed = packDay([done, past, later, extra], [extra], { from: at(9), gap: 10 })
    expect(changed.map((i) => [i.id, i.schedule.start])).toEqual([
      [later.id, at(10)],
      [extra.id, at(10, 40)],
    ])
  })

  it('skips items that no longer fit in the day', () => {
    const big = item({ schedule: { start: at(8), duration: 120 } })
    expect(packDay([big], [], { from: at(23), gap: 0 })).toEqual([])
  })
})

describe('buildDayPlan', () => {
  it('flags overlaps and lays them out side by side', () => {
    const a = item({ schedule: { start: at(9), duration: 60 } })
    const b = item({ schedule: { start: at(9, 30), duration: 60 } })
    const c = item({ schedule: { start: at(11), duration: 30 } })
    const u = item({})
    const plan = buildDayPlan([a, b, c, u])
    expect([...plan.conflicts].sort()).toEqual([a.id, b.id].sort())
    expect(plan.layout.get(a.id)).toEqual({ column: 0, columns: 2 })
    expect(plan.layout.get(b.id)).toEqual({ column: 1, columns: 2 })
    expect(plan.layout.get(c.id)).toEqual({ column: 0, columns: 1 })
    expect(plan.unplanned).toEqual([u])
    expect(plan.plannedMinutes).toBe(150)
  })
})

describe('clampBlock', () => {
  it('keeps blocks inside the visible day', () => {
    expect(clampBlock({ start: at(23, 30), duration: 60 })).toEqual({ start: DAY_END - 60, duration: 60 })
    expect(clampBlock({ start: at(2), duration: 5 })).toEqual({ start: DAY_START, duration: 15 })
  })
})
