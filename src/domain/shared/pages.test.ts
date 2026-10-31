import { describe, expect, it } from 'vitest'
import { firstEnabled, pageEnabled, workspacesWith } from './pages'

describe('workspace pages', () => {
  const hidden = { fsa: ['mail' as const], media: ['mail' as const, 'today' as const], personal: ['mail' as const] }

  it('is on until switched off, per workspace', () => {
    expect(pageEnabled(hidden, 'sb', 'mail')).toBe(true)
    expect(pageEnabled(hidden, 'fsa', 'mail')).toBe(false)
    expect(pageEnabled(hidden, 'fsa', 'today')).toBe(true)
    expect(pageEnabled(hidden, 'media', 'today')).toBe(false)
  })

  it('leaves pages that cannot be switched off alone', () => {
    expect(pageEnabled(hidden, 'media', 'cases')).toBe(true)
  })

  it('shows a page under "all" when any workspace has it', () => {
    expect(pageEnabled(hidden, 'all', 'mail')).toBe(true)
    expect(pageEnabled({ sb: ['mail'], fsa: ['mail'], media: ['mail'], personal: ['mail'] }, 'all', 'mail')).toBe(false)
  })

  it('names the workspaces that have a page', () => {
    expect(workspacesWith(hidden, 'mail')).toEqual(['sb'])
  })

  it('sends a hidden page to the first one that is on', () => {
    expect(firstEnabled(hidden, 'media')).toBe('calendar')
  })
})
