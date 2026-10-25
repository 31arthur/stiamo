import { cn } from '@/lib/utils'

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
        <rect x="2" y="2" width="20" height="20" rx="6" className="fill-foreground" />
        <rect x="6" y="7" width="8" height="2.4" rx="1.2" className="fill-ws-sb" />
        <rect x="6" y="11" width="12" height="2.4" rx="1.2" className="fill-ws-fsa" />
        <rect x="6" y="15" width="6" height="2.4" rx="1.2" className="fill-ws-media" />
      </svg>
      <span className="font-display text-xl tracking-tight">Stiamo</span>
    </div>
  )
}
