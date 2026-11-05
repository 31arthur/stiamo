import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useResolve } from '@/presentation/routing'

/** A small button that opens a page of the app in a new browser tab, in the workspace you are in. */
export function PopOut({ to, label, className }: { to: string; label: string; className?: string }) {
  const href = useResolve()(to)
  return (
    <a
      href={typeof href === 'string' ? href : undefined}
      target="_blank"
      rel="noopener"
      aria-label={`Open ${label} in a new tab`}
      title="Open in a new tab"
      onClick={(e) => e.stopPropagation()}
      className={cn('flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground', className)}
    >
      <ExternalLink className="size-3.5" />
    </a>
  )
}
