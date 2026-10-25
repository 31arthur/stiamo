import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { WORKSPACE_IDS } from '@/domain/shared/workspace'
import type { WorkspaceId } from '@/domain/shared/workspace'

export type WorkspaceScope = WorkspaceId | 'all'

interface WorkspaceFilter {
  scope: WorkspaceScope
  setScope: (scope: WorkspaceScope) => void
  /** True when an item in workspace `ws` should be shown. */
  matches: (ws: WorkspaceId | undefined) => boolean
}

const KEY = 'stiamo.workspace-scope'
const Ctx = createContext<WorkspaceFilter | null>(null)

function readScope(): WorkspaceScope {
  try {
    const v = localStorage.getItem(KEY)
    return v && (WORKSPACE_IDS as string[]).includes(v) ? (v as WorkspaceId) : 'all'
  } catch {
    return 'all'
  }
}

/** The global "which part of my life am I looking at" lens applied to every list. */
export function WorkspaceFilterProvider({ children }: { children: ReactNode }) {
  const [scope, setScopeState] = useState<WorkspaceScope>(readScope)

  const setScope = useCallback((next: WorkspaceScope) => {
    setScopeState(next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // Preference only.
    }
  }, [])

  const value = useMemo<WorkspaceFilter>(
    () => ({ scope, setScope, matches: (ws) => scope === 'all' || ws === undefined || ws === scope }),
    [scope, setScope],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useWorkspaceFilter(): WorkspaceFilter {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useWorkspaceFilter must be used within WorkspaceFilterProvider')
  return ctx
}
