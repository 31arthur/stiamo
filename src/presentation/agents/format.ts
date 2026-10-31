import { formatDistanceToNowStrict, parseISO } from 'date-fns'

export const TRIGGER_LABELS: Record<string, string> = { chat: 'Chat', telegram: 'Telegram', whatsapp: 'WhatsApp', test: 'Test run', schedule: 'Scheduled' }

export const triggerLabel = (t: string) => TRIGGER_LABELS[t] ?? t

/** "850 ms", "1.2 s", "2 min". */
export function formatMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`
  return `${Math.round(ms / 60_000)} min`
}

/** "3 minutes ago". */
export const ago = (iso: string) => formatDistanceToNowStrict(parseISO(iso), { addSuffix: true })

/** 1 234 → "1.2k". */
export const compact = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n))

/** US dollars, with enough places that a fraction of a cent is still visible. "—" when nobody says what it cost. */
export function money(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  if (n === 0) return '$0'
  if (n < 0.01) return `$${n.toFixed(5)}`
  return n < 1 ? `$${n.toFixed(3)}` : `$${n.toFixed(2)}`
}
