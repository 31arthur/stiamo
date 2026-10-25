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
}
