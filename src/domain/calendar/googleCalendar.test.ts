import { describe, expect, it } from 'vitest'
import { googleOn } from './GoogleCalendar'
import type { GoogleEvent } from './GoogleCalendar'

const ev = (over: Partial<GoogleEvent>): GoogleEvent => ({ id: 'x', sourceId: 's', title: 'Event', location: '', allDay: false, date: '2026-11-05', endDate: '2026-11-05', startMinute: 600, endMinute: 660, link: '', meet: '', attendees: 0, workspace: 'sb', color: '#4285F4', calendar: 'Work', account: 'a@x.org', ...over })

describe('what a day shows from Google', () => {
  it('lists all-day events first, then the rest in time order', () => {
    const day = googleOn([ev({ id: 'late', title: 'Late', startMinute: 900 }), ev({ id: 'holiday', title: 'Holiday', allDay: true, startMinute: undefined, endMinute: undefined }), ev({ id: 'early', title: 'Early', startMinute: 540 })], '2026-11-05')
    expect(day.map((e) => e.id)).toEqual(['holiday', 'early', 'late'])
  })

  it('shows an event that runs over several days on each of them, and not outside them', () => {
    const trip = ev({ id: 'trip', allDay: true, date: '2026-11-04', endDate: '2026-11-06', startMinute: undefined, endMinute: undefined })
    expect(['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'].map((d) => googleOn([trip], d).length)).toEqual([0, 1, 1, 1, 0])
  })
})
