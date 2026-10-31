import { differenceInCalendarDays, format, formatDistanceToNowStrict, parseISO } from 'date-fns'
import { driveFileId } from '@/domain/drive/Drive'

export const driveDate = (iso?: string) => (iso ? format(parseISO(iso), 'd MMM yyyy') : '')

/** The Drive file ids among a record's attachments. */
export const attachedDriveIds = (links: (string | undefined)[]) => new Set(links.map(driveFileId).filter((id): id is string => !!id))

/** "3 days ago" for recent files, the date for older ones. */
export function driveAgo(iso: string | undefined, now = new Date()): string {
  if (!iso) return ''
  const d = parseISO(iso)
  return differenceInCalendarDays(now, d) < 14 ? `${formatDistanceToNowStrict(d, { addSuffix: true })}` : driveDate(iso)
}

/** The heading a file's date sits under in a newest-first list. */
export function dateBucket(iso: string | undefined, now = new Date()): string {
  if (!iso) return 'Undated'
  const d = parseISO(iso)
  const days = differenceInCalendarDays(now, d)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return 'This week'
  if (days < 30) return 'This month'
  return format(d, 'MMMM yyyy')
}
