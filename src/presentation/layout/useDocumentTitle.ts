import { useEffect } from 'react'

const APP = 'Stiamo'

/** Sets the browser tab title, e.g. "Mehta Textiles v. Coastal Freight · Stiamo". */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (title !== undefined) document.title = title ? `${title} · ${APP}` : APP
  }, [title])
}

export const SECTION_TITLES: Record<string, string> = {
  today: 'Today',
  calendar: 'Calendar',
  tasks: 'Tasks',
  'follow-ups': 'Follow-ups',
  meetings: 'Meetings & appointments',
  cases: 'Cases',
  letters: 'Letters',
  diary: 'Case diary',
  counsel: 'Counsel',
  clients: 'Clients',
  projects: 'Projects',
  plans: 'Action plans',
  goals: 'Goals',
}
