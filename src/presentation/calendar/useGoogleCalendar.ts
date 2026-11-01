import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { CalendarStatus, GoogleEvent, SyncResult } from '@/domain/calendar/GoogleCalendar'
import type { ISODate } from '@/domain/shared/types'
import { useServices } from '@/presentation/app/services'
import { useUserId } from '@/presentation/data/hooks'

/** Google calendars live in the Stiamo backend. */
export function useCalendarAvailable() {
  return useServices().backend === 'api'
}

/** What is connected. A server that doesn't have the calendar service yet answers with an error, which the panel explains. */
export function useCalendarStatus() {
  const { calendar } = useServices()
  const userId = useUserId()
  const enabled = useCalendarAvailable()
  return useQuery<CalendarStatus>({ queryKey: ['calendar', userId, 'status'], queryFn: () => calendar.status(), enabled, staleTime: 30_000, retry: false })
}

/** The events of every shown calendar between two days, all workspaces together: the page filters by workspace. */
export function useGoogleEvents(from: ISODate, to: ISODate, enabled: boolean) {
  const { calendar } = useServices()
  const userId = useUserId()
  const query = useQuery({ queryKey: ['calendar', userId, 'events', from, to], queryFn: () => calendar.events(from, to), enabled, staleTime: 60_000, refetchInterval: 5 * 60_000, retry: false })
  return query.data?.items ?? EMPTY
}

const EMPTY: GoogleEvent[] = []
const STALE_MS = 3 * 60_000

const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

/** Reads the calendars now (and sends meetings and hearings to Google), then refreshes what is shown. */
export function useCalendarSync() {
  const { calendar } = useServices()
  const client = useQueryClient()
  const userId = useUserId()
  const [syncing, setSyncing] = useState(false)
  const sync = useCallback(async (): Promise<SyncResult> => {
    setSyncing(true)
    try {
      return await calendar.sync(browserZone())
    } finally {
      setSyncing(false)
      await client.invalidateQueries({ queryKey: ['calendar', userId] })
    }
  }, [calendar, client, userId])
  return { sync, syncing }
}

/** Opening the calendar brings it up to date, once, unless it was read a moment ago. */
export function useCalendarAutoSync(status: CalendarStatus | undefined) {
  const { sync } = useCalendarSync()
  const done = useRef(false)
  useEffect(() => {
    if (done.current || !status || status.accounts.length === 0) return
    done.current = true
    const newest = Math.max(0, ...status.accounts.map((a) => (a.lastSyncAt ? Date.parse(a.lastSyncAt) : 0)))
    if (Date.now() - newest > STALE_MS) void sync().catch(() => undefined)
  }, [status, sync])
}
