import { useSyncExternalStore } from 'react'
import { toISODate } from '@/domain/shared/time'
import type { ISODate } from '@/domain/shared/types'

/**
 * The calendar day, kept in step with the machine's clock. A tab left open overnight (or a laptop
 * that slept) rolls over at midnight and when it's brought back to the front, so "today" is never
 * yesterday.
 */
const listeners = new Set<() => void>()
let midnightTimer: ReturnType<typeof setTimeout> | undefined

function notify() {
  listeners.forEach((l) => l())
}

function scheduleMidnight() {
  clearTimeout(midnightTimer)
  const now = new Date()
  const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1)
  midnightTimer = setTimeout(() => {
    notify()
    scheduleMidnight()
  }, nextDay.getTime() - now.getTime())
}

function onWake() {
  if (document.visibilityState === 'hidden') return
  notify()
  scheduleMidnight()
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    scheduleMidnight()
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', onWake)
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      clearTimeout(midnightTimer)
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', onWake)
    }
  }
}

const snapshot = (): ISODate => toISODate(new Date())

/** Today's date, re-rendering the caller when the day changes. */
export const useToday = (): ISODate => useSyncExternalStore(subscribe, snapshot)
