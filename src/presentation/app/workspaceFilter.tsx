import { createContext, useCallback, useContext, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useNavigate } from '@/presentation/routing'
import { switchWorkspace } from '@/domain/shared/routes'
import { isScope } from '@/domain/shared/workspace'
import type { WorkspaceId, WorkspaceScope } from '@/domain/shared/workspace'

export type { WorkspaceScope }

interface WorkspaceFilter {
  scope: WorkspaceScope
  /** Goes to the same place in another workspace (or its landing page when that section isn't there). */
  setScope: (scope: WorkspaceScope) => void
  /** True when an item in workspace `ws` should be shown. */
  matches: (ws: WorkspaceId | undefined) => boolean
}

const KEY = 'stiamo.workspace-scope'
const Ctx = createContext<WorkspaceFilter | null>(null)

/** The workspace last used, for addresses that don't say (the root, old bookmarks). */
export function lastScope(): WorkspaceScope {
  try {
    const v = localStorage.getItem(KEY) ?? undefined
    return isScope(v) ? v : 'all'
  } catch {
    return 'all'
  }
}

/** The "which part of my life am I looking at" lens applied to every list. It is the first part of the address. */
export function WorkspaceFilterProvider({ children }: { children: ReactNode }) {
  const { ws } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const scope: WorkspaceScope = isScope(ws) ? ws : 'all'

  useEffect(() => {
    try {
      localStorage.setItem(KEY, scope)
    } catch {
      // Remembering it is a convenience.
    }
  }, [scope])

  const setScope = useCallback((next: WorkspaceScope) => navigate(switchWorkspace(location.pathname, next)), [navigate, location.pathname])
  const value = useMemo<WorkspaceFilter>(() => ({ scope, setScope, matches: (w) => scope === 'all' || w === undefined || w === scope }), [scope, setScope])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useWorkspaceFilter(): WorkspaceFilter {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useWorkspaceFilter must be used within WorkspaceFilterProvider')
  return ctx
}

/** The workspace in the address; "all" anywhere outside the signed-in app. */
export const useScope = (): WorkspaceScope => useContext(Ctx)?.scope ?? 'all'
