import { isScope } from './workspace'
import type { WorkspaceScope } from './workspace'

/**
 * Every address starts with the workspace: `/sb/cases/…`, `/fsa/projects`, `/all/overview`. A section that belongs to
 * one workspace (cases to S&B, projects to FSA) always lives under it; the shared ones (today, tasks, plans…) live under
 * whichever workspace you are in.
 */
const HOME: Record<string, WorkspaceScope> = {
  cases: 'sb',
  letters: 'sb',
  diary: 'sb',
  counsel: 'sb',
  clients: 'fsa',
  projects: 'fsa',
  overview: 'all',
  ai: 'all',
}
const SHARED = ['today', 'calendar', 'tasks', 'follow-ups', 'meetings', 'plans', 'goals']

export const SECTIONS = [...Object.keys(HOME), ...SHARED]

/** Where a workspace opens: the overview for "all", otherwise the day. */
export const landingOf = (scope: WorkspaceScope) => (scope === 'all' ? 'overview' : 'today')

const split = (pathname: string) => {
  const segs = pathname.split('/').filter(Boolean)
  const ws = isScope(segs[0]) ? segs[0] : undefined
  return { ws, rest: ws ? segs.slice(1) : segs }
}

/**
 * The address a path should really have. Fixes old addresses without a workspace (`/cases/1` → `/sb/cases/1`), a section
 * under the wrong workspace (`/fsa/cases` → `/sb/cases`) and anything unknown (→ the workspace's landing page).
 */
export function canonicalPath(pathname: string, fallback: WorkspaceScope): string {
  const { ws, rest } = split(pathname)
  const section = rest[0]
  if (!section || !SECTIONS.includes(section)) return `/${ws ?? fallback}/${landingOf(ws ?? fallback)}`
  return `/${HOME[section] ?? ws ?? fallback}/${rest.join('/')}`
}

/** The same place in another workspace, or that workspace's landing page when the section doesn't exist there. */
export function switchWorkspace(pathname: string, next: WorkspaceScope): string {
  const { rest } = split(pathname)
  const section = rest[0]
  if (!section || !SECTIONS.includes(section)) return `/${next}/${landingOf(next)}`
  const home = HOME[section]
  if (home) return home === next ? `/${next}/${rest.join('/')}` : `/${next}/${landingOf(next)}`
  // A shared section keeps its list (and the day on Today); a record that was open stays behind.
  return `/${next}/${section === 'today' ? rest.slice(0, 2).join('/') : section}`
}

/** Writes a link the way the app was first written (`/cases/1`) and gets the real address for the workspace you are in. */
export function resolveLink(to: string, scope: WorkspaceScope): string {
  if (!to.startsWith('/') || to.startsWith('//')) return to
  const cut = to.search(/[?#]/)
  const path = cut < 0 ? to : to.slice(0, cut)
  const tail = cut < 0 ? '' : to.slice(cut)
  const first = path.split('/').filter(Boolean)[0]
  return first && SECTIONS.includes(first) ? canonicalPath(path, scope) + tail : to
}
