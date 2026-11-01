import { AlertTriangle, CalendarDays, Mail, Star } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { AttentionItem } from '@/domain/ai/AgentApi'

/**
 * What kind of card something is. The queue draws every card the same way (a picture of what it is, how urgent, what it says, what you
 * can do), and this is the one place that says what a kind looks like. A new kind of task is a new entry here, not a new screen.
 */
export type CardKind = 'event' | 'issue' | 'important' | 'mail'

export interface CardKindMeta {
  label: string
  /** The plural, for the filter. */
  plural: string
  icon: LucideIcon
  /** Colours of its icon tile. */
  tone: string
}

export const CARD_KINDS: Record<CardKind, CardKindMeta> = {
  event: { label: 'Event', plural: 'Events', icon: CalendarDays, tone: 'bg-primary/10 text-primary' },
  issue: { label: 'Issue', plural: 'Issues', icon: AlertTriangle, tone: 'bg-destructive/10 text-destructive' },
  important: { label: 'Important', plural: 'Important', icon: Star, tone: 'bg-warning/15 text-warning' },
  mail: { label: 'Mail', plural: 'Other mail', icon: Mail, tone: 'bg-muted text-muted-foreground' },
}

export const KIND_ORDER: CardKind[] = ['event', 'issue', 'important', 'mail']

/** From what the agent decided: a proposed event is an event; otherwise the label says. */
export function cardKind(i: Pick<AttentionItem, 'status' | 'event' | 'label'>): CardKind {
  if (i.status === 'event_proposed' || i.event) return 'event'
  const label = (i.label ?? '').toLowerCase()
  if (/meeting|event|invite|conference|webinar/.test(label)) return 'event'
  if (/issue|problem|urgent|complaint|dispute/.test(label)) return 'issue'
  if (/important|priority|action|deadline/.test(label)) return 'important'
  return 'mail'
}

export const cardKey = (i: Pick<AttentionItem, 'agentId' | 'itemId'>) => `${i.agentId}/${i.itemId}`

export type CardSort = 'urgent' | 'newest'

export const CARD_SORTS: { key: CardSort; label: string }[] = [
  { key: 'urgent', label: 'Most urgent first' },
  { key: 'newest', label: 'Newest first' },
]

const WEIGHT: Record<string, number> = { high: 0, normal: 1, low: 2 }

export function sortCards(items: AttentionItem[], by: CardSort): AttentionItem[] {
  const out = [...items]
  const newest = (a: AttentionItem, b: AttentionItem) => (b.at ?? '').localeCompare(a.at ?? '')
  if (by === 'newest') return out.sort(newest)
  // Events waiting for a yes come first (they need a decision to be of any use), then by how urgent, then by when.
  return out.sort((a, b) => Number(b.status === 'event_proposed') - Number(a.status === 'event_proposed') || (WEIGHT[a.priority] ?? 1) - (WEIGHT[b.priority] ?? 1) || newest(a, b))
}

export function countKinds(items: AttentionItem[]): Record<CardKind, number> {
  const n: Record<CardKind, number> = { event: 0, issue: 0, important: 0, mail: 0 }
  for (const i of items) n[cardKind(i)]++
  return n
}

export const filterCards = (items: AttentionItem[], kind: CardKind | 'all') => (kind === 'all' ? items : items.filter((i) => cardKind(i) === kind))

/** The card to open after dealing with this one: the next in the list, or the one before when it was last. */
export function nextCard(shown: AttentionItem[], current: AttentionItem): AttentionItem | null {
  const at = shown.findIndex((i) => cardKey(i) === cardKey(current))
  return shown[at + 1] ?? shown[at - 1] ?? null
}
