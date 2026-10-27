import { EyeOff } from 'lucide-react'
import { WORKSPACES } from '@/domain/shared/workspace'
import type { WorkspaceId } from '@/domain/shared/workspace'
import { useWorkspaceFilter } from '@/presentation/app/workspaceFilter'

/**
 * Said whenever the sidebar's workspace view is hiding things on this page, so a record filed under
 * another workspace (an FSA appointment while viewing S&B) never just looks missing.
 */
export function LensNotice({ items, noun = 'item' }: { items: { workspace?: WorkspaceId }[]; noun?: string }) {
  const { scope, setScope, matches } = useWorkspaceFilter()
  if (scope === 'all') return null
  const hidden = items.filter((i) => !matches(i.workspace))
  if (hidden.length === 0) return null
  const where = [...new Set(hidden.map((i) => i.workspace!))].map((w) => WORKSPACES[w].short).join(', ')

  return (
    <div role="status" className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
      <EyeOff className="size-3.5 shrink-0" />
      <span>
        {hidden.length} {noun}
        {hidden.length === 1 ? '' : 's'} in {where} hidden — you’re viewing {WORKSPACES[scope].short} only.
      </span>
      <button type="button" onClick={() => setScope('all')} className="font-medium text-foreground underline-offset-2 hover:underline">
        Show all workspaces
      </button>
    </div>
  )
}
