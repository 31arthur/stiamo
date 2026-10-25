import { DAY_START } from '@/domain/planner/dayPlan'

export const HOUR_HEIGHT = 72
export const PX_PER_MINUTE = HOUR_HEIGHT / 60

export const minuteToY = (minute: number) => (minute - DAY_START) * PX_PER_MINUTE
export const yToMinute = (y: number) => y / PX_PER_MINUTE + DAY_START

export const dragId = (itemId: string) => `item:${itemId}`
export const TIMELINE_DROP_ID = 'timeline'
export const TRAY_DROP_ID = 'tray'
