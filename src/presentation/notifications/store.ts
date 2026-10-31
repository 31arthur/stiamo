import { useSyncExternalStore } from 'react'

export type NoticeLevel = 'success' | 'error' | 'warning' | 'info'

export interface Notice {
  id: string
  level: NoticeLevel
  title: string
  detail?: string
  /** Epoch milliseconds. */
  at: number
  read: boolean
}

const KEY = 'stiamo.notices.v1'
const MAX = 100

function load(): Notice[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    return Array.isArray(raw) ? (raw as Notice[]).filter((n) => n && typeof n.id === 'string' && typeof n.title === 'string').slice(0, MAX) : []
  } catch {
    return []
  }
}

let notices: Notice[] = load()
const listeners = new Set<() => void>()

function commit(next: Notice[]) {
  notices = next.slice(0, MAX)
  try {
    localStorage.setItem(KEY, JSON.stringify(notices))
  } catch {
    // Keeping the list across visits is a convenience.
  }
  listeners.forEach((l) => l())
}

/** Records something worth being able to find again: it stays in the drawer after its toast is gone. */
export function record(level: NoticeLevel, title: string, detail?: string) {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now() + Math.random())
  commit([{ id, level, title, detail, at: Date.now(), read: false }, ...notices])
}

export const markAllRead = () => notices.some((n) => !n.read) && commit(notices.map((n) => (n.read ? n : { ...n, read: true })))
export const clearNotices = () => commit([])
export const removeNotice = (id: string) => commit(notices.filter((n) => n.id !== id))

const subscribe = (l: () => void) => {
  listeners.add(l)
  // Another tab changed the list.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      notices = load()
      l()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(l)
    window.removeEventListener('storage', onStorage)
  }
}

export const useNotices = () => useSyncExternalStore(subscribe, () => notices)

/** Problems nobody has looked at yet: what the bell counts. Successes don't nag. */
export const unreadProblems = (list: Notice[]) => list.filter((n) => !n.read && (n.level === 'error' || n.level === 'warning')).length
