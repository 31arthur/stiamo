import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WORKSPACE_IDS, WORKSPACES } from '@/domain/shared/workspace'
import { WS_STYLE, WorkspaceDot } from '@/presentation/components/workspace'

/** Pick any number of workspaces. Each is a toggle, so it reads as a set rather than a choice of one. */
export function WorkspaceChips({ value, onChange, disabled }: { value: string[]; onChange: (next: string[]) => void; disabled?: boolean }) {
  return (
    <div role="group" aria-label="Workspaces" className="flex flex-wrap gap-2">
      {WORKSPACE_IDS.map((id) => {
        const on = value.includes(id)
        return (
          <button
            key={id}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(on ? value.filter((w) => w !== id) : [...value, id])}
            className={cn(
              'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors disabled:opacity-50',
              on ? cn('border-transparent font-medium', WS_STYLE[id].soft, WS_STYLE[id].text) : 'text-muted-foreground hover:border-foreground/30 hover:text-foreground',
            )}
          >
            {on ? <Check className="size-3.5" /> : <WorkspaceDot ws={id} />}
            {WORKSPACES[id].name}
          </button>
        )
      })}
    </div>
  )
}
