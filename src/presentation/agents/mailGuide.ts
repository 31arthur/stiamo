import type { WorkflowConfig, WorkflowLabel } from '@/domain/ai/AgentApi'
import type { WorkspaceId } from '@/domain/shared/workspace'

/**
 * The prompt of a mailbox filter, written as five plain sections. The person fills them in; `composeGuide` turns them into the
 * instructions and the two labels the decision model reads. The sections are kept with the agent so they can be edited again.
 */
export interface MailGuide {
  /** Who the inbox belongs to: "a civil society organisation that works for…". */
  about: string
  /** The mail worth keeping. */
  keep: string
  /** Senders or kinds of mail that are always fine. */
  alsoKeep: string
  /** What to clear out. */
  spam: string
  /** What to do on a close call. */
  unsure: string
}

export const GUIDE_FIELDS: { key: keyof MailGuide; label: string; hint: string; rows: number; placeholder: string }[] = [
  { key: 'about', label: 'Who the inbox belongs to', hint: 'One line: the organisation or person, and what they do.', rows: 2, placeholder: 'a civil society organisation that works for migrant workers’ rights' },
  { key: 'keep', label: 'Keep', hint: 'The mail worth keeping. The more concrete, the better the judgement.', rows: 3, placeholder: 'genuine, relevant correspondence about…' },
  { key: 'alsoKeep', label: 'Also keep', hint: 'Senders or kinds of mail that are always fine.', rows: 2, placeholder: 'anything from trade unions, labour bodies and international NGOs' },
  { key: 'spam', label: 'Spam', hint: 'What to clear out.', rows: 3, placeholder: 'marketing, promotions, cold sales outreach, newsletters, automated notifications…' },
  { key: 'unsure', label: 'When unsure', hint: 'What to do on a close call. Keeping is the safe choice.', rows: 1, placeholder: 'When unsure, choose keep.' },
]

export interface GuidePreset {
  guide: MailGuide
  /** Domains that are always kept. */
  domains: string[]
  /** Words and phrases that always keep an email. */
  phrases: string[]
}

/** A neutral starting point, before a mailbox says which workspace this is for. */
export const DEFAULT_GUIDE: MailGuide = {
  about: 'my organisation',
  keep: 'genuine correspondence relevant to our work: clients, partners, funders, colleagues, and one-to-one mail from real people.',
  alsoKeep: 'bills, contracts, official notices, and replies to mail we sent.',
  spam: 'marketing, promotions, cold sales outreach, newsletters, digests, automated notifications, social media alerts, and unrelated solicitations.',
  unsure: 'When unsure, choose keep.',
}

/** What to start from for each workspace's inbox. Everything is meant to be rewritten. */
export const PRESETS: Record<WorkspaceId, GuidePreset> = {
  sb: {
    guide: {
      about: 'a civil society organisation that works for migrant workers’ rights',
      keep: 'genuine, relevant correspondence about migrant workers, labour rights, partner organisations, funders, campaigns, events the organisation takes part in, or personal one-to-one correspondence.',
      alsoKeep: 'anything from trade unions, global union federations (for example BWI, Building and Wood Workers’ International), labour and human rights bodies, and international NGOs.',
      spam: 'marketing, promotions, cold sales outreach, newsletters, digests, automated notifications, social media alerts, and unrelated solicitations.',
      unsure: 'When unsure, choose keep.',
    },
    domains: ['mfasia.org', 'bwint.org'],
    phrases: ['migrant forum in asia', 'mfasia', 'mfa', 'building and wood workers', 'bwint', 'bwi'],
  },
  fsa: {
    guide: {
      about: 'a software and technology company that builds products for clients',
      keep: 'genuine business opportunities: enquiries from prospective clients, requests for a quote or a proposal, tenders, partnership and collaboration offers, and one-to-one mail from real people about work.',
      alsoKeep: 'anything from existing clients, vendors and partners we work with, and invoices, payments and contracts.',
      spam: 'everything that is not a business opportunity: marketing, promotions, cold sales outreach, SEO and web-design offers, job-seeker mail, newsletters, digests, automated notifications, and social media alerts.',
      unsure: 'When unsure, choose keep.',
    },
    domains: [],
    phrases: [],
  },
  media: {
    guide: {
      about: 'a media and communications desk that handles press and public statements',
      keep: 'press enquiries, interview and story requests, tips and sources, invitations to events and briefings that matter to our coverage, and one-to-one replies from contacts.',
      alsoKeep: 'anything from journalists, editors, press bodies, and partner outlets.',
      spam: 'unrelated PR blasts, marketing, promotions, newsletters, digests, automated notifications, and social media alerts.',
      unsure: 'When unsure, choose keep.',
    },
    domains: [],
    phrases: [],
  },
  personal: {
    guide: {
      about: 'my personal inbox',
      keep: 'messages from real people I know, bills, bank and government notices, and travel, delivery or appointment mail I may be waiting for.',
      alsoKeep: 'anything about my health, money, home or documents.',
      spam: 'promotions, deals, marketing, newsletters, social media alerts, and cold outreach from strangers.',
      unsure: 'When unsure, choose keep.',
    },
    domains: [],
    phrases: [],
  },
}

export const isGuide = (g: unknown): g is MailGuide => !!g && typeof g === 'object' && (['about', 'keep', 'alsoKeep', 'spam', 'unsure'] as const).every((k) => typeof (g as Record<string, unknown>)[k] === 'string')

/** Ends a piece of text with a full stop, so sections join into sentences. */
const sentence = (t: string) => {
  const s = t.trim()
  return s && !/[.!?]$/.test(s) ? `${s}.` : s
}

/**
 * The instructions and the two labels the model reads. The definitions live in the labels (the decision model is given them with
 * every question), so the instructions only say who the inbox is for and what to do when unsure: nothing is said twice.
 */
export function composeGuide(g: MailGuide, labels: WorkflowLabel[] = []): { prompt: string; labels: WorkflowLabel[] } {
  const about = g.about.trim().replace(/[.!?]$/, '') || 'an organisation'
  const prompt = `You classify emails in the inbox of ${about}. For each email decide "keep" or "spam".${g.unsure.trim() ? `\n\n${sentence(g.unsure)}` : ''}`
  const keep = [sentence(g.keep), g.alsoKeep.trim() ? `Also keep: ${sentence(g.alsoKeep)}` : ''].filter(Boolean).join(' ')
  const thresholds = Object.fromEntries(labels.map((l) => [l.name, l.threshold]))
  return {
    prompt,
    labels: [
      { name: 'keep', description: keep.slice(0, 1200) || 'Mail worth keeping.', ...(thresholds.keep != null && { threshold: thresholds.keep }) },
      { name: 'spam', description: sentence(g.spam).slice(0, 1200) || 'Mail to clear out.', ...(thresholds.spam != null && { threshold: thresholds.spam }) },
    ],
  }
}

/** The setup with a guide written into it: the sections, and the prompt and labels made from them. */
export function withGuide(cfg: WorkflowConfig, guide: MailGuide): WorkflowConfig {
  return { ...cfg, guide: { ...guide }, ...composeGuide(guide, cfg.labels) }
}

/** The setup started from a workspace's example, including the senders it always keeps. */
export function withPreset(cfg: WorkflowConfig, ws: WorkspaceId): WorkflowConfig {
  const p = PRESETS[ws]
  const rules = cfg.rules ?? { protectedDomains: [], protectedPhrases: [], protectCorrespondents: true }
  return { ...withGuide(cfg, p.guide), rules: { ...rules, protectedDomains: p.domains, protectedPhrases: p.phrases } }
}
