import type { CalendarItemType } from '@/domain/calendar/entities/CalendarItem'

interface ItemTypeStyle {
  label: string
  /** Soft chip background + text */
  chip: string
  /** Solid accent (dots, bars) */
  accent: string
  ring: string
}

export const ITEM_TYPE_STYLES: Record<CalendarItemType, ItemTypeStyle> = {
  task: { label: 'Task', chip: 'bg-task-soft text-task', accent: 'bg-task', ring: 'ring-task/40' },
  follow_up: { label: 'Follow-up', chip: 'bg-follow-up-soft text-follow-up', accent: 'bg-follow-up', ring: 'ring-follow-up/40' },
  meeting: { label: 'Meeting', chip: 'bg-meeting-soft text-meeting', accent: 'bg-meeting', ring: 'ring-meeting/40' },
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return [h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ') || '0m'
}
