import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { isPage, pageEnabled } from '@/domain/shared/pages'
import type { HiddenPages, PageId } from '@/domain/shared/pages'
import { WORKSPACE_IDS } from '@/domain/shared/workspace'
import type { WorkspaceId, WorkspaceScope } from '@/domain/shared/workspace'

const KEY = 'stiamo.workspace-pages'

interface Pages {
  hidden: HiddenPages
  /** Whether a section (any address segment) is on in this workspace. Sections that can't be switched off always are. */
  enabled: (scope: WorkspaceScope, section: string) => boolean
  set: (ws: WorkspaceId, page: PageId, on: boolean) => void
}

const Ctx = createContext<Pages | null>(null)

function load(): HiddenPages {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>
    const out: HiddenPages = {}
    for (const ws of WORKSPACE_IDS) {
      const list = raw[ws]
      if (Array.isArray(list)) out[ws] = list.filter((p): p is PageId => typeof p === 'string' && isPage(p))
    }
    return out
  } catch {
    return {}
  }
}

/** Which of the common pages each workspace shows. Kept on this device; nothing else depends on it. */
export function PagesProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState<HiddenPages>(load)

  const set = useCallback((ws: WorkspaceId, page: PageId, on: boolean) => {
    setHidden((prev) => {
      const without = (prev[ws] ?? []).filter((p) => p !== page)
      const next = { ...prev, [ws]: on ? without : [...without, page] }
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        // Remembering it is a convenience.
      }
      return next
    })
  }, [])

  const value = useMemo<Pages>(() => ({ hidden, enabled: (scope, section) => pageEnabled(hidden, scope, section), set }), [hidden, set])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function usePages(): Pages {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePages must be used within a PagesProvider')
  return ctx
}
