import type { WorkflowConfig } from '@/domain/ai/AgentApi'
import { DEFAULT_GUIDE, withGuide } from './mailGuide'
import { SB_FEEDS, SB_IRRELEVANT, SB_LEVELS, SB_RELEVANT } from './newsFeeds'

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  /** What it is for, in a line, for the picker. */
  pitch: string
  config: WorkflowConfig
}

const base = { filters: { sinceDays: 30, newOnly: true, contains: null, limit: 50 }, decider: 'model' as const, defaultThreshold: 0.7 }

/** Starting points. A person changes everything in them; they only save writing a first prompt and labels. */
export const TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'tasks',
    name: 'Task triage',
    description: 'Sorts the tasks you have by how urgent they are.',
    pitch: 'Reads your tasks and says which need doing now.',
    config: {
      ...base,
      source: { kind: 'table', table: 'tasks' },
      prompt: 'You triage my tasks. Decide how urgent each one is from its title, its dates and its status. A task with a date that has passed or is days away is urgent.',
      labels: [
        { name: 'urgent', description: 'Overdue, due within days, or blocking other work.' },
        { name: 'routine', description: 'Needs doing, but can wait a week or more.' },
        { name: 'someday', description: 'Nice to do, with no date and no consequence if it slips.' },
      ],
    },
  },
  {
    id: 'cases',
    name: 'Case attention',
    description: 'Flags cases that need attention soon.',
    pitch: 'Reads your cases and says which need a look.',
    config: {
      ...base,
      filters: { sinceDays: 90, newOnly: false, contains: null, limit: 50 },
      source: { kind: 'table', table: 'cases' },
      prompt: 'You review my legal cases. Decide how much attention each needs now, from its status, stage, summary and dates.',
      labels: [
        { name: 'needs_attention', description: 'A step is overdue or due soon, or the summary says something is stuck.' },
        { name: 'on_track', description: 'Moving as planned, with a next step in view.' },
        { name: 'dormant', description: 'Nothing has happened for a long time.' },
      ],
    },
  },
  {
    id: 'messages',
    name: 'Message sorter',
    description: 'Sorts messages you paste in: spam, promotions, things to answer.',
    pitch: 'The idea behind an email filter, on text you paste. Email itself arrives later.',
    config: {
      ...base,
      source: { kind: 'manual', table: null },
      prompt: 'You sort my incoming messages. Decide what kind each is, from the sender, the subject and the text.',
      labels: [
        { name: 'spam', description: 'Unsolicited, deceptive, or trying to get money or details.' },
        { name: 'promotion', description: 'A genuine company advertising or offering something.' },
        { name: 'needs_reply', description: 'A real person asks me something and expects an answer.' },
        { name: 'important', description: 'Bills, deadlines, court or client matters I must not miss.' },
      ],
    },
  },
  {
    id: 'spam-filter',
    name: 'Spam filter',
    description: 'Keeps the mail that matters to a workspace and moves the rest to Trash.',
    pitch: 'Reads a mailbox, protects people you know, and clears what is irrelevant.',
    config: withGuide({
      ...base,
      prompt: '',
      labels: [],
      filters: { sinceDays: null, newOnly: true, contains: null, limit: 100 },
      source: { kind: 'mail', accountIds: [], folder: 'INBOX' },
      batchSize: 20,
      decisionModel: null,
      decider: 'jev',
      defaultThreshold: 0.85,
      rules: { protectedDomains: [], protectedPhrases: [], protectCorrespondents: true },
      action: { trashLabel: 'spam', auto: false },
    }, DEFAULT_GUIDE),
  },
  {
    id: 'triage',
    name: 'Mail triage',
    description: 'Reads the mail a filter kept and queues what needs you, with calendar events to approve.',
    pitch: 'Issues and important mail go to Attention; meetings and events can be added to your calendar.',
    config: {
      ...base,
      filters: { sinceDays: null, newOnly: true, contains: null, limit: 50 },
      source: { kind: 'agent', upstreamId: null, runUpstream: true },
      defaultThreshold: 0.6,
      prompt:
        'You read the email of S&B Consultants, a legal and advocacy practice, after a spam filter has already kept it. For each email decide what it is and whether the owner needs to act on it. When unsure whether something matters, choose the label that puts it in front of the owner.',
      labels: [
        { name: 'meeting', description: 'An invitation or request for a meeting, call, hearing, conference, webinar, workshop or other event, especially one with a date and time.', route: 'event' },
        { name: 'issue', description: 'A problem, complaint, dispute, legal matter or urgent request that needs action or a reply, including anything about a client or case in trouble.', route: 'attention' },
        { name: 'important', description: 'An important message that should not be missed: funders, partners, government or court notices, deadlines, calls to apply or contribute.', route: 'attention' },
        { name: 'fyi', description: 'Informational or routine mail that needs nothing from the owner.', route: 'none' },
      ],
    },
  },
  {
    id: 'urgent-mail',
    name: 'Urgent mail watch',
    description: 'Watches a mailbox live and pings your Telegram the moment something needs you at once, with a link to the email and replies ready to send.',
    pitch: 'A loud Telegram alert, a link, and suggested replies in the organisation’s theme.',
    config: {
      ...base,
      // Only the last day, so switching it on does not ping about old mail.
      filters: { sinceDays: 1, newOnly: true, contains: null, limit: 50 },
      source: { kind: 'mail', accountIds: [], folder: 'INBOX' },
      listen: true,
      defaultThreshold: 0.6,
      rules: { protectedDomains: [], protectedPhrases: [], protectCorrespondents: false },
      action: { trashLabel: null, auto: false },
      prompt:
        'You watch the inbox of S&B Consultants, a legal and advocacy practice, for mail that cannot wait. Something is urgent when someone needs the owner to share, send, register, confirm, pay, attend or answer by a deadline that is close, or when a client, court, government office or funder is waiting. When unsure whether it is urgent, choose the label that tells the owner.',
      labels: [
        { name: 'urgent', description: 'Asks the owner to share, send, register, confirm, pay, attend or reply by a close deadline, or a client, court, government office or funder is waiting on them.', route: 'alert' },
        { name: 'important', description: 'Matters, but can wait a day or more: updates on cases, notices, invitations with time to spare.', route: 'attention' },
        { name: 'routine', description: 'Newsletters, receipts, promotions, notifications and anything that needs nothing from the owner.', route: 'none' },
      ],
    },
  },
  {
    id: 'news',
    name: 'News monitor',
    description: 'Reads news feeds every half hour, keeps what matters to your work, and ranks the top stories.',
    pitch: 'Filters out the irrelevant, grades the rest, and shows the top twenty on the News page.',
    config: {
      ...base,
      filters: { sinceDays: 3, newOnly: true, contains: null, limit: 100 },
      source: { kind: 'feed', feeds: SB_FEEDS },
      decider: 'jev',
      batchSize: 20,
      defaultThreshold: 0.6,
      scheduleMinutes: 30,
      prompt: 'You choose news for S&B Consultants, a legal and advocacy practice that works with Indian migrant workers: their deaths, difficulties, and being stranded abroad. Say whether each story is relevant to that work. When unsure, a story about the welfare of Indian workers is relevant.',
      labels: [
        { name: 'relevant', description: SB_RELEVANT, route: 'publish' },
        { name: 'irrelevant', description: SB_IRRELEVANT, route: 'none' },
      ],
      importance: { prompt: 'You grade news for S&B Consultants, which works with Indian migrant workers. Say how much each story matters to that work: how serious it is, how many workers it affects, and whether something must be done about it.', levels: SB_LEVELS },
    },
  },
  {
    id: 'blank',
    name: 'Start from nothing',
    description: 'Choose the source, write the prompt, define the labels.',
    pitch: 'An empty setup.',
    config: { ...base, source: { kind: 'manual', table: null }, prompt: '', labels: [{ name: '', description: '' }, { name: '', description: '' }] },
  },
]

export const TABLE_LABELS: Record<string, string> = { cases: 'Cases', tasks: 'Tasks', 'follow-ups': 'Follow-ups', meetings: 'Meetings', clients: 'Clients', projects: 'Projects' }
