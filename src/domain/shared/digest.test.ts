import { describe, expect, it } from 'vitest'
import { buildDigests } from './digest'
import type { DigestInput } from './digest'

const open = { status: 'open' } as const
const empty: DigestInput = { tasks: [], followUps: [], meetings: [], cases: [], hearings: [], clients: [], projects: [], goals: [] }
const base = { id: 'x', userId: 'u', createdAt: '', updatedAt: '' }

describe('the digest of each workspace', () => {
  it('has one entry per workspace, quiet when there is nothing', () => {
    const d = buildDigests(empty, '2026-10-31')
    expect(d.map((w) => w.id)).toEqual(['personal', 'sb', 'fsa', 'media'])
    expect(d.every((w) => w.stats.every((s) => s.value === 0))).toBe(true)
  })

  it('counts each workspace’s own work and flags what is slipping', () => {
    const input: DigestInput = {
      ...empty,
      tasks: [
        { ...base, workspace: 'fsa', outcome: open, dueDate: '2026-10-01' },
        { ...base, workspace: 'fsa', outcome: open },
        { ...base, workspace: 'media', outcome: open },
      ] as never,
      cases: [{ ...base, id: 'c1', title: 'Alur case', status: 'active' }] as never,
      hearings: [
        { ...base, id: 'h1', caseId: 'c1', date: '2026-10-20', purpose: 'Arguments', outcome: open },
        { ...base, id: 'h2', caseId: 'c1', date: '2026-11-03', purpose: 'Orders', outcome: open },
      ] as never,
    }
    const d = Object.fromEntries(buildDigests(input, '2026-10-31').map((w) => [w.id, w]))
    expect(d.fsa.stats.find((s) => s.label === 'Open tasks')?.value).toBe(2)
    expect(d.media.stats.find((s) => s.label === 'Open tasks')?.value).toBe(1)
    expect(d.sb.stats.find((s) => s.label === 'Hearings to write up')).toMatchObject({ value: 1, tone: 'danger' })
    expect(d.sb.stats.find((s) => s.label === 'Hearings in 7 days')?.value).toBe(1)
    expect(d.sb.next).toMatchObject({ label: 'Alur case', to: '/cases/c1' })
  })
})
