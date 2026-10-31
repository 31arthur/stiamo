import { format, isThisYear, isToday, isYesterday, parseISO } from 'date-fns'
import type { MailPerson } from '@/domain/mail/Mail'

/** The time for today's mail, "Yesterday", then the day, then the year once it is older than this one. */
export function listDate(iso: string | null): string {
  if (!iso) return ''
  const d = parseISO(iso)
  if (isToday(d)) return format(d, 'p')
  if (isYesterday(d)) return 'Yesterday'
  return isThisYear(d) ? format(d, 'd MMM') : format(d, 'd MMM yyyy')
}

export const fullDate = (iso: string | null) => (iso ? format(parseISO(iso), 'EEE d MMM yyyy, p') : '')

/** Who it is from, the way a person would say it. */
export const who = (p: MailPerson) => p.name || p.address || 'Unknown sender'

export function initials(p: MailPerson): string {
  const words = who(p)
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
  return ((words[0]?.[0] ?? '?') + (words.length > 1 ? (words[words.length - 1][0] ?? '') : '')).toUpperCase()
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
