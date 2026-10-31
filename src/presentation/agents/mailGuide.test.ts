import { describe, expect, it } from 'vitest'
import type { WorkflowConfig } from '@/domain/ai/AgentApi'
import { PRESETS, composeGuide, isGuide, withPreset } from './mailGuide'

const base: WorkflowConfig = { source: { kind: 'mail', accountIds: [] }, filters: { newOnly: true, limit: 100 }, prompt: '', labels: [], decider: 'jev', defaultThreshold: 0.85 }

describe('the mailbox prompt guide', () => {
  it('turns the sections into instructions and two labels, saying nothing twice', () => {
    const { prompt, labels } = composeGuide(PRESETS.sb.guide)
    expect(prompt).toBe('You classify emails in the inbox of a civil society organisation that works for migrant workers’ rights. For each email decide "keep" or "spam".\n\nWhen unsure, choose keep.')
    expect(labels.map((l) => l.name)).toEqual(['keep', 'spam'])
    expect(labels[0].description).toContain('genuine, relevant correspondence about migrant workers')
    expect(labels[0].description).toContain('Also keep: anything from trade unions')
    expect(labels[1].description).toMatch(/^marketing, promotions, cold sales outreach/)
    expect(prompt).not.toContain('marketing')
  })

  it('keeps a threshold set on a label and copes with empty sections', () => {
    const { labels, prompt } = composeGuide({ about: '', keep: '', alsoKeep: '', spam: '', unsure: '' }, [{ name: 'spam', description: '', threshold: 0.95 }])
    expect(labels[1].threshold).toBe(0.95)
    expect(labels[0].description).toBe('Mail worth keeping.')
    expect(prompt).toBe('You classify emails in the inbox of an organisation. For each email decide "keep" or "spam".')
  })

  it('starts a workspace from its example, with the senders it always keeps', () => {
    const cfg = withPreset(base, 'sb')
    expect(isGuide(cfg.guide)).toBe(true)
    expect(cfg.rules?.protectedDomains).toEqual(['mfasia.org', 'bwint.org'])
    expect(cfg.rules?.protectedPhrases).toContain('building and wood workers')
    expect(cfg.prompt).toContain('migrant workers')
    const fsa = withPreset(base, 'fsa')
    expect(fsa.labels[1].description).toContain('everything that is not a business opportunity')
    expect(fsa.rules?.protectedDomains).toEqual([])
  })

  it('knows a guide when it sees one', () => {
    expect(isGuide({ about: 'a', keep: 'b', alsoKeep: 'c', spam: 'd', unsure: 'e' })).toBe(true)
    expect(isGuide({ about: 'a' })).toBe(false)
    expect(isGuide(undefined)).toBe(false)
  })
})
