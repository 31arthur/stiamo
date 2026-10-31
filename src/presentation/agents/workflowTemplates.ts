import type { WorkflowConfig } from '@/domain/ai/AgentApi'

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
    id: 'blank',
    name: 'Start from nothing',
    description: 'Choose the source, write the prompt, define the labels.',
    pitch: 'An empty setup.',
    config: { ...base, source: { kind: 'manual', table: null }, prompt: '', labels: [{ name: '', description: '' }, { name: '', description: '' }] },
  },
]

export const TABLE_LABELS: Record<string, string> = { cases: 'Cases', tasks: 'Tasks', 'follow-ups': 'Follow-ups', meetings: 'Meetings', clients: 'Clients', projects: 'Projects' }
