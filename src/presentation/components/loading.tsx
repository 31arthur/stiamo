import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Logo } from '@/presentation/layout/Logo'

export { Skeleton, Spinner }

/** True once `ms` have passed. Waits shorter than that finish before anything flashes. */
export function useAfter(ms: number) {
  const [done, setDone] = useState(ms <= 0)
  useEffect(() => {
    if (ms <= 0) return
    const id = setTimeout(() => setDone(true), ms)
    return () => clearTimeout(id)
  }, [ms])
  return done
}

/** The indicator for a wait inside a line of text or a small panel: the mark and what's being waited for. */
export function InlineLoading({ children = 'Loading…', className }: { children?: ReactNode; className?: string }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2 text-sm text-muted-foreground', className)}>
      <Spinner size="sm" tone="current" decorative /> {children}
    </span>
  )
}

/**
 * The indicator for a whole region (a page, a panel, a viewer). It appears after a short beat so a
 * quick load never flashes it, and holds the space so the layout doesn't jump.
 */
export function PageLoader({ label = 'Loading…', delay = 150, className }: { label?: string; delay?: number; className?: string }) {
  const show = useAfter(delay)
  return (
    <div role="status" aria-busy className={cn('flex min-h-[40vh] flex-1 flex-col items-center justify-center gap-3', className)}>
      {show && (
        <>
          <Spinner size="lg" label={label} decorative />
          <span className="text-sm text-muted-foreground">{label}</span>
        </>
      )}
    </div>
  )
}

/** Before the app itself is ready: signing in, starting up. */
export function FullScreenLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" aria-busy className="bg-ambient flex min-h-dvh flex-col items-center justify-center gap-6">
      <Logo />
      <Spinner size="lg" label={label} decorative />
      <span className="sr-only">{label}</span>
    </div>
  )
}

/** What a record's page looks like before it arrives: back link, heading, and two columns of cards. */
export function DetailSkeleton() {
  return (
    <div role="status" aria-busy className="grid gap-5">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-7 w-20" />
      <div className="flex items-start gap-4">
        <Skeleton className="size-16 shrink-0 rounded-2xl" />
        <div className="grid flex-1 gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-3/4 max-w-lg" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="grid content-start gap-4">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
        <div className="grid content-start gap-4">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      </div>
    </div>
  )
}

/** Rows of a list before they arrive. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-busy className="grid gap-2">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border p-3">
          <Skeleton className="size-5 rounded-full" />
          <div className="grid flex-1 gap-1.5">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
