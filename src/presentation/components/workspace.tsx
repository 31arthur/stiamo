import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { WORKSPACE_IDS, WORKSPACES } from '@/domain/shared/workspace'
import type { WorkspaceId } from '@/domain/shared/workspace'
import { spring } from '@/presentation/motion/presets'

/** Literal class names per workspace (Tailwind needs to see them verbatim). */
export const WS_STYLE: Record<WorkspaceId, { dot: string; soft: string; text: string; border: string; bar: string }> = {
  personal: { dot: 'bg-ws-personal', soft: 'bg-ws-personal-soft', text: 'text-ws-personal', border: 'border-ws-personal/40', bar: 'bg-ws-personal' },
  sb: { dot: 'bg-ws-sb', soft: 'bg-ws-sb-soft', text: 'text-ws-sb', border: 'border-ws-sb/40', bar: 'bg-ws-sb' },
  fsa: { dot: 'bg-ws-fsa', soft: 'bg-ws-fsa-soft', text: 'text-ws-fsa', border: 'border-ws-fsa/40', bar: 'bg-ws-fsa' },
  media: { dot: 'bg-ws-media', soft: 'bg-ws-media-soft', text: 'text-ws-media', border: 'border-ws-media/40', bar: 'bg-ws-media' },
}

export function WorkspaceDot({ ws, className }: { ws: WorkspaceId; className?: string }) {
  return <span className={cn('inline-block size-2 shrink-0 rounded-full', WS_STYLE[ws].dot, className)} aria-hidden />
}

export function WorkspaceBadge({ ws, className }: { ws: WorkspaceId; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium', WS_STYLE[ws].soft, WS_STYLE[ws].text, className)}>
      <WorkspaceDot ws={ws} />
      {WORKSPACES[ws].short}
    </span>
  )
}

export function WorkspacePicker({ value, onChange, id }: { value: WorkspaceId; onChange: (ws: WorkspaceId) => void; id?: string }) {
  return (
    <div id={id} role="radiogroup" aria-label="Workspace" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
      {WORKSPACE_IDS.map((ws) => {
        const selected = value === ws
        return (
          <button
            key={ws}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(ws)}
            className={cn('relative flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors', selected ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            {selected && <motion.span layoutId={`ws-pill-${id ?? 'x'}`} transition={spring.snappy} className="absolute inset-0 rounded-md bg-background shadow-float" />}
            <WorkspaceDot ws={ws} className="relative" />
            <span className="relative">{WORKSPACES[ws].short}</span>
          </button>
        )
      })}
    </div>
  )
}
